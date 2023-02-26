import { ExprNode, FunctionDecl, isExprNode, isLogicalBinaryOperator, isRelationalOperator, SourceFile, StatementNode } from './ast';

export type Value = FunctionValue | NumberValue | BoolValue | StringValue;

export type FunctionValue = {
	kind: 'FunctionValue',
	node: FunctionDecl;
};
export function newFunctionValue(node: FunctionDecl): FunctionValue {
	return { kind: 'FunctionValue', node };
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
				if (cond == null) {
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
				if (value == null) {
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
				if (value == null) {
					throw new Error('no values');
				}
				env.set(statement.target.name, value);
				return newNoneResult();
			}
		}
	}
}

function evalExpr(env: Env, expr: ExprNode): Value | undefined {
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
			if (callee == null) {
				throw new Error('no values');
			}
			asFunctionValue(callee);
			const args = expr.args.map(i => {
				const value = evalExpr(env, i);
				if (value == null) {
					throw new Error('no values');
				}
				return value;
			});
			return callFunction(env, callee, args);
		}
		case 'BinaryOp': {
			const left = evalExpr(env, expr.left);
			const right = evalExpr(env, expr.right);
			if (left == null) {
				throw new Error('no values');
			}
			if (right == null) {
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
			if (value == null) {
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
		if (result.kind == StatementResultKind.Return) {
			return result;
		} else if (result.kind == StatementResultKind.Break) {
			return result;
		}
	}
	return newNoneResult();
}
