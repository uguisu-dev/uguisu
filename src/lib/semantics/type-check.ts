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
	for (const node of source.funcs) {
		setDeclaration(node, env);
	}
	for (const node of source.funcs) {
		validateNode(node, env);
	}
}

function setDeclaration(node: AstNode, env: Env) {
	switch (node.kind) {
		case 'FunctionDecl': {
			env.newSymbol(node.name);
			break;
		}
	}
}

function validateNode(node: AstNode, env: Env) {
	switch (node.kind) {
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
			break;
		}
		case 'VariableDecl': {
			break;
		}
		case 'AssignStatement': {
			break;
		}
		case 'IfStatement': {
			break;
		}
		case 'LoopStatement': {
			break;
		}
		case 'ReturnStatement': {
			break;
		}
		case 'BreakStatement': {
			break;
		}
	}
}

function inferType(node: AstNode, env: Env): Type {
	switch (node.kind) {
		case 'FnDeclParam': {
			if (node.ty != null) {
				return resolveTypeName(node.ty.name);
			}
			break;
		}
		case 'NumberLiteral': {
			break;
		}
		case 'BoolLiteral': {
			break;
		}
		case 'StringLiteral': {
			break;
		}
		case 'BinaryOp': {
			break;
		}
		case 'UnaryOp': {
			break;
		}
		case 'Identifier': {
			break;
		}
		case 'Call': {
			break;
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
