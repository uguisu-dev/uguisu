import { setBuiltinRuntimes } from '../builtins';
import { ExprNode, FunctionDecl, isExprNode, isLogicalBinaryOperator, isRelationalOperator, SourceFile, StatementNode } from './ast';

export type Value = FunctionValue | NumberValue | BoolValue | StringValue | NoneValue;

export type NativeFuncHandler = (args: Value[]) => Value;

export type FunctionValue = {
	kind: 'FunctionValue',
	node?: FunctionDecl,
	native?: NativeFuncHandler,
};
export function newFunctionValue(node: FunctionDecl): FunctionValue {
	return { kind: 'FunctionValue', node };
}
export function newNativeFunctionValue(native: NativeFuncHandler): FunctionValue {
	return { kind: 'FunctionValue', native };
}
export function asFunctionValue(value: Value): asserts value is FunctionValue {
	if (value.kind != 'FunctionValue') {
		throw new Error(`type mismatched. expected \`fn\`, found \`${getTypeName(value)}\``);
	}
}

export type NumberValue = {
	kind: 'NumberValue',
	value: number,
};
export function newNumberValue(value: number): NumberValue {
	return { kind: 'NumberValue', value };
}
export function asNumberValue(value: Value): asserts value is NumberValue {
	if (value.kind != 'NumberValue') {
		throw new Error(`type mismatched. expected \`number\`, found \`${getTypeName(value)}\``);
	}
}

export type BoolValue = {
	kind: 'BoolValue',
	value: boolean,
};
export function newBoolValue(value: boolean): BoolValue {
	return { kind: 'BoolValue', value };
}
export function asBoolValue(value: Value): asserts value is BoolValue {
	if (value.kind != 'BoolValue') {
		throw new Error(`type mismatched. expected \`bool\`, found \`${getTypeName(value)}\``);
	}
}

export type StringValue = {
	kind: 'StringValue',
	value: string,
};
export function newStringValue(value: string): StringValue {
	return { kind: 'StringValue', value };
}
export function asStringValue(value: Value): asserts value is StringValue {
	if (value.kind != 'StringValue') {
		throw new Error(`type mismatched. expected \`string\`, found \`${getTypeName(value)}\``);
	}
}

export type NoneValue = {
	kind: 'NoneValue',
}
export function newNoneValue(): NoneValue {
	return { kind: 'NoneValue' };
}
export function isNoneValue(value: Value): value is NoneValue {
	return (value.kind == 'NoneValue');
}

function getTypeName(value: Value): string {
	switch (value.kind) {
		case 'NoneValue': {
			return 'none';
		}
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

export class Env {
	frames: Map<string, Value>[];

	constructor() {
		this.frames = [new Map()];
	}

	set(name: string, value: Value) {
		this.frames[0].set(name, value);
	}

	get(name: string): Value | undefined {
		// TODO: lookup as static scope
		for (const frame of this.frames) {
			const value = frame.get(name);
			if (value != null) {
				return value;
			}
		}
		return undefined;
	}

	pushFrame() {
		this.frames.unshift(new Map());
	}

	popFrame() {
		this.frames.shift();
	}
}

export type StatementResult = NoneResult | ReturnResult | BreakResult;

export type NoneResult = {
	kind: 'NoneResult',
};
export function newNoneResult(): NoneResult {
	return { kind: 'NoneResult' };
}

export type ReturnResult = {
	kind: 'ReturnResult',
	value: Value,
};
export function newReturnResult(value: Value): ReturnResult {
	return { kind: 'ReturnResult', value };
}

export type BreakResult = {
	kind: 'BreakResult',
};
export function newBreakResult(): BreakResult {
	return { kind: 'BreakResult' };
}

export class Runner {
	source: SourceFile;
	env: Env;

	constructor(source: SourceFile) {
		this.source = source;
		this.env = new Env();
	}

	run() {
		setBuiltinRuntimes(this.env);
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

function callFunction(env: Env, func: FunctionValue, args: Value[]): Value {
	env.pushFrame();
	if (func.node != null) {
		if (func.node.params.length != args.length) {
			throw new Error('invalid arguments count');
		}
		let i = 0;
		while (i < func.node.params.length) {
			const param = func.node.params[i];
			const arg = args[i];
			env.set(param.name, arg);
			i++;
		}
		const result = execBlock(env, func.node.body);
		env.popFrame();

		if (result.kind == 'ReturnResult') {
			return result.value;
		}
		return newNoneValue();
	} else if (func.native != null) {
		return func.native(args);
	} else {
		throw new Error('invalid function');
	}
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
					return newReturnResult(newNoneValue());
				}
			}
			case 'BreakStatement': {
				return newBreakResult();
			}
			case 'LoopStatement': {
				while (true) {
					const result = execBlock(env, statement.block);
					if (result.kind == 'ReturnResult') {
						return result;
					} else if (result.kind == 'BreakResult') {
						break;
					}
				}
				return newNoneResult();
			}
			case 'IfStatement': {
				const cond = evalExpr(env, statement.cond);
				if (isNoneValue(cond)) {
					throw new Error('no values');
				}
				asBoolValue(cond);
				if (cond.value) {
					return execBlock(env, statement.thenBlock);
				} else {
					return execBlock(env, statement.elseBlock);
				}
			}
			case 'VariableDecl': {
				const body = statement.body;
				if (body == null) {
					// TODO: allow defining variables later
					throw new Error('variable not defined');
				}
				const value = evalExpr(env, body);
				if (isNoneValue(value)) {
					throw new Error('no values');
				}
				// TODO: consider symbol system
				env.set(statement.name, value);
				return newNoneResult();
			}
			case 'AssignStatement': {
				if (statement.target.kind != 'Identifier') {
					throw new Error('unsupported assignee');
				}
				const value = evalExpr(env, statement.body);
				if (isNoneValue(value)) {
					throw new Error('no values');
				}
				env.set(statement.target.name, value);
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
		case 'Call': {
			const callee = evalExpr(env, expr.callee);
			if (isNoneValue(callee)) {
				throw new Error('no values');
			}
			asFunctionValue(callee);
			const args = expr.args.map(i => {
				const value = evalExpr(env, i);
				if (isNoneValue(value)) {
					throw new Error('no values');
				}
				return value;
			});
			return callFunction(env, callee, args);
		}
		case 'BinaryOp': {
			const left = evalExpr(env, expr.left);
			const right = evalExpr(env, expr.right);
			if (isNoneValue(left)) {
				throw new Error('no values');
			}
			if (isNoneValue(left)) {
				throw new Error('no values');
			}
			if (isLogicalBinaryOperator(expr.operator)) {
				// Logical Operation
				asBoolValue(left);
				asBoolValue(right);
				switch (expr.operator) {
					case '&&': {
						return newBoolValue(left.value && right.value);
					}
					case '||': {
						return newBoolValue(left.value || right.value);
					}
				}
			} else if (isRelationalOperator(expr.operator)) {
				// Relational Operation
				switch (left.kind) {
					case 'NumberValue': {
						asNumberValue(right);
						switch (expr.operator) {
							// equivalent
							case '==': {
								return newBoolValue(left.value == right.value);
							}
							case '!=': {
								return newBoolValue(left.value != right.value);
							}
							// ordering
							case '<': {
								return newBoolValue(left.value < right.value);
							}
							case '<=': {
								return newBoolValue(left.value <= right.value);
							}
							case '>': {
								return newBoolValue(left.value > right.value);
							}
							case '>=': {
								return newBoolValue(left.value >= right.value);
							}
						}
						break;
					}
					case 'BoolValue': {
						asBoolValue(right);
						switch (expr.operator) {
							// equivalent
							case '==': {
								return newBoolValue(left.value == right.value);
							}
							case '!=': {
								return newBoolValue(left.value != right.value);
							}
							// ordering
							case '<':
							case '<=':
							case '>':
							case '>=': {
								throw new Error('type `bool` cannot be used to compare large and small relations.');
							}
						}
						break;
					}
					case 'StringValue': {
						asStringValue(right);
						switch (expr.operator) {
							// equivalent
							case '==': {
								return newBoolValue(left.value == right.value);
							}
							case '!=': {
								return newBoolValue(left.value != right.value);
							}
							// ordering
							case '<':
							case '<=':
							case '>':
							case '>=': {
								throw new Error('type `string` cannot be used to compare large and small relations.');
							}
						}
						break;
					}
					case 'FunctionValue': {
						asFunctionValue(right);
						switch (expr.operator) {
							// equivalent
							case '==': {
								return newBoolValue(left.node == right.node);
							}
							case '!=': {
								return newBoolValue(left.node != right.node);
							}
							// ordering
							case '<':
							case '<=':
							case '>':
							case '>=': {
								throw new Error('type `fn` cannot be used to compare large and small relations.');
							}
						}
					}
				}
			} else {
				// Arithmetic Operation
				asNumberValue(left);
				asNumberValue(right);
				switch (expr.operator) {
					case '+': {
						return newNumberValue(left.value + right.value);
					}
					case '-': {
						return newNumberValue(left.value - right.value);
					}
					case '*': {
						return newNumberValue(left.value * right.value);
					}
					case '/': {
						return newNumberValue(left.value / right.value);
					}
					case '%': {
						return newNumberValue(left.value % right.value);
					}
				}
			}
			throw new Error('unexpected operation');
		}
		case 'UnaryOp': {
			const value = evalExpr(env, expr.expr);
			if (isNoneValue(value)) {
				throw new Error('no values');
			}
			// Logical Operation
			asBoolValue(value);
			switch (expr.operator) {
				case '!': {
					return newBoolValue(!value.value);
				}
			}
			throw new Error('unexpected operation');
		}
	}
}

function execBlock(env: Env, block: StatementNode[]): StatementResult {
	for (const statement of block) {
		const result = execStatement(env, statement);
		if (result.kind == 'ReturnResult') {
			return result;
		} else if (result.kind == 'BreakResult') {
			return result;
		}
	}
	return newNoneResult();
}
