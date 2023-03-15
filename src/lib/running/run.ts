import { UguisuError } from '../misc/errors.js';
import { UguisuOptions } from '../misc/options.js';
import { Trace } from '../misc/trace.js';
import { ProjectInfo } from '../project-file.js';
import {
    ExprNode,
    isEquivalentOperator,
    isExprNode,
    isLogicalBinaryOperator,
    isOrderingOperator,
    SourceFile,
    StatementNode
} from '../syntax/tools.js';
import * as builtins from './builtins.js';
import {
    assertBool,
    assertFunction,
    assertNumber,
    assertString,
    FunctionValue,
    getTypeName,
    isNoneValue,
    newBool,
    newFunction,
    newNoneValue,
    newNumber,
    newString,
    RunningEnv,
    Value
} from './tools.js';

const trace = Trace.getDefault().createChild(false);

export function run(source: SourceFile, env: RunningEnv, options: UguisuOptions, projectInfo: ProjectInfo) {
    const r = new RunContext(env, options, projectInfo);
    builtins.setRuntime(env, options);
    evalSourceFile(r, source);
    call(r, 'main');
}

class RunContext {
    env: RunningEnv;
    options: UguisuOptions;
    projectInfo: ProjectInfo;

    constructor(env: RunningEnv, options: UguisuOptions, projectInfo: ProjectInfo) {
        this.env = env;
        this.options = options;
        this.projectInfo = projectInfo;
    }
}

function call(r: RunContext, name: string) {
    const symbol = r.env.get(name);
    if (symbol == null || !symbol.defined) {
        throw new UguisuError(`function \`${name}\` is not found`);
    }
    assertFunction(symbol.value);
    callFunc(r, symbol.value, []);
}

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

function evalSourceFile(r: RunContext, source: SourceFile) {
    for (const decl of source.funcs) {
        r.env.declare(decl.name);
    }
    for (const decl of source.funcs) {
        r.env.define(decl.name, newFunction(decl, r.env));
    }
    for (const decl of source.structs) {
        // TODO
    }
}

function callFunc(r: RunContext, func: FunctionValue, args: Value[]): Value {
    if (func.node != null) {
        const env = new RunningEnv(func.env);
        const ctx = new RunContext(env, r.options, r.projectInfo);
        ctx.env.enter();
        if (func.node.params.length != args.length) {
            throw new UguisuError('invalid arguments count');
        }
        let i = 0;
        while (i < func.node.params.length) {
            const param = func.node.params[i];
            const arg = args[i];
            ctx.env.define(param.name, arg);
            i++;
        }
        let result: StatementResult = newNoneResult();
        for (const statement of func.node.body) {
            result = execStatement(ctx, statement);
            if (result.kind == 'ReturnResult') {
                break;
            } else if (result.kind == 'BreakResult') {
                break;
            }
        }
        ctx.env.leave();
        if (result.kind == 'ReturnResult') {
            return result.value;
        }
        return newNoneValue();
    } else if (func.native != null) {
        return func.native(args, r.options);
    } else {
        throw new UguisuError('invalid function');
    }
}

function execBlock(r: RunContext, block: StatementNode[]): StatementResult {
    r.env.enter();
    let result: StatementResult = newNoneResult();
    for (const statement of block) {
        result = execStatement(r, statement);
        if (result.kind == 'ReturnResult') {
            break;
        } else if (result.kind == 'BreakResult') {
            break;
        }
    }
    r.env.leave();
    return result;
}

function execStatement(r: RunContext, statement: StatementNode): StatementResult {
    if (isExprNode(statement)) {
        evalExpr(r, statement);
        return newNoneResult();
    } else {
        switch (statement.kind) {
            case 'ReturnStatement': {
                if (statement.expr != null) {
                    return newReturnResult(evalExpr(r, statement.expr));
                } else {
                    return newReturnResult(newNoneValue());
                }
            }
            case 'BreakStatement': {
                return newBreakResult();
            }
            case 'LoopStatement': {
                while (true) {
                    const result = execBlock(r, statement.block);
                    if (result.kind == 'ReturnResult') {
                        return result;
                    } else if (result.kind == 'BreakResult') {
                        break;
                    }
                }
                return newNoneResult();
            }
            case 'IfStatement': {
                const cond = evalExpr(r, statement.cond);
                if (isNoneValue(cond)) {
                    throw new UguisuError('no values');
                }
                assertBool(cond);
                if (cond.value) {
                    return execBlock(r, statement.thenBlock);
                } else {
                    return execBlock(r, statement.elseBlock);
                }
            }
            case 'VariableDecl': {
                if (statement.body != null) {
                    const bodyValue = evalExpr(r, statement.body);
                    if (isNoneValue(bodyValue)) {
                        throw new UguisuError('no values');
                    }
                    r.env.define(statement.name, bodyValue);
                } else {
                    r.env.declare(statement.name);
                }
                return newNoneResult();
            }
            case 'AssignStatement': {
                if (statement.target.kind != 'Identifier') {
                    throw new UguisuError('unsupported assignee');
                }
                const symbol = r.env.get(statement.target.name);
                if (symbol == null) {
                    throw new UguisuError('unknown identifier');
                }
                const bodyValue = evalExpr(r, statement.body);
                if (isNoneValue(bodyValue)) {
                    throw new UguisuError('no values');
                }
                switch (statement.mode) {
                    case '=': {
                        symbol.value = bodyValue;
                        break;
                    }
                    case '+=': {
                        const restored = r.env.get(statement.target.name);
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
                        const restored = r.env.get(statement.target.name);
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
                        const restored = r.env.get(statement.target.name);
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
                        const restored = r.env.get(statement.target.name);
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
                        const restored = r.env.get(statement.target.name);
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

function evalExpr(r: RunContext, expr: ExprNode): Value {
    switch (expr.kind) {
        case 'Identifier': {
            const symbol = r.env.get(expr.name);
            if (symbol == null || !symbol.defined) {
                throw new UguisuError(`identifier \`${expr.name}\` is not defined`);
            }
            return symbol.value;
        }
        case 'NumberLiteral': {
            return newNumber(expr.value);
        }
        case 'BoolLiteral': {
            return newBool(expr.value);
        }
        case 'StringLiteral': {
            return newString(expr.value);
        }
        case 'Call': {
            const callee = evalExpr(r, expr.callee);
            if (isNoneValue(callee)) {
                throw new UguisuError('no values');
            }
            assertFunction(callee);
            const args = expr.args.map(i => {
                const value = evalExpr(r, i);
                if (isNoneValue(value)) {
                    throw new UguisuError('no values');
                }
                return value;
            });
            return callFunc(r, callee, args);
        }
        case 'BinaryOp': {
            const left = evalExpr(r, expr.left);
            const right = evalExpr(r, expr.right);
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
            const value = evalExpr(r, expr.expr);
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
        case 'StructExpr': {
            throw new UguisuError('not implemented yet.'); // TODO
        }
        case 'FieldAccess': {
            throw new UguisuError('not implemented yet.'); // TODO
        }
    }
}
