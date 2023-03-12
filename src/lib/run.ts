import { UguisuError, UguisuOptions } from './index.js';
import * as builtins from './builtins.js';
import {
	ExprNode,
	FunctionDecl,
	isEquivalentOperator,
	isExprNode,
	isLogicalBinaryOperator,
	isOrderingOperator,
	SourceFile,
	StatementNode,
} from './ast.js';
import { Trace } from './misc/trace.js';

const trace = Trace.getDefault().createChild(false);

export class Runner {
	env: RunningEnv;
	options: UguisuOptions;

	constructor(options: UguisuOptions) {
		this.env = new RunningEnv();
		this.options = options;
	}

	run(source: SourceFile) {
		builtins.setRuntime(this.env, this.options);
		evalSourceFile(source, this.env);
		this.call('main');
	}

	call(name: string) {
		const symbol = this.env.get(name);
		if (symbol == null || !symbol.defined) {
			throw new UguisuError(`function \`${name}\` is not found`);
		}
		assertFunction(symbol.value);
		call(symbol.value, [], this.options);
	}
}

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
			throw new UguisuError('Left the root layer.');
		}
		this.layers.shift();
	}
}

export type Symbol = { defined: true, value: Value } | { defined: false, value: undefined };

//#region Values

export type Value = FunctionValue | NumberValue | BoolValue | StringValue | NoneValue;

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

export type NativeFuncHandler = (args: Value[], options: UguisuOptions) => Value;

export function newFunction(node: FunctionDecl, env: RunningEnv): FunctionValue {
	return { kind: 'FunctionValue', node, env, native: undefined };
}
export function newNativeFunction(native: NativeFuncHandler): FunctionValue {
	return { kind: 'FunctionValue', native, node: undefined };
}
export function assertFunction(value: Value): asserts value is FunctionValue {
	if (value.kind != 'FunctionValue') {
		throw new UguisuError(`type mismatched. expected \`fn\`, found \`${getTypeName(value)}\``);
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
		throw new UguisuError(`type mismatched. expected \`number\`, found \`${getTypeName(value)}\``);
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
		throw new UguisuError(`type mismatched. expected \`bool\`, found \`${getTypeName(value)}\``);
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
		throw new UguisuError(`type mismatched. expected \`string\`, found \`${getTypeName(value)}\``);
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

//#endregion Values

//#region StatementResults

type StatementResult = NoneResult | ReturnResult | BreakResult;

type NoneResult = {
	kind: 'NoneResult',
};
function newNoneResult(): NoneResult {
	return { kind: 'NoneResult' };
}

type ReturnResult = {
	kind: 'ReturnResult',
	value: Value,
};
function newReturnResult(value: Value): ReturnResult {
	return { kind: 'ReturnResult', value };
}

type BreakResult = {
	kind: 'BreakResult',
};
function newBreakResult(): BreakResult {
	return { kind: 'BreakResult' };
}

//#endregion StatementResults

function evalSourceFile(source: SourceFile, env: RunningEnv) {
	for (const func of source.funcs) {
		env.declare(func.name);
	}
	for (const func of source.funcs) {
		env.define(func.name, newFunction(func, env));
	}
}

function call(func: FunctionValue, args: Value[], options: UguisuOptions): Value {
	if (func.node != null) {
		const env = new RunningEnv(func.env);
		env.enter();
		if (func.node.params.length != args.length) {
			throw new UguisuError('invalid arguments count');
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
			result = execStatement(statement, env, options);
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
		return func.native(args, options);
	} else {
		throw new UguisuError('invalid function');
	}
}

function execBlock(block: StatementNode[], env: RunningEnv, options: UguisuOptions): StatementResult {
	trace.log('execBlock');
	env.enter();
	let result: StatementResult = newNoneResult();
	for (const statement of block) {
		result = execStatement(statement, env, options);
		if (result.kind == 'ReturnResult') {
			break;
		} else if (result.kind == 'BreakResult') {
			break;
		}
	}
	env.leave();
	return result;
}

function execStatement(statement: StatementNode, env: RunningEnv, options: UguisuOptions): StatementResult {
	if (isExprNode(statement)) {
		evalExpr(statement, env, options);
		return newNoneResult();
	} else {
		switch (statement.kind) {
			case 'ReturnStatement': {
				trace.log('ReturnStatement');
				if (statement.expr != null) {
					return newReturnResult(evalExpr(statement.expr, env, options));
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
					const result = execBlock(statement.block, env, options);
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
				const cond = evalExpr(statement.cond, env, options);
				if (isNoneValue(cond)) {
					throw new UguisuError('no values');
				}
				assertBool(cond);
				if (cond.value) {
					return execBlock(statement.thenBlock, env, options);
				} else {
					return execBlock(statement.elseBlock, env, options);
				}
			}
			case 'VariableDecl': {
				trace.log('VariableDecl');
				if (statement.body != null) {
					const bodyValue = evalExpr(statement.body, env, options);
					if (isNoneValue(bodyValue)) {
						throw new UguisuError('no values');
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
					throw new UguisuError('unsupported assignee');
				}
				const symbol = env.get(statement.target.name);
				if (symbol == null) {
					throw new UguisuError('unknown identifier');
				}
				const bodyValue = evalExpr(statement.body, env, options);
				if (isNoneValue(bodyValue)) {
					throw new UguisuError('no values');
				}
				switch (statement.mode) {
					case '=': {
						symbol.value = bodyValue;
						break;
					}
					case '+=': {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new UguisuError('variable is not defined');
						}
						assertNumber(restored.value);
						assertNumber(bodyValue);
						const value = newNumber(restored.value.value + bodyValue.value);
						symbol.value = value;
						break;
					}
					case '-=': {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new UguisuError('variable is not defined');
						}
						assertNumber(restored.value);
						assertNumber(bodyValue);
						const value = newNumber(restored.value.value - bodyValue.value);
						symbol.value = value;
						break;
					}
					case '*=': {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new UguisuError('variable is not defined');
						}
						assertNumber(restored.value);
						assertNumber(bodyValue);
						const value = newNumber(restored.value.value * bodyValue.value);
						symbol.value = value;
						break;
					}
					case '/=': {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new UguisuError('variable is not defined');
						}
						assertNumber(restored.value);
						assertNumber(bodyValue);
						const value = newNumber(restored.value.value / bodyValue.value);
						symbol.value = value;
						break;
					}
					case '%=': {
						const restored = env.get(statement.target.name);
						if (restored == null || !restored.defined) {
							throw new UguisuError('variable is not defined');
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

function evalExpr(expr: ExprNode, env: RunningEnv, options: UguisuOptions): Value {
	switch (expr.kind) {
		case 'Identifier': {
			trace.log('Identifier');
			const symbol = env.get(expr.name);
			if (symbol == null || !symbol.defined) {
				throw new UguisuError(`identifier \`${expr.name}\` is not defined`);
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
			const callee = evalExpr(expr.callee, env, options);
			if (isNoneValue(callee)) {
				throw new UguisuError('no values');
			}
			assertFunction(callee);
			const args = expr.args.map(i => {
				const value = evalExpr(i, env, options);
				if (isNoneValue(value)) {
					throw new UguisuError('no values');
				}
				return value;
			});
			return call(callee, args, options);
		}
		case 'BinaryOp': {
			trace.log('BinaryOp');
			const left = evalExpr(expr.left, env, options);
			const right = evalExpr(expr.right, env, options);
			if (isNoneValue(left)) {
				throw new UguisuError('no values');
			}
			if (isNoneValue(left)) {
				throw new UguisuError('no values');
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
						throw new UguisuError(`type \`${getTypeName(left)}\` cannot be used to compare large and small relations.`);
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
			throw new UguisuError('unexpected operation');
		}
		case 'UnaryOp': {
			trace.log('UnaryOp');
			const value = evalExpr(expr.expr, env, options);
			if (isNoneValue(value)) {
				throw new UguisuError('no values');
			}
			// Logical Operation
			assertBool(value);
			switch (expr.operator) {
				case '!': {
					return newBool(!value.value);
				}
			}
			throw new UguisuError('unexpected operation');
		}
	}
}
