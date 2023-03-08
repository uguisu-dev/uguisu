import { AstNode, ExprNode, FunctionDecl, SourceFile, StatementNode } from '../ast.js';
import Wasm from 'binaryen';
import { Symbol, Type } from '../analyze.js';

export function codegen(symbolTable: Map<AstNode, Symbol>, node: SourceFile) {
	const mod = translate(symbolTable, node);
	return mod.emitText();
}

type Context = {
	symbolTable: Map<AstNode, Symbol>,
	mod: Wasm.Module,
};

type FuncInfo = {
	name: string;
	params: { name: string, ty: Type }[];
	locals: { name: string, ty: Type }[];
	returnTy: Type;
};

function translate(symbolTable: Map<AstNode, Symbol>, node: SourceFile): Wasm.Module {
	const mod = new Wasm.Module();
	mod.addDebugInfoFileName(node.filename);
	const ctx: Context = { mod, symbolTable };

	for (const func of node.funcs) {
		translateFunc(ctx, func);
	}
	//mod.optimize();
	if (!mod.validate()) {
		throw new Error('failed to generate the wasm code.');
	}

	return mod;
}

function translateFunc(ctx: Context, node: FunctionDecl) {
	const symbol = ctx.symbolTable.get(node);
	if (symbol == null || symbol.kind != 'FunctionSymbol') {
		throw new Error('unknown node');
	}
	const params = symbol.params.map(param => ({
		name: param.name,
		ty: param.ty,
	}));
	const locals: { name: string, ty: Type }[] = [];
	// set function info
	const func: FuncInfo = {
		name: node.name,
		params,
		locals,
		returnTy: symbol.returnTy,
	};

	const body = translateFuncBody(ctx, node.body, func);
	const bodyBlock = ctx.mod.block(null, body);
	const paramsTy = Wasm.createType(func.params.map(param => mapType(param.ty)));
	ctx.mod.addFunction(
		func.name,
		paramsTy,
		mapType(func.returnTy),
		func.locals.map(param => mapType(param.ty)),
		bodyBlock,
	);
	ctx.mod.addFunctionExport(func.name, func.name);
}

function translateFuncBody(ctx: Context, statements: StatementNode[], funcInfo: FuncInfo): number[] {
	const body: number[] = [];

	for (const statement of statements) {
		switch (statement.kind) {
			case 'VariableDecl': {
				if (statement.body != null) {
					const [_, localIndex] = getVariableIndex(statement.name, funcInfo);
					if (localIndex == -1) {
						throw new Error('variable not found');
					}
					body.push(ctx.mod.local.set(localIndex, translateExpr(ctx, statement.body, funcInfo)));
				}
				break;
			}
			case 'AssignStatement': {
				if (statement.target.kind != 'Identifier') {
					throw new Error('invalid target');
				}
				const [paramIndex, localIndex] = getVariableIndex(statement.target.name, funcInfo);
				if (paramIndex == -1 && localIndex == -1) {
					throw new Error('variable not found');
				}
				if (paramIndex != -1) {
					body.push(ctx.mod.local.set(paramIndex, translateExpr(ctx, statement.body, funcInfo)));
				} else {
					body.push(ctx.mod.local.set(funcInfo.params.length + localIndex, translateExpr(ctx, statement.body, funcInfo)));
				}
				break;
			}
			case 'ReturnStatement': {
				if (statement.expr != null) {
					const expr = translateExpr(ctx, statement.expr, funcInfo);
					body.push(ctx.mod.return(expr));
				} else {
					body.push(ctx.mod.return());
				}
			}
		}
	}

	return body;
}

function translateExpr(ctx: Context, node: ExprNode, func: FuncInfo): number {
	switch (node.kind) {
		case 'NumberLiteral': {
			return ctx.mod.i32.const(node.value);
		}
		case 'Identifier': {
			// get variable index and type
			const [paramIndex, localIndex] = getVariableIndex(node.name, func);
			if (paramIndex == -1 && localIndex == -1) {
				throw new Error('variable not found');
			}
			if (paramIndex != -1) {
				return ctx.mod.local.get(paramIndex, mapType(func.params[paramIndex].ty));
			} else {
				return ctx.mod.local.get(func.params.length + localIndex, mapType(func.locals[localIndex].ty));
			}
		}
		default: {
			throw new Error('unexpected node');
		}
	}
}

function mapType(type: Type): number {
	switch (type) {
		case 'void': {
			return Wasm.none;
		}
		case 'number': {
			return Wasm.i32;
		}
		case 'bool':
		case 'string':
		case 'function': {
			throw new Error('not impelemented yet');
		}
	}
}

/**
 * @returns [paramIndex, localIndex]
*/
function getVariableIndex(name: string, func: FuncInfo): [number, number] {
	let paramIndex = func.params.findIndex(i => i.name == name);
	let localIndex = -1;
	if (paramIndex == -1) {
		localIndex = func.locals.findIndex(i => i.name == name);
	}
	return [paramIndex, localIndex];
}
