import { StdoutCallback } from '.';
import * as builtins from './builtins';
import {
	AssignMode,
	ExprNode,
	FunctionDecl,
	isEquivalentOperator,
	isExprNode,
	isLogicalBinaryOperator,
	isOrderingOperator,
	SourceFile,
	StatementNode,
} from './syntax/ast';
import { Trace } from './trace';

const trace = Trace.getDefault().createChild(false);

export type Value = FunctionValue | NumberValue | BoolValue | StringValue | NoneValue;

export type NativeFuncHandler = (args: Value[]) => Value;

export type FunctionValue = {
	kind: 'FunctionValue',
	node: FunctionDecl,
	native: undefined,
	env: RunningEnv, // lexical scope
} | {
	kind: 'FunctionValue',
	node: undefined,
	native: NativeFuncHandler,
};

export function newFunction(node: FunctionDecl, env: RunningEnv): FunctionValue {
	return { kind: 'FunctionValue', node, env, native: undefined };
}
export function newNativeFunction(native: NativeFuncHandler): FunctionValue {
	return { kind: 'FunctionValue', native, node: undefined };
}
export function assertFunction(value: Value): asserts value is FunctionValue {
	if (value.kind != 'FunctionValue') {
		throw new Error(`type mismatched. expected \`fn\`, found \`${getTypeName(value)}\``);
	}
}

export type NumberValue = {
	kind: 'NumberValue',
	value: number,
};
export function newNumber(value: number): NumberValue {
	return { kind: 'NumberValue', value };
}
export function assertNumber(value: Value): asserts value is NumberValue {
	if (value.kind != 'NumberValue') {
		throw new Error(`type mismatched. expected \`number\`, found \`${getTypeName(value)}\``);
	}
}

export type BoolValue = {
	kind: 'BoolValue',
	value: boolean,
};
export function newBool(value: boolean): BoolValue {
	return { kind: 'BoolValue', value };
}
export function assertBool(value: Value): asserts value is BoolValue {
	if (value.kind != 'BoolValue') {
		throw new Error(`type mismatched. expected \`bool\`, found \`${getTypeName(value)}\``);
	}
}

export type StringValue = {
	kind: 'StringValue',
	value: string,
};
export function newString(value: string): StringValue {
	return { kind: 'StringValue', value };
}
export function assertString(value: Value): asserts value is StringValue {
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

type Symbol = { defined: true, value: Value } | { defined: false, value: undefined };

export class RunningEnv {
	layers: Map<string, Symbol>[];

	constructor(baseEnv?: RunningEnv) {
		if (baseEnv != null) {
			this.layers = [...baseEnv.layers];
		} else {
			this.layers = [new Map()];
		}
	}

	declare(name: string) {
		trace.log(`declare symbol: ${name}`);
		this.layers[0].set(name, { defined: false, value: undefined });
	}

	define(name: string, value: Value) {
		trace.log(`define symbol: ${name}`, value);
		this.layers[0].set(name, { defined: true, value });
	}

	get(name: string): Symbol | undefined {
		trace.log(`get symbol: ${name}`);
		for (const layer of this.layers) {
			const symbol = layer.get(name);
			if (symbol != null) {
				return symbol;
			}
		}
		return undefined;
	}

	enter() {
		trace.log(`enter scope`);
		this.layers.unshift(new Map());
	}

	leave() {
		trace.log(`leave scope`);
		if (this.layers.length <= 1) {
			throw new Error('Left the root layer.');
		}
		this.layers.shift();
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
	run(source: SourceFile, env: RunningEnv, stdout: StdoutCallback) {
		builtins.setRuntime(env, stdout);
		evalSourceFile(source, env);
		const symbol = env.get('main');
		if (symbol == null || !symbol.defined) {
			throw new Error('function `main` is not defined');
		}
		assertFunction(symbol.value);
		call(symbol.value, []);
	}
}

function evalSourceFile(source: SourceFile, env: RunningEnv) {
	for (const func of source.funcs) {
		env.declare(func.name);
	}
	for (const func of source.funcs) {
		env.define(func.name, newFunction(func, env));
	}
}

function call(func: FunctionValue, args: Value[]): Value {
	if (func.node != null) {
		const env = new RunningEnv(func.env);
		env.enter();
		if (func.node.params.length != args.length) {
			throw new Error('invalid arguments count');
		}
		let i = 0;
		while (i < func.node.params.length) {
			const param = func.node.params[i];
			const arg = args[i];
			env.define(param.name, arg);
			i++;
		}
		let result: StatementResult = newNoneResult();
		for (const statement of func.node.body) {
			result = execStatement(statement, env);
			if (result.kind == 'ReturnResult') {
				break;
			} else if (result.kind == 'BreakResult') {
				break;
			}
		}
		env.leave();
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

function execStatement(statement: StatementNode, env: RunningEnv): StatementResult {
	if (isExprNode(statement)) {
		evalExpr(statement, env);
		return newNoneResult();
	} else {
		switch (statement.kind) {
			case 'ReturnStatement': {
				trace.log('ReturnStatement');
				if (statement.expr != null) {
					return newReturnResult(evalExpr(statement.expr, env));
				} else {
					return newReturnResult(newNoneValue());
				}
			}
			case 'BreakStatement': {
				trace.log('BreakStatement');
				return newBreakResult();
			}
			case 'LoopStatement': {
				trace.log('LoopStatement');
				while (true) {
					const result = execBlock(statement.block, env);
					if (result.kind == 'ReturnResult') {
						return result;
					} else if (result.kind == 'BreakResult') {
						break;
					}
				}
				return newNoneResult();
			}
			case 'IfStatement': {
				trace.log('IfStatement');
				const cond = evalExpr(statement.cond, env);
				if (isNoneValue(cond)) {
					throw new Error('no values');
				}
				assertBool(cond);
				if (cond.value) {
					return execBlock(statement.thenBlock, env);
				} else {
					return execBlock(statement.elseBlock, env);
				}
			}
			case 'VariableDecl': {
				trace.log('VariableDecl');
				if (statement.body != null) {
					const bodyValue = evalExpr(statement.body, env);
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
				trace.log('AssignStatement');
				if (statement.target.kind != 'Identifier') {
					throw new Error('unsupported assignee');
				}
				const symbol = env.get(statement.target.name);
				if (symbol == null) {
					throw new Error('unknown identifier');
				}
				const bodyValue = evalExpr(statement.body, env);
				if (isNoneValue(bodyValue)) {
					throw new Error('no values');
				}
				switch (statement.mode) {
					case AssignMode.Assign: {
						symbol.value = bodyValue;
						break;
					}
					case AssignMode.AddAssign: {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new Error('variable is not defined');
						}
						assertNumber(restored.value);
						assertNumber(bodyValue);
						const value = newNumber(restored.value.value + bodyValue.value);
						symbol.value = value;
						break;
					}
					case AssignMode.SubAssign: {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new Error('variable is not defined');
						}
						assertNumber(restored.value);
						assertNumber(bodyValue);
						const value = newNumber(restored.value.value - bodyValue.value);
						symbol.value = value;
						break;
					}
					case AssignMode.MultAssign: {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new Error('variable is not defined');
						}
						assertNumber(restored.value);
						assertNumber(bodyValue);
						const value = newNumber(restored.value.value * bodyValue.value);
						symbol.value = value;
						break;
					}
					case AssignMode.DivAssign: {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new Error('variable is not defined');
						}
						assertNumber(restored.value);
						assertNumber(bodyValue);
						const value = newNumber(restored.value.value / bodyValue.value);
						symbol.value = value;
						break;
					}
					case AssignMode.ModAssign: {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new Error('variable is not defined');
						}
						assertNumber(restored.value);
						assertNumber(bodyValue);
						const value = newNumber(restored.value.value % bodyValue.value);
						symbol.value = value;
						break;
					}
				}
				symbol.defined = true;
				return newNoneResult();
			}
		}
	}
}

function evalExpr(expr: ExprNode, env: RunningEnv): Value {
	switch (expr.kind) {
		case 'Identifier': {
			trace.log('Identifier');
			const symbol = env.get(expr.name);
			if (symbol == null || !symbol.defined) {
				throw new Error(`identifier \`${expr.name}\` is not defined`);
			}
			return symbol.value;
		}
		case 'NumberLiteral': {
			trace.log('NumberLiteral');
			return newNumber(expr.value);
		}
		case 'BoolLiteral': {
			trace.log('BoolLiteral');
			return newBool(expr.value);
		}
		case 'StringLiteral': {
			trace.log('StringLiteral');
			return newString(expr.value);
		}
		case 'Call': {
			trace.log('Call');
			const callee = evalExpr(expr.callee, env);
			if (isNoneValue(callee)) {
				throw new Error('no values');
			}
			assertFunction(callee);
			const args = expr.args.map(i => {
				const value = evalExpr(i, env);
				if (isNoneValue(value)) {
					throw new Error('no values');
				}
				return value;
			});
			return call(callee, args);
		}
		case 'BinaryOp': {
			trace.log('BinaryOp');
			const left = evalExpr(expr.left, env);
			const right = evalExpr(expr.right, env);
			if (isNoneValue(left)) {
				throw new Error('no values');
			}
			if (isNoneValue(left)) {
				throw new Error('no values');
			}
			if (isLogicalBinaryOperator(expr.operator)) {
				// Logical Operation
				assertBool(left);
				assertBool(right);
				switch (expr.operator) {
					case '&&': {
						return newBool(left.value && right.value);
					}
					case '||': {
						return newBool(left.value || right.value);
					}
				}
			} else if (isEquivalentOperator(expr.operator)) {
				// Equivalent Operation
				switch (left.kind) {
					case 'NumberValue': {
						assertNumber(right);
						switch (expr.operator) {
							case '==': {
								return newBool(left.value == right.value);
							}
							case '!=': {
								return newBool(left.value != right.value);
							}
						}
						break;
					}
					case 'BoolValue': {
						assertBool(right);
						switch (expr.operator) {
							case '==': {
								return newBool(left.value == right.value);
							}
							case '!=': {
								return newBool(left.value != right.value);
							}
						}
						break;
					}
					case 'StringValue': {
						assertString(right);
						switch (expr.operator) {
							case '==': {
								return newBool(left.value == right.value);
							}
							case '!=': {
								return newBool(left.value != right.value);
							}
						}
						break;
					}
					case 'FunctionValue': {
						assertFunction(right);
						switch (expr.operator) {
							case '==': {
								return newBool(left.node == right.node);
							}
							case '!=': {
								return newBool(left.node != right.node);
							}
						}
						break;
					}
				}
			} else if (isOrderingOperator(expr.operator)) {
				// Ordering Operation
				switch (left.kind) {
					case 'NumberValue': {
						assertNumber(right);
						switch (expr.operator) {
							case '<': {
								return newBool(left.value < right.value);
							}
							case '<=': {
								return newBool(left.value <= right.value);
							}
							case '>': {
								return newBool(left.value > right.value);
							}
							case '>=': {
								return newBool(left.value >= right.value);
							}
						}
						break;
					}
					case 'BoolValue':
					case 'StringValue':
					case 'FunctionValue': {
						throw new Error(`type \`${getTypeName(left)}\` cannot be used to compare large and small relations.`);
					}
				}
			} else {
				// Arithmetic Operation
				assertNumber(left);
				assertNumber(right);
				switch (expr.operator) {
					case '+': {
						return newNumber(left.value + right.value);
					}
					case '-': {
						return newNumber(left.value - right.value);
					}
					case '*': {
						return newNumber(left.value * right.value);
					}
					case '/': {
						return newNumber(left.value / right.value);
					}
					case '%': {
						return newNumber(left.value % right.value);
					}
				}
			}
			throw new Error('unexpected operation');
		}
		case 'UnaryOp': {
			trace.log('UnaryOp');
			const value = evalExpr(expr.expr, env);
			if (isNoneValue(value)) {
				throw new Error('no values');
			}
			// Logical Operation
			assertBool(value);
			switch (expr.operator) {
				case '!': {
					return newBool(!value.value);
				}
			}
			throw new Error('unexpected operation');
		}
	}
}

function execBlock(block: StatementNode[], env: RunningEnv): StatementResult {
	trace.log('execBlock');
	env.enter();
	let result: StatementResult = newNoneResult();
	for (const statement of block) {
		result = execStatement(statement, env);
		if (result.kind == 'ReturnResult') {
			break;
		} else if (result.kind == 'BreakResult') {
			break;
		}
	}
	env.leave();
	return result;
}
