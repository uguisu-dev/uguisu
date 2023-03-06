import {
	AssignMode,
	AstNode,
	FunctionDecl,
	isEquivalentOperator,
	isLogicalBinaryOperator,
	isOrderingOperator,
	SourceFile,
	StatementNode,
} from '../syntax/ast';

export type Type = 'void' | 'number' | 'bool' | 'string' | 'function';

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
	ty?: Type
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
				returnTy = resolveTypeName(node.returnTy.name);
			} else {
				returnTy = 'void';
			}
			const paramsTy: Type[] = [];
			for (const param of node.params) {
				if (param.ty == null) {
					dispatchError('parameter type missing.', param);
				}
				const paramTy = resolveTypeName(param.ty.name);
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
				ty = resolveTypeName(node.ty.name);
			}
			if (node.body != null) {
				const bodyTy = inferType(node.body, env);
				if (ty != null) {
					if (ty != bodyTy) {
						dispatchError('type mismatched.', node.body); // TODO
					}
				} else {
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
					if (symbol.ty != bodyTy) {
						dispatchError('type mismatched.', node.body); // TODO
					}
					break;
				}
				case AssignMode.AddAssign:
				case AssignMode.SubAssign:
				case AssignMode.MultAssign:
				case AssignMode.DivAssign:
				case AssignMode.ModAssign: {
					if (symbol.ty != 'number') {
						dispatchError('type mismatched.', node.body); // TODO
					}
					if (bodyTy != 'number') {
						dispatchError('type mismatched.', node.body); // TODO
					}
					break;
				}
			}
			symbol.defined = true;
			return;
		}
		case 'IfStatement': {
			const condTy = inferType(node.cond, env);
			if (condTy != 'bool') {
				dispatchError('type mismatched.', node.cond); // TODO
			}
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
				inferType(node.expr, env);
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
				if (leftTy != 'bool') {
					dispatchError('type mismatched.', node.left); // TODO
				}
				if (rightTy != 'bool') {
					dispatchError('type mismatched.', node.right); // TODO
				}
				return 'bool';
			} else if (isEquivalentOperator(node.operator)) {
				// Equivalent Operation
				if (leftTy != rightTy) {
					dispatchError('type mismatched.', node.left); // TODO
				}
				return 'bool';
			} else if (isOrderingOperator(node.operator)) {
				// Ordering Operation
				if (leftTy != 'number') {
					dispatchError('type mismatched.', node.left); // TODO
				}
				if (rightTy != 'number') {
					dispatchError('type mismatched.', node.right); // TODO
				}
				return 'bool';
			} else {
				// Arithmetic Operation
				if (leftTy != 'number') {
					dispatchError('type mismatched.', node.left); // TODO
				}
				if (rightTy != 'number') {
					dispatchError('type mismatched.', node.right); // TODO
				}
				return 'number';
			}
			break;
		}
		case 'UnaryOp': {
			const ty = inferType(node.expr, env);
			// Logical Operation
			if (ty != 'bool') {
				dispatchError('type mismatched.', node); // TODO
			}
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
			if (callee.kind != 'FunctionSymbol' && callee.kind != 'NativeFnSymbol') {
				dispatchError('function expected.', node.callee);
			}
			if (node.args.length != callee.paramsTy.length) {
				dispatchError('argument count incorrect.', node);
			}
			for (let i = 0; i < callee.paramsTy.length; i++) {
				const argTy = inferType(node.args[i], env);
				if (argTy != callee.paramsTy[i]) {
					dispatchError('type mismatched.', node.args[i]); // TODO
				}
			}
			return callee.returnTy;
		}
	}
	throw new Error('unexpected node.');
}

function resolveTypeName(name: string): Type {
	switch (name) {
		case 'number':
		case 'bool':
		case 'string': {
			return name;
		}
	}
	dispatchError('unknown type name.');
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

function dispatchError(message: string, node?: AstNode): never {
	if (node != null) {
		throw new Error(`${message} (${node.pos[0]}:${node.pos[1]})`);
	} else {
		throw new Error(message);
	}
}
