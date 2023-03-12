import { AstNode, ExprNode, FunctionDecl, Identifier, SourceFile, StatementNode } from '../ast.js';
import Wasm from 'binaryen';
import { Symbol, Type } from '../analyze.js';
import { UguisuError } from '../index.js';

export function codegen(symbolTable: Map<AstNode, Symbol>, node: SourceFile) {
	const mod = translate(symbolTable, node);
	console.log(mod.emitStackIR());
	return mod.emitBinary();
}

type Context = {
	symbolTable: Map<AstNode, Symbol>,
	mod: Wasm.Module,
	labelCount: number;
};

type FuncInfo = {
	name: string;
	vars: { name: string, ty: Type, isParam: boolean }[];
	returnTy: Type;
};

function translate(symbolTable: Map<AstNode, Symbol>, node: SourceFile): Wasm.Module {
	const mod = new Wasm.Module();
	mod.addDebugInfoFileName(node.filename);
	const ctx: Context = {
		mod,
		symbolTable,
		labelCount: 0,
	};

	for (const func of node.funcs) {
		translateFunc(ctx, func);
	}
	//mod.optimize();
	if (!mod.validate()) {
		throw new UguisuError('failed to generate the wasm code.');
	}

	return mod;
}

function translateFunc(ctx: Context, node: FunctionDecl) {
	const symbol = ctx.symbolTable.get(node);
	if (symbol == null || symbol.kind != 'FnSymbol') {
		throw new UguisuError('unknown node');
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

	const body = translateStatements(ctx, node.body, func, null);
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

function translateStatements(ctx: Context, nodes: StatementNode[], funcInfo: FuncInfo, loopLabel: number | null): number[] {
	const body: number[] = [];

	for (const node of nodes) {
		switch (node.kind) {
			case 'VariableDecl': {
				if (node.body != null) {
					const varIndex = funcInfo.vars.findIndex(x => x.name == node.name);
					if (varIndex == -1) {
						throw new UguisuError('variable not found');
					}
					body.push(ctx.mod.local.set(varIndex, translateExpr(ctx, node.body, funcInfo)));
				}
				break;
			}
			case 'AssignStatement': {
				if (node.target.kind != 'Identifier') {
					throw new UguisuError('invalid target');
				}
				const ident = node.target;
				const varIndex = funcInfo.vars.findIndex(x => x.name == ident.name);
				if (varIndex == -1) {
					throw new UguisuError('variable not found');
				}
				switch (node.mode) {
					case '=': {
						body.push(ctx.mod.local.set(varIndex, translateExpr(ctx, node.body, funcInfo)));
						break;
					}
					case '+=': {
						const amount = translateExpr(ctx, node.body, funcInfo);
						const value = ctx.mod.i32.add(ctx.mod.local.get(varIndex, Wasm.i32), amount);
						body.push(ctx.mod.local.set(varIndex, value));
						break;
					}
					case '-=': {
						const amount = translateExpr(ctx, node.body, funcInfo);
						const value = ctx.mod.i32.sub(ctx.mod.local.get(varIndex, Wasm.i32), amount);
						body.push(ctx.mod.local.set(varIndex, value));
						break;
					}
					case '*=': {
						const amount = translateExpr(ctx, node.body, funcInfo);
						const value = ctx.mod.i32.mul(ctx.mod.local.get(varIndex, Wasm.i32), amount);
						body.push(ctx.mod.local.set(varIndex, value));
						break;
					}
					case '/=': {
						const amount = translateExpr(ctx, node.body, funcInfo);
						const value = ctx.mod.i32.div_s(ctx.mod.local.get(varIndex, Wasm.i32), amount);
						body.push(ctx.mod.local.set(varIndex, value));
						break;
					}
					default: {
						throw new UguisuError('unsupported operation');
					}
				}
				break;
			}
			case 'IfStatement': {
				const cond = translateExpr(ctx, node.cond, funcInfo);
				const thenRefs = translateStatements(ctx, node.thenBlock, funcInfo, loopLabel);
				const thenBlock = ctx.mod.block(null, thenRefs);
				const elseRefs = translateStatements(ctx, node.elseBlock, funcInfo, loopLabel);
				const elseBlock = ctx.mod.block(null, elseRefs);
				body.push(ctx.mod.if(cond, thenBlock, elseBlock));
				break;
			}
			case 'LoopStatement': {
				const label = ctx.labelCount;
				ctx.labelCount++;
				const refs = translateStatements(ctx, node.block, funcInfo, label);
				refs.push(ctx.mod.br('L'+label));
				body.push(ctx.mod.loop('L'+label, ctx.mod.block('B'+label, refs)));
				break;
			}
			case 'ReturnStatement': {
				if (node.expr != null) {
					const expr = translateExpr(ctx, node.expr, funcInfo);
					body.push(ctx.mod.return(expr));
				} else {
					body.push(ctx.mod.return());
				}
				break;
			}
			case 'BreakStatement': {
				if (loopLabel == null) {
					throw new UguisuError('invalid break target');
				}
				body.push(ctx.mod.br('B'+loopLabel));
				break;
			}
			case 'NumberLiteral':
			case 'BoolLiteral':
			case 'StringLiteral':
			case 'BinaryOp':
			case 'UnaryOp':
			case 'Identifier':
			case 'Call': {
				// nop
				break;
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
		case 'BoolLiteral': {
			return ctx.mod.i32.const(node.value ? 1 : 0);
		}
		case 'StringLiteral': {
			throw new UguisuError('not impelemented yet');
		}
		case 'BinaryOp': {
			const symbol = ctx.symbolTable.get(node);
			if (symbol == null || symbol.kind != 'ExprSymbol') {
				throw new UguisuError('invalid node');
			}
			const left = translateExpr(ctx, node.left, func);
			const right = translateExpr(ctx, node.right, func);
			if (symbol.ty == 'number') {
				switch (node.operator) {
					case '+': {
						return ctx.mod.i32.add(left, right);
					}
					case '-': {
						return ctx.mod.i32.sub(left, right);
					}
					case '*': {
						return ctx.mod.i32.mul(left, right);
					}
					case '/': {
						return ctx.mod.i32.div_s(left, right);
					}
					default: {
						throw new UguisuError('unsupported operation');
					}
				}
			} else if (symbol.ty == 'bool') {
				switch (node.operator) {
					case '==': {
						return ctx.mod.i32.eq(left, right);
					}
					case '!=': {
						return ctx.mod.i32.ne(left, right);
					}
					case '<': {
						return ctx.mod.i32.lt_s(left, right);
					}
					case '<=': {
						return ctx.mod.i32.le_s(left, right);
					}
					case '>': {
						return ctx.mod.i32.gt_s(left, right);
					}
					case '>=': {
						return ctx.mod.i32.ge_s(left, right);
					}
					case '&&': {
						return ctx.mod.i32.and(left, right);
					}
					case '||': {
						return ctx.mod.i32.or(left, right);
					}
					default: {
						throw new UguisuError('unsupported operation');
					}
				}
			} else {
				throw new UguisuError('not impelemented yet');
			}
			break;
		}
		case 'UnaryOp': {
			const symbol = ctx.symbolTable.get(node);
			if (symbol == null || symbol.kind != 'ExprSymbol') {
				throw new UguisuError('invalid node');
			}
			const expr = translateExpr(ctx, node.expr, func);
			switch (node.operator) {
				case '!': {
					return ctx.mod.i32.eq(expr, ctx.mod.i32.const(0));
				}
				default: {
					throw new UguisuError('unsupported operation');
				}
			}
			break;
		}
		case 'Identifier': {
			// get variable index and type
			const varIndex = func.vars.findIndex(x => x.name == node.name);
			if (varIndex == -1) {
				throw new UguisuError('variable not found');
			}
			return ctx.mod.local.get(varIndex, mapType(func.vars[varIndex].ty));
		}
		case 'Call': {
			const calleeSymbol = ctx.symbolTable.get(node.callee);
			if (calleeSymbol == null || calleeSymbol.kind != 'FnSymbol') {
				throw new UguisuError('invalid node');
			}
			const callee = node.callee as Identifier;
			const args = node.args.map(x => translateExpr(ctx, x, func));
			return ctx.mod.call(callee.name, args, mapType(calleeSymbol.returnTy));
		}
		default: {
			throw new UguisuError('unexpected node');
		}
	}
}

function mapType(type: Type): number {
	switch (type) {
		case 'void': {
			return Wasm.none;
		}
		case 'number':
		case 'bool': {
			return Wasm.i32;
		}
		case 'string':
		case 'function': {
			throw new UguisuError('not impelemented yet');
		}
	}
}
