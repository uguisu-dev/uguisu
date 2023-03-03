import { AstNode, SourceFile } from '../syntax/ast';

type Type = 'number' | 'bool' | 'string';

type Symbol = { defined: boolean, ty?: Type };

class Env {
	private table: Map<string, Symbol>;

	constructor(baseEnv?: Env) {
		if (baseEnv != null) {
			this.table = new Map(baseEnv.table);
		} else {
			this.table = new Map();
		}
	}

	newSymbol(name: string): Symbol {
		const symbol: Symbol = { defined: false, ty: undefined };
		this.table.set(name, symbol);
		return symbol;
	}

	getSymbol(name: string): Symbol | undefined {
		return this.table.get(name);
	}
}

export function typeCheck(source: SourceFile) {
	const env = new Env();
	validateNode(source, env);
}

function validateNode(node: AstNode, env: Env) {
	switch (node.kind) {
		case 'SourceFile': {
			for (const n of node.funcs) {
				setDeclaration(n, env);
			}
			for (const n of node.funcs) {
				validateNode(n, env);
			}
			return;
		}
		case 'FunctionDecl': {
			const symbol = env.getSymbol(node.name);
			if (symbol == null) {
				throw new Error('unknown name');
			}
			symbol.defined = true;
			// node.returnTy

			for (const param of node.params) {
				const symbol = env.newSymbol(node.name);
				symbol.ty = inferType(param, env);
			}

			for (const statement of node.body) {
				validateNode(statement, env);
			}
			return;
		}
		case 'VariableDecl': {
			throw new Error('not implemented yet'); // TODO
		}
		case 'AssignStatement': {
			throw new Error('not implemented yet'); // TODO
		}
		case 'IfStatement': {
			throw new Error('not implemented yet'); // TODO
		}
		case 'LoopStatement': {
			throw new Error('not implemented yet'); // TODO
		}
		case 'ReturnStatement': {
			throw new Error('not implemented yet'); // TODO
		}
		case 'BreakStatement': {
			throw new Error('not implemented yet'); // TODO
		}
		case 'FnDeclParam':
		case 'TyLabel':
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
	}
	throw new Error('unexpected node');
}

function setDeclaration(node: AstNode, env: Env) {
	switch (node.kind) {
		case 'FunctionDecl': {
			env.newSymbol(node.name);
			break;
		}
	}
}

function inferType(node: AstNode, env: Env): Type {
	switch (node.kind) {
		case 'FnDeclParam': {
			if (node.ty == null) {
				throw new Error('parameter type is not specified');
			}
			return inferType(node.ty, env);
		}
		case 'TyLabel': {
			return resolveTypeName(node.name);
		}
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
			// TODO: operator
			const leftTy = inferType(node.left, env);
			const rightTy = inferType(node.right, env);
			if (leftTy != rightTy) {
				throw new Error('type mismatched.');
			}
			return leftTy;
		}
		case 'UnaryOp': {
			// TODO: operator
			const ty = inferType(node.expr, env);
			return ty;
		}
		case 'Identifier': {
			throw new Error('not implemented yet'); // TODO
		}
		case 'Call': {
			throw new Error('not implemented yet'); // TODO
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
