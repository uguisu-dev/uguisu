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
			throw new Error('leave root layer');
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
					throw new Error('parameter type is not specified.');
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
				throw new Error('unknown name');
			}
			if (symbol.kind != 'FunctionSymbol') {
				throw new Error('function expected');
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
			if (node.body != null) {
				ty = inferType(node.body, env);
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
				throw new Error('variable expected');
			}
			const bodyTy = inferType(node.body, env);
			if (!symbol.defined && symbol.ty == null) {
				symbol.ty = bodyTy;
			}
			if (symbol.ty == null) {
				throw new Error('type not resolved');
			}
			switch (node.mode) {
				case AssignMode.Assign: {
					if (symbol.ty != bodyTy) {
						throw new Error('type mismatched.');
					}
					break;
				}
				case AssignMode.AddAssign:
				case AssignMode.SubAssign:
				case AssignMode.MultAssign:
				case AssignMode.DivAssign:
				case AssignMode.ModAssign: {
					if (symbol.ty != 'number') {
						throw new Error('type mismatched.');
					}
					if (bodyTy != 'number') {
						throw new Error('type mismatched.');
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
				throw new Error('type mismatched.');
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
			throw new Error('unexpected node');
		}
	}
	throw new Error('unexpected node');
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
					throw new Error('type mismatched.');
				}
				if (rightTy != 'bool') {
					throw new Error('type mismatched.');
				}
				return 'bool';
			} else if (isEquivalentOperator(node.operator)) {
				// Equivalent Operation
				if (leftTy != rightTy) {
					throw new Error('type mismatched.');
				}
				return 'bool';
			} else if (isOrderingOperator(node.operator)) {
				// Ordering Operation
				if (leftTy != 'number') {
					throw new Error('type mismatched.');
				}
				if (rightTy != 'number') {
					throw new Error('type mismatched.');
				}
				return 'bool';
			} else {
				// Arithmetic Operation
				if (leftTy != 'number') {
					throw new Error('type mismatched.');
				}
				if (rightTy != 'number') {
					throw new Error('type mismatched.');
				}
				return 'number';
			}
			break;
		}
		case 'UnaryOp': {
			const ty = inferType(node.expr, env);
			// Logical Operation
			if (ty != 'bool') {
				throw new Error('type mismatched.');
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
						throw new Error('type not resolved');
					}
					return symbol.ty;
				}
			}
			break;
		}
		case 'Call': {
			const callee = lookupSymbolWithNode(node.callee, env);
			if (callee.kind != 'FunctionSymbol' && callee.kind != 'NativeFnSymbol') {
				throw new Error('function expected');
			}
			if (node.args.length != callee.paramsTy.length) {
				throw new Error('argument count incorrect');
			}
			for (let i = 0; i < callee.paramsTy.length; i++) {
				const argTy = inferType(node.args[i], env);
				if (argTy != callee.paramsTy[i]) {
					throw new Error('type error');
				}
			}
			return callee.returnTy;
		}
	}
	throw new Error('unexpected node');
}

function resolveTypeName(name: string): Type {
	switch (name) {
		case 'number':
		case 'bool':
		case 'string': {
			return name;
		}
	}
	throw new Error('unknown type');
}

function lookupSymbolWithNode(node: AstNode, env: AnalysisEnv): Symbol {
	if (node.kind != 'Identifier') {
		throw new Error('unexpected node');
	}
	const symbol = env.get(node.name);
	if (symbol == null) {
		throw new Error('symbol not found');
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
