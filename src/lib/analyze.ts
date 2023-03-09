import {
	AssignMode,
	AstNode,
	FunctionDecl,
	Identifier,
	isEquivalentOperator,
	isLogicalBinaryOperator,
	isOrderingOperator,
	SourceFile,
	StatementNode,
	TyLabel,
} from './ast.js';

export type Type = 'void' | 'number' | 'bool' | 'string' | 'function';

function assertType(actual: Type, expected: Type, errorNode: AstNode) {
	if (actual == 'void') {
		dispatchError(`A function call that does not return a value cannot be used as an expression.`, errorNode);
	}
	if (actual != expected) {
		dispatchError(`type mismatched. expected \`${expected}\`, found \`${actual}\``, errorNode);
	}
}

type FnVar = { name: string, isParam: boolean, ty?: Type };

export type FunctionSymbol = {
	kind: 'FnSymbol',
	defined: boolean,
	params: { name: string, ty: Type }[],
	returnTy: Type,
	/** for wasm */
	vars: FnVar[],
};

export type NativeFnSymbol = {
	kind: 'NativeFnSymbol',
	params: { name: string, ty: Type }[],
	returnTy: Type,
};

export type VariableSymbol = {
	kind: 'VariableSymbol',
	defined: boolean,
	ty?: Type,
};

export type Symbol = FunctionSymbol | NativeFnSymbol | VariableSymbol;

export class AnalysisEnv {
	private layers: Map<string, Symbol>[];

	constructor(baseEnv?: AnalysisEnv) {
		if (baseEnv != null) {
			this.layers = [...baseEnv.layers];
		} else {
			this.layers = [new Map()];
		}
	}

	set(name: string, symbol: Symbol) {
		this.layers[0].set(name, symbol);
		return symbol;
	}

	get(name: string): Symbol | undefined {
		for (const layer of this.layers) {
			const symbol = layer.get(name);
			if (symbol != null) {
				return symbol;
			}
		}
		return undefined;
	}

	enter() {
		this.layers.unshift(new Map());
	}

	leave() {
		if (this.layers.length <= 1) {
			throw new Error('Left the root layer.');
		}
		this.layers.shift();
	}
}

export type Context = {
	symbolTable: Map<AstNode, Symbol>,
	env: AnalysisEnv,
};

export function analyze(ctx: Context, source: SourceFile) {
	for (const n of source.funcs) {
		setDeclaration(ctx, n);
	}
	for (const n of source.funcs) {
		validateFunc(ctx, n);
	}
	// console.log(ctx.symbolTable);
}

function setDeclaration(ctx: Context, node: AstNode) {
	switch (node.kind) {
		case 'FunctionDecl': {
			// declare function
			let returnTy: Type;
			if (node.returnTy != null) {
				returnTy = resolveTypeName(node.returnTy);
			} else {
				returnTy = 'void';
			}
			const params: { name: string, ty: Type }[] = [];
			const vars: FnVar[] = [];
			for (const param of node.params) {
				if (param.ty == null) {
					dispatchError('parameter type missing.', param);
				}
				const paramTy = resolveTypeName(param.ty);
				params.push({ name: param.name, ty: paramTy });
				vars.push({ name: param.name, isParam: true, ty: paramTy });
			}
			const symbol: FunctionSymbol = {
				kind: 'FnSymbol',
				defined: false,
				params,
				returnTy,
				vars,
			};
			ctx.symbolTable.set(node, symbol);
			ctx.env.set(node.name, symbol);
			break;
		}
	}
}

function validateFunc(ctx: Context, node: FunctionDecl) {
	// define function
	const symbol = ctx.env.get(node.name);
	if (symbol == null) {
		dispatchError('unknown identifier.', node);
	}
	if (symbol.kind != 'FnSymbol') {
		dispatchError('function expected.', node);
	}
	ctx.env.enter();
	for (let i = 0; i < node.params.length; i++) {
		const paramSymbol: VariableSymbol = {
			kind: 'VariableSymbol',
			defined: true,
			ty: symbol.params[i].ty,
		};
		ctx.symbolTable.set(node.params[i], paramSymbol);
		ctx.env.set(node.params[i].name, paramSymbol);
	}
	for (const statement of node.body) {
		validateStatement(ctx, statement, false, symbol);
	}
	ctx.env.leave();
	symbol.defined = true;
}

function validateStatement(ctx: Context, node: AstNode, allowJump: boolean, funcSymbol: FunctionSymbol) {
	switch (node.kind) {
		case 'VariableDecl': {
			let ty;
			if (node.ty != null) {
				ty = resolveTypeName(node.ty);
			}
			if (node.body != null) {
				const bodyTy = inferType(ctx, node.body, funcSymbol);
				if (ty != null) {
					assertType(bodyTy, ty, node.body);
				} else {
					if (bodyTy == 'void') {
						dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.body);
					}
					ty = bodyTy;
				}
			}
			const symbol: VariableSymbol = {
				kind: 'VariableSymbol',
				defined: (node.body != null),
				ty,
			};
			ctx.symbolTable.set(node, symbol);
			ctx.env.set(node.name, symbol);

			funcSymbol.vars.push({
				name: node.name,
				isParam: false,
				ty,
			});
			return;
		}
		case 'AssignStatement': {
			const symbol = lookupSymbolWithNode(ctx, node.target);
			ctx.symbolTable.set(node.target, symbol);
			if (symbol.kind != 'VariableSymbol') {
				dispatchError('variable expected.', node.target);
			}
			const bodyTy = inferType(ctx, node.body, funcSymbol);
			if (symbol.ty == null) {
				symbol.ty = bodyTy;

				const target = (node.target as Identifier); // TODO: improve code
				const variable = funcSymbol.vars.find(x => x.name == target.name);
				variable!.ty = bodyTy;
			}
			switch (node.mode) {
				case AssignMode.Assign: {
					assertType(bodyTy, symbol.ty, node.body);
					break;
				}
				case AssignMode.AddAssign:
				case AssignMode.SubAssign:
				case AssignMode.MultAssign:
				case AssignMode.DivAssign:
				case AssignMode.ModAssign: {
					assertType(symbol.ty, 'number', node.target);
					assertType(bodyTy, 'number', node.body);
					break;
				}
			}
			symbol.defined = true;
			return;
		}
		case 'IfStatement': {
			const condTy = inferType(ctx, node.cond, funcSymbol);
			assertType(condTy, 'bool', node.cond);
			validateBlock(ctx, node.thenBlock, allowJump, funcSymbol);
			validateBlock(ctx, node.elseBlock, allowJump, funcSymbol);
			return;
		}
		case 'LoopStatement': {
			validateBlock(ctx, node.block, true, funcSymbol);
			return;
		}
		case 'ReturnStatement': {
			if (node.expr != null) {
				const ty = inferType(ctx, node.expr, funcSymbol);
				if (ty == 'void') {
					dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
				}
			}
			return;
		}
		case 'BreakStatement': {
			if (!allowJump) {
				dispatchError('invalid break statement');
			}
			return;
		}
		case 'NumberLiteral':
		case 'BoolLiteral':
		case 'StringLiteral':
		case 'BinaryOp':
		case 'UnaryOp':
		case 'Identifier':
		case 'Call': {
			inferType(ctx, node, funcSymbol);
			return;
		}
		case 'SourceFile':
		case 'FunctionDecl':
		case 'FnDeclParam':
		case 'TyLabel': {
			throw new Error('unexpected node.');
		}
	}
	throw new Error('unexpected node.');
}

function validateBlock(ctx: Context, block: StatementNode[], allowJump: boolean, funcSymbol: FunctionSymbol) {
	ctx.env.enter();
	for (const statement of block) {
		validateStatement(ctx, statement, allowJump, funcSymbol);
	}
	ctx.env.leave();
}

function inferType(ctx: Context, node: AstNode, funcSymbol: FunctionSymbol): Type {
	switch (node.kind) {
		case 'NumberLiteral': {
			return 'number';
		}
		case 'BoolLiteral': {
			return 'bool';
		}
		case 'StringLiteral': {
			return 'string';
		}
		case 'BinaryOp': {
			const leftTy = inferType(ctx, node.left, funcSymbol);
			const rightTy = inferType(ctx, node.right, funcSymbol);
			if (isLogicalBinaryOperator(node.operator)) {
				// Logical Operation
				assertType(leftTy, 'bool', node.left);
				assertType(rightTy, 'bool', node.right);
				return 'bool';
			} else if (isEquivalentOperator(node.operator)) {
				// Equivalent Operation
				assertType(rightTy, leftTy, node.right);
				return 'bool';
			} else if (isOrderingOperator(node.operator)) {
				// Ordering Operation
				assertType(leftTy, 'number', node.left);
				assertType(rightTy, 'number', node.right);
				return 'bool';
			} else {
				// Arithmetic Operation
				assertType(leftTy, 'number', node.left);
				assertType(rightTy, 'number', node.right);
				return 'number';
			}
			break;
		}
		case 'UnaryOp': {
			const ty = inferType(ctx, node.expr, funcSymbol);
			// Logical Operation
			assertType(ty, 'bool', node);
			return 'bool';
		}
		case 'Identifier': {
			const symbol = lookupSymbolWithNode(ctx, node);
			ctx.symbolTable.set(node, symbol);
			switch (symbol.kind) {
				case 'FnSymbol':
				case 'NativeFnSymbol': {
					return 'function';
				}
				case 'VariableSymbol': {
					if (symbol.ty == null) {
						dispatchError('variable is not assigned yet.', node);
					}
					return symbol.ty;
				}
			}
			break;
		}
		case 'Call': {
			const callee = lookupSymbolWithNode(ctx, node.callee);
			ctx.symbolTable.set(node.callee, callee);
			switch (callee.kind) {
				case 'FnSymbol':
				case 'NativeFnSymbol': {
					break;
				}
				default: {
					throw new Error('function expected');
				}
			}
			if (node.args.length != callee.params.length) {
				dispatchError('argument count incorrect.', node);
			}
			for (let i = 0; i < callee.params.length; i++) {
				const argTy = inferType(ctx, node.args[i], funcSymbol);
				if (argTy != callee.params[i].ty) {
					assertType(argTy, callee.params[i].ty, node.args[i]);
				}
			}
			return callee.returnTy;
		}
	}
	throw new Error('unexpected node.');
}

function resolveTypeName(node: TyLabel): Type {
	switch (node.name) {
		case 'number':
		case 'bool':
		case 'string': {
			return node.name;
		}
	}
	dispatchError('unknown type name.', node);
}

function lookupSymbolWithNode(ctx: Context, node: AstNode): Symbol {
	if (node.kind != 'Identifier') {
		dispatchError('identifier expected.', node);
	}
	const symbol = ctx.env.get(node.name);
	if (symbol == null) {
		dispatchError('unknown identifier.', node);
	}
	return symbol;
}

function dispatchError(message: string, errorNode?: AstNode): never {
	if (errorNode != null) {
		throw new Error(`${message} (${errorNode.pos[0]}:${errorNode.pos[1]})`);
	} else {
		throw new Error(message);
	}
}
