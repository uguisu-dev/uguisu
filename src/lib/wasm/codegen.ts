import { AstNode, ExprNode, FunctionDecl, SourceFile, StatementNode } from '../ast.js';
import Wasm from 'binaryen';
import { Symbol, Type } from '../analyze.js';

export function codegenText(symbolTable: Map<AstNode, Symbol>, node: SourceFile) {
	const mod = translate(symbolTable, node);

	return mod.emitText();
}

export function codegenBinary(symbolTable: Map<AstNode, Symbol>, node: SourceFile) {
	const mod = translate(symbolTable, node);

	const binary = mod.emitBinary();
	let buf: string[] = [];
	for (const x of binary) {
		buf.push(x.toString(16).padStart(2, '0'));
	}
	return buf.join(' ');
}

type Context = {
	symbolTable: Map<AstNode, Symbol>,
	mod: Wasm.Module,
};

type FuncInfo = {
	name: string;
	vars: { name: string, ty: Type, isParam: boolean }[];
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
	if (symbol == null || symbol.kind != 'FnSymbol') {
		throw new Error('unknown node');
	}

	const vars: FuncInfo['vars'] = [];
	for (const variable of symbol.vars) {
		if (variable.ty != null) {
			vars.push({
				name: variable.name,
				ty: variable.ty,
				isParam: variable.isParam,
			});
		}
	}
	// set function info
	const func: FuncInfo = {
		name: node.name,
		vars,
		returnTy: symbol.returnTy,
	};

	const body = translateFuncBody(ctx, node.body, func);
	const bodyBlock = ctx.mod.block(null, body);
	const params: number[] = [];
	const locals: number[] = [];
	for (const x of func.vars) {
		if (x.isParam) {
			params.push(mapType(x.ty));
		} else {
			locals.push(mapType(x.ty));
		}
	}
	ctx.mod.addFunction(
		func.name,
		Wasm.createType(params),
		mapType(func.returnTy),
		locals,
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
					const varIndex = funcInfo.vars.findIndex(x => x.name == statement.name);
					if (varIndex == -1) {
						throw new Error('variable not found');
					}
					body.push(ctx.mod.local.set(varIndex, translateExpr(ctx, statement.body, funcInfo)));
				}
				break;
			}
			case 'AssignStatement': {
				if (statement.target.kind != 'Identifier') {
					throw new Error('invalid target');
				}
				const ident = statement.target;
				const varIndex = funcInfo.vars.findIndex(x => x.name == ident.name);
				if (varIndex == -1) {
					throw new Error('variable not found');
				}
				body.push(ctx.mod.local.set(varIndex, translateExpr(ctx, statement.body, funcInfo)));
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
			const varIndex = func.vars.findIndex(x => x.name == node.name);
			if (varIndex == -1) {
				throw new Error('variable not found');
			}
			return ctx.mod.local.get(varIndex, mapType(func.vars[varIndex].ty));
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
