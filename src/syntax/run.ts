import { ExprNode, FunctionDecl, isExprNode, SourceFile, StatementNode } from './ast';

type Value = FunctionValue | NumberValue | BoolValue | StringValue;

type FunctionValue = {
	kind: 'FunctionValue',
	node: FunctionDecl;
};
function newFunctionValue(node: FunctionDecl): FunctionValue {
	return { kind: 'FunctionValue', node };
}
function asFunctionValue(value: Value): asserts value is FunctionValue {
	if (value.kind != 'FunctionValue') {
		throw new Error(`type mismatched. expected \`fn\`, found \`${getTypeName(value)}\``);
	}
}

type NumberValue = {
	kind: 'NumberValue',
	value: number,
};
function newNumberValue(value: number): NumberValue {
	return { kind: 'NumberValue', value };
}
function asNumberValue(value: Value): asserts value is NumberValue {
	if (value.kind != 'NumberValue') {
		throw new Error(`type mismatched. expected \`number\`, found \`${getTypeName(value)}\``);
	}
}

type BoolValue = {
	kind: 'BoolValue',
	value: boolean,
};
function newBoolValue(value: boolean): BoolValue {
	return { kind: 'BoolValue', value };
}
function asBoolValue(value: Value): asserts value is BoolValue {
	if (value.kind != 'BoolValue') {
		throw new Error(`type mismatched. expected \`bool\`, found \`${getTypeName(value)}\``);
	}
}

type StringValue = {
	kind: 'StringValue',
	value: string,
};
function newStringValue(value: string): StringValue {
	return { kind: 'StringValue', value };
}
function asStringValue(value: Value): asserts value is StringValue {
	if (value.kind != 'StringValue') {
		throw new Error(`type mismatched. expected \`string\`, found \`${getTypeName(value)}\``);
	}
}

function getTypeName(value: Value): string {
	switch (value.kind) {
		case 'FunctionValue': {
			return 'fn';
		}
		case 'NumberValue': {
			return 'number';
		}
		case 'BoolValue': {
			return 'bool';
		}
		case 'StringValue': {
			return 'string';
		}
	}
}

class Env {
	frames: Map<string, Value>[];

	constructor() {
		this.frames = [new Map()];
	}

	set(name: string, value: Value) {
		this.frames[0].set(name, value);
	}

	get(name: string): Value | undefined {
		return this.frames[0].get(name);
	}

	pushFrame() {
		this.frames.unshift(new Map());
	}

	popFrame() {
		this.frames.shift();
	}
}

type StatementResult = {
	kind: StatementResultKind,
	value?: Value,
};

enum StatementResultKind {
	None,
	Return,
	Break,
}

function newNoneResult(): StatementResult {
	return { kind: StatementResultKind.None };
}

function newReturnResult(value?: Value): StatementResult {
	return { kind: StatementResultKind.Return, value };
}

function newBreakResult(): StatementResult {
	return { kind: StatementResultKind.Break };
}

export class Runner {
	source: SourceFile;
	env: Env;

	constructor(source: SourceFile) {
		this.source = source;
		this.env = new Env();
	}

	run() {
		evalSourceFile(this.env, this.source);
		const func = this.env.get('main');
		if (func == null) {
			throw new Error('function `main` is not found');
		}
		asFunctionValue(func);
		return callFunction(this.env, func, []);
	}
}

function evalSourceFile(env: Env, source: SourceFile) {
	for (const func of source.funcs) {
		env.set(func.name, newFunctionValue(func));
	}
}

function callFunction(env: Env, func: FunctionValue, args: Value[]): Value | undefined {
	env.pushFrame();
	let i = 0;
	while (i < func.node.params.length) {
		const param = func.node.params[i];
		const arg = args[i];
		env.set(param.name, arg);
		i++;
	}
	const result = execBlock(env, func.node.body);
	env.popFrame();

	if (result.kind == StatementResultKind.Return) {
		return result.value;
	}
	return undefined;
}

function execStatement(env: Env, statement: StatementNode): StatementResult {
	if (isExprNode(statement)) {
		evalExpr(env, statement);
		return newNoneResult();
	} else {
		switch (statement.kind) {
			case 'ReturnStatement': {
				if (statement.expr != null) {
					return newReturnResult(evalExpr(env, statement.expr));
				} else {
					return newReturnResult();
				}
			}
			case 'BreakStatement': {
				return newBreakResult();
			}
			case 'LoopStatement': {
				while (true) {
					const result = execBlock(env, statement.block);
					if (result.kind == StatementResultKind.Return) {
						return result;
					} else if (result.kind == StatementResultKind.Break) {
						break;
					}
				}
				return newNoneResult();
			}
			case 'IfStatement': {
				const cond = evalExpr(env, statement.cond);
				asBoolValue(cond);
				if (cond.value) {
					return execBlock(env, statement.thenBlock);
				} else {
					return execBlock(env, statement.elseBlock);
				}
			}
			case 'VariableDecl': {
				throw new Error('not implemented yet'); // TODO
			}
			case 'AssignStatement': {
				if (statement.target.kind != 'Identifier') {
					throw new Error('not implemented yet'); // TODO
				}
				env.set(statement.target.name, evalExpr(env, statement.body));
				return newNoneResult();
			}
		}
	}
}

function evalExpr(env: Env, expr: ExprNode): Value {
	switch (expr.kind) {
		case 'Identifier': {
			const value = env.get(expr.name);
			if (value == null) {
				throw new Error('unknown identifier');
			}
			return value;
		}
		case 'NumberLiteral': {
			return newNumberValue(expr.value);
		}
		case 'BoolLiteral': {
			return newBoolValue(expr.value);
		}
		case 'StringLiteral': {
			return newStringValue(expr.value);
		}
		case 'BinaryOp':
		case 'Call':
		case 'UnaryOp': {
			throw new Error('not implemented yet'); // TODO
		}
	}
}

function execBlock(env: Env, block: StatementNode[]): StatementResult {
	for (const statement of block) {
		const result = execStatement(env, statement);
		if (result.kind == StatementResultKind.Return) {
			return result;
		} else if (result.kind == StatementResultKind.Break) {
			return result;
		}
	}
	return newNoneResult();
}
