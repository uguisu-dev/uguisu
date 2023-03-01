import { setBuiltinRuntimes } from './builtins';
import {
	AssignMode,
	ExprNode,
	FunctionDecl,
	isExprNode,
	isLogicalBinaryOperator,
	isRelationalOperator,
	SourceFile,
	StatementNode,
} from './syntax/ast';

export type Value = FunctionValue | NumberValue | BoolValue | StringValue | NoneValue;

export type NativeFuncHandler = (args: Value[]) => Value;

export type FunctionValue = {
	kind: 'FunctionValue',
	node: FunctionDecl,
	native: undefined,
	env: Env,
} | {
	kind: 'FunctionValue',
	node: undefined,
	native: NativeFuncHandler,
};

export function newFunctionValue(node: FunctionDecl, env: Env): FunctionValue {
	return { kind: 'FunctionValue', node, native: undefined, env };
}
export function newNativeFunctionValue(native: NativeFuncHandler): FunctionValue {
	return { kind: 'FunctionValue', node: undefined, native };
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

type Symbol = { defined: true, value: Value } | { defined: false };

export class Env {
	private table: Map<string, Symbol>;

	constructor(baseEnv?: Env) {
		if (baseEnv != null) {
			this.table = new Map(baseEnv.table);
		} else {
			this.table = new Map();
		}
	}

	declare(name: string) {
		this.table.set(name, { defined: false });
	}

	define(name: string, value: Value) {
		this.table.set(name, { defined: true, value });
	}

	get(name: string): Symbol | undefined {
		return this.table.get(name);
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
	env: Env;

	constructor() {
		this.env = new Env();
	}

	run(source: SourceFile) {
		setBuiltinRuntimes(this.env);
		evalSourceFile(this.env, source);
		const symbol = this.env.get('main');
		if (symbol == null || !symbol.defined) {
			throw new Error('function `main` is not defined');
		}
		asFunctionValue(symbol.value);
		callFunction(symbol.value, []);
	}
}

function evalSourceFile(env: Env, source: SourceFile) {
	for (const func of source.funcs) {
		env.define(func.name, newFunctionValue(func, env));
	}
}

function callFunction(func: FunctionValue, args: Value[]): Value {
	if (func.node != null) {
		const childEnv = new Env(func.env);
		if (func.node.params.length != args.length) {
			throw new Error('invalid arguments count');
		}
		let i = 0;
		while (i < func.node.params.length) {
			const param = func.node.params[i];
			const arg = args[i];
			childEnv.define(param.name, arg);
			i++;
		}
		const result = execBlock(childEnv, func.node.body);
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
				if (statement.body != null) {
					const bodyValue = evalExpr(env, statement.body);
					if (isNoneValue(bodyValue)) {
						throw new Error('no values');
					}
					// TODO: consider symbol system
					env.define(statement.name, bodyValue);
				} else {
					env.declare(statement.name);
				}
				return newNoneResult();
			}
			case 'AssignStatement': {
				if (statement.target.kind != 'Identifier') {
					throw new Error('unsupported assignee');
				}
				const bodyValue = evalExpr(env, statement.body);
				if (isNoneValue(bodyValue)) {
					throw new Error('no values');
				}
				switch (statement.mode) {
					case AssignMode.Assign: {
						env.define(statement.target.name, bodyValue);
						break;
					}
					case AssignMode.AddAssign: {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new Error('variable is not defined');
						}
						asNumberValue(restored.value);
						asNumberValue(bodyValue);
						const value = newNumberValue(restored.value.value + bodyValue.value);
						env.define(statement.target.name, value);
						break;
					}
					case AssignMode.SubAssign: {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new Error('variable is not defined');
						}
						asNumberValue(restored.value);
						asNumberValue(bodyValue);
						const value = newNumberValue(restored.value.value - bodyValue.value);
						env.define(statement.target.name, value);
						break;
					}
					case AssignMode.MultAssign: {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new Error('variable is not defined');
						}
						asNumberValue(restored.value);
						asNumberValue(bodyValue);
						const value = newNumberValue(restored.value.value * bodyValue.value);
						env.define(statement.target.name, value);
						break;
					}
					case AssignMode.DivAssign: {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new Error('variable is not defined');
						}
						asNumberValue(restored.value);
						asNumberValue(bodyValue);
						const value = newNumberValue(restored.value.value / bodyValue.value);
						env.define(statement.target.name, value);
						break;
					}
					case AssignMode.ModAssign: {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new Error('variable is not defined');
						}
						asNumberValue(restored.value);
						asNumberValue(bodyValue);
						const value = newNumberValue(restored.value.value % bodyValue.value);
						env.define(statement.target.name, value);
						break;
					}
				}
				return newNoneResult();
			}
		}
	}
}

function evalExpr(env: Env, expr: ExprNode): Value {
	switch (expr.kind) {
		case 'Identifier': {
			const symbol = env.get(expr.name);
			if (symbol == null || !symbol.defined) {
				throw new Error(`identifier \`${expr.name}\` is not defined`);
			}
			return symbol.value;
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
			return callFunction(callee, args);
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
