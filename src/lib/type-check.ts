import {
	AssignMode,
	AstNode,
	FunctionDecl,
	isEquivalentOperator,
	isLogicalBinaryOperator,
	isOrderingOperator,
	SourceFile,
	StatementNode,
	TyLabel,
} from './ast';

export type Type = 'void' | 'number' | 'bool' | 'string' | 'function';

function assertType(actual: Type, expected: Type, errorNode: AstNode) {
	if (actual == 'void') {
		dispatchError(`A function call that does not return a value cannot be used as an expression.`, errorNode);
	}
	if (actual != expected) {
		dispatchError(`type mismatched. expected \`${expected}\`, found \`${actual}\``, errorNode);
	}
}

export type FunctionSymbol = {
	kind: 'FunctionSymbol',
	node: FunctionDecl,
	defined: boolean,
	paramsTy: Type[],
	returnTy: Type,
};

export type NativeFnSymbol = {
	kind: 'NativeFnSymbol',
	paramsTy: Type[],
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

export function typeCheck(source: SourceFile, env: AnalysisEnv) {
	for (const n of source.funcs) {
		setDeclaration(n, env);
	}
	for (const n of source.funcs) {
		validateNode(n, env);
	}
}

function setDeclaration(node: AstNode, env: AnalysisEnv) {
	switch (node.kind) {
		case 'FunctionDecl': {
			// declare function
			let returnTy: Type;
			if (node.returnTy != null) {
				returnTy = resolveTypeName(node.returnTy);
			} else {
				returnTy = 'void';
			}
			const paramsTy: Type[] = [];
			for (const param of node.params) {
				if (param.ty == null) {
					dispatchError('parameter type missing.', param);
				}
				const paramTy = resolveTypeName(param.ty);
				paramsTy.push(paramTy);
			}
			env.set(node.name, {
				kind: 'FunctionSymbol',
				node: node,
				defined: false,
				paramsTy,
				returnTy,
			});
			break;
		}
	}
}

function validateNode(node: AstNode, env: AnalysisEnv) {
	switch (node.kind) {
		case 'FunctionDecl': {
			// define function
			const symbol = env.get(node.name);
			if (symbol == null) {
				dispatchError('unknown identifier.', node);
			}
			if (symbol.kind != 'FunctionSymbol') {
				dispatchError('function expected.', node);
			}
			env.enter();
			for (let i = 0; i < node.params.length; i++) {
				const paramSymbol: VariableSymbol = {
					kind: 'VariableSymbol',
					defined: true,
					ty: symbol.paramsTy[i],
				};
				env.set(node.params[i].name, paramSymbol);
			}
			for (const statement of node.body) {
				validateNode(statement, env);
			}
			env.leave();
			symbol.defined = true;
			return;
		}
		case 'VariableDecl': {
			let ty;
			if (node.ty != null) {
				ty = resolveTypeName(node.ty);
			}
			if (node.body != null) {
				const bodyTy = inferType(node.body, env);
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
			env.set(node.name, symbol);
			return;
		}
		case 'AssignStatement': {
			const symbol = lookupSymbolWithNode(node.target, env);
			if (symbol.kind != 'VariableSymbol') {
				dispatchError('variable expected.', node.target);
			}
			const bodyTy = inferType(node.body, env);
			if (symbol.ty == null) {
				symbol.ty = bodyTy;
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
			const condTy = inferType(node.cond, env);
			assertType(condTy, 'bool', node.cond);
			checkBlock(node.thenBlock, env);
			checkBlock(node.elseBlock, env);
			return;
		}
		case 'LoopStatement': {
			checkBlock(node.block, env);
			return;
		}
		case 'ReturnStatement': {
			if (node.expr != null) {
				const ty = inferType(node.expr, env);
				if (ty == 'void') {
					dispatchError(`A function call that does not return a value cannot be used as an expression.`, node.expr);
				}
			}
			return;
		}
		case 'BreakStatement': {
			return;
		}
		case 'NumberLiteral':
		case 'BoolLiteral':
		case 'StringLiteral':
		case 'BinaryOp':
		case 'UnaryOp':
		case 'Identifier':
		case 'Call': {
			inferType(node, env);
			return;
		}
		case 'SourceFile':
		case 'FnDeclParam':
		case 'TyLabel': {
			throw new Error('unexpected node.');
		}
	}
	throw new Error('unexpected node.');
}

function inferType(node: AstNode, env: AnalysisEnv): Type {
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
			const leftTy = inferType(node.left, env);
			const rightTy = inferType(node.right, env);
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
			const ty = inferType(node.expr, env);
			// Logical Operation
			assertType(ty, 'bool', node);
			return 'bool';
		}
		case 'Identifier': {
			const symbol = lookupSymbolWithNode(node, env);
			switch (symbol.kind) {
				case 'FunctionSymbol':
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
			const callee = lookupSymbolWithNode(node.callee, env);
			switch (callee.kind) {
				case 'FunctionSymbol':
				case 'NativeFnSymbol': {
					break;
				}
				default: {
					throw new Error('function expected');
				}
			}
			if (node.args.length != callee.paramsTy.length) {
				dispatchError('argument count incorrect.', node);
			}
			for (let i = 0; i < callee.paramsTy.length; i++) {
				const argTy = inferType(node.args[i], env);
				if (argTy != callee.paramsTy[i]) {
					assertType(argTy, callee.paramsTy[i], node.args[i]);
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

function lookupSymbolWithNode(node: AstNode, env: AnalysisEnv): Symbol {
	if (node.kind != 'Identifier') {
		dispatchError('identifier expected.', node);
	}
	const symbol = env.get(node.name);
	if (symbol == null) {
		dispatchError('unknown identifier.', node);
	}
	return symbol;
}

function checkBlock(block: StatementNode[], env: AnalysisEnv) {
	env.enter();
	for (const statement of block) {
		validateNode(statement, env);
	}
	env.leave();
}

function dispatchError(message: string, errorNode?: AstNode): never {
	if (errorNode != null) {
		throw new Error(`${message} (${errorNode.pos[0]}:${errorNode.pos[1]})`);
	} else {
		throw new Error(message);
	}
}
