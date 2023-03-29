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
    assertValue,
    BoolValue,
    createBreakResult,
    createOkResult,
    createReturnResult,
    FunctionValue,
    getTypeName,
    NoneValue,
    NumberValue,
    RunningEnv,
    StatementResult,
    StringValue,
    StructValue,
    Symbol,
    Value
} from './tools.js';

const trace = Trace.getDefault().createChild(false);

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

export function run(source: SourceFile, env: RunningEnv, options: UguisuOptions, projectInfo: ProjectInfo) {
    const r = new RunContext(env, options, projectInfo);
    builtins.setRuntime(r.env, options);
    evalSourceFile(r, source);
    const entryPoint = getEntryPoint(r);
    call(r, entryPoint, []);
}

function getEntryPoint(r: RunContext): FunctionValue {
    const entryPointName = 'main';
    const symbol = r.env.lookup(entryPointName);
    if (symbol == null) {
        throw new UguisuError(`function \`${entryPointName}\` is not found`);
    }
    if (symbol.value == null) {
        throw new UguisuError(`function \`${entryPointName}\` is not defined`);
    }
    assertValue(symbol.value, 'FunctionValue');
    return symbol.value;
}

function call(r: RunContext, func: FunctionValue, args: Value[]): Value {
    if (func.user != null) {
        const env = new RunningEnv(func.user.env);
        const ctx = new RunContext(env, r.options, r.projectInfo);
        ctx.env.enter();
        if (func.user.node.params.length != args.length) {
            throw new UguisuError('invalid arguments count');
        }
        for (let i = 0; i < func.user.node.params.length; i++) {
            const param = func.user.node.params[i];
            const arg = args[i];
            ctx.env.declare(param.name, arg);
        }
        let result: StatementResult = createOkResult();
        for (const statement of func.user.node.body) {
            result = evalStatement(ctx, statement);
            if (result.kind == 'return') {
                break;
            } else if (result.kind == 'break') {
                break;
            }
        }
        ctx.env.leave();
        if (result.kind == 'return') {
            return result.value;
        }
        return new NoneValue();
    } else if (func.native != null) {
        return func.native(args, r.options);
    } else {
        throw new UguisuError('invalid function');
    }
}

function evalSourceFile(r: RunContext, source: SourceFile) {
    for (const decl of source.decls) {
        switch (decl.kind) {
            case 'FunctionDecl': {
                r.env.declare(decl.name, FunctionValue.create(decl, r.env));
                break;
            }
            case 'StructDecl': {
                break;
            }
        }
    }
}

function evalBlock(r: RunContext, block: StatementNode[]): StatementResult {
    r.env.enter();
    let result: StatementResult = createOkResult();
    for (const statement of block) {
        result = evalStatement(r, statement);
        if (result.kind == 'return') {
            break;
        } else if (result.kind == 'break') {
            break;
        }
    }
    r.env.leave();
    return result;
}

function evalName(r: RunContext, expr: ExprNode): Symbol {
    switch (expr.kind) {
        case 'Identifier': {
            const symbol = r.env.lookup(expr.name);
            if (symbol == null) {
                throw new UguisuError(`identifier \`${expr.name}\` is not defined`);
            }
            return symbol;
        }
        case 'FieldAccess': {
            const target = evalExpr(r, expr.target);
            assertValue(target, 'StructValue');
            const field = target.lookupField(expr.name);
            if (field == null) {
                throw new UguisuError('unknown field');
            }
            return field;
        }
        case 'IndexAccess': {
            throw new UguisuError('not implemented yet'); // TODO
        }
        default: {
            throw new UguisuError('unexpected expression');
        }
    }
}

function evalStatement(r: RunContext, statement: StatementNode): StatementResult {
    if (isExprNode(statement)) {
        evalExpr(r, statement);
        return createOkResult();
    } else {
        switch (statement.kind) {
            case 'ReturnStatement': {
                if (statement.expr != null) {
                    return createReturnResult(evalExpr(r, statement.expr));
                } else {
                    return createReturnResult(new NoneValue());
                }
            }
            case 'BreakStatement': {
                return createBreakResult();
            }
            case 'LoopStatement': {
                while (true) {
                    const result = evalBlock(r, statement.block);
                    if (result.kind == 'return') {
                        return result;
                    } else if (result.kind == 'break') {
                        break;
                    }
                }
                return createOkResult();
            }
            case 'IfStatement': {
                const cond = evalExpr(r, statement.cond);
                assertValue(cond, 'BoolValue');
                if (cond.getValue()) {
                    return evalBlock(r, statement.thenBlock);
                } else {
                    return evalBlock(r, statement.elseBlock);
                }
            }
            case 'VariableDecl': {
                if (statement.body != null) {
                    const bodyValue = evalExpr(r, statement.body);
                    if (bodyValue.kind == 'NoneValue') {
                        throw new UguisuError('no values');
                    }
                    r.env.declare(statement.name, bodyValue);
                } else {
                    r.env.declare(statement.name);
                }
                return createOkResult();
            }
            case 'AssignStatement': {
                let symbol;
                // TODO: support IndexAccess
                if (statement.target.kind == 'Identifier' || statement.target.kind == 'FieldAccess') {
                    symbol = evalName(r, statement.target);
                } else {
                    throw new UguisuError('unsupported assign target');
                }
                const bodyValue = evalExpr(r, statement.body);
                if (bodyValue.kind == 'NoneValue') {
                    throw new UguisuError('no values');
                }
                switch (statement.mode) {
                    case '=': {
                        symbol.value = bodyValue;
                        break;
                    }
                    case '+=': {
                        const restored = r.env.lookup(statement.target.name);
                        if (restored == null || restored.value == null) {
                            throw new UguisuError('variable is not defined');
                        }
                        assertValue(restored.value, 'NumberValue');
                        assertValue(bodyValue, 'NumberValue');
                        const value = new NumberValue(restored.value.getValue() + bodyValue.getValue());
                        symbol.value = value;
                        break;
                    }
                    case '-=': {
                        const restored = r.env.lookup(statement.target.name);
                        if (restored == null || restored.value == null) {
                            throw new UguisuError('variable is not defined');
                        }
                        assertValue(restored.value, 'NumberValue');
                        assertValue(bodyValue, 'NumberValue');
                        const value = new NumberValue(restored.value.getValue() - bodyValue.getValue());
                        symbol.value = value;
                        break;
                    }
                    case '*=': {
                        const restored = r.env.lookup(statement.target.name);
                        if (restored == null || restored.value == null) {
                            throw new UguisuError('variable is not defined');
                        }
                        assertValue(restored.value, 'NumberValue');
                        assertValue(bodyValue, 'NumberValue');
                        const value = new NumberValue(restored.value.getValue() * bodyValue.getValue());
                        symbol.value = value;
                        break;
                    }
                    case '/=': {
                        const restored = r.env.lookup(statement.target.name);
                        if (restored == null || restored.value == null) {
                            throw new UguisuError('variable is not defined');
                        }
                        assertValue(restored.value, 'NumberValue');
                        assertValue(bodyValue, 'NumberValue');
                        const value = new NumberValue(restored.value.getValue() / bodyValue.getValue());
                        symbol.value = value;
                        break;
                    }
                    case '%=': {
                        const restored = r.env.lookup(statement.target.name);
                        if (restored == null || restored.value == null) {
                            throw new UguisuError('variable is not defined');
                        }
                        assertValue(restored.value, 'NumberValue');
                        assertValue(bodyValue, 'NumberValue');
                        const value = new NumberValue(restored.value.getValue() % bodyValue.getValue());
                        symbol.value = value;
                        break;
                    }
                }
                return createOkResult();
            }
        }
    }
}

function evalExpr(r: RunContext, expr: ExprNode): Value {
    switch (expr.kind) {
        case 'Identifier': {
            const symbol = evalName(r, expr);
            if (symbol.value == null) {
                throw new UguisuError(`identifier \`${expr.name}\` is not defined`);
            }
            return symbol.value;
        }
        case 'FieldAccess': {
            const field = evalName(r, expr);
            if (field.value == null) {
                throw new UguisuError('field not defined');
            }
            return field.value;
        }
        case 'IndexAccess': {
            const symbol = evalName(r, expr);
            if (symbol.value == null) {
                throw new UguisuError('symbol not defined');
            }
            return symbol.value;
        }
        case 'NumberLiteral': {
            return new NumberValue(expr.value);
        }
        case 'BoolLiteral': {
            return new BoolValue(expr.value);
        }
        case 'StringLiteral': {
            return new StringValue(expr.value);
        }
        case 'Call': {
            const callee = evalExpr(r, expr.callee);
            assertValue(callee, 'FunctionValue');
            const args = expr.args.map(i => {
                const value = evalExpr(r, i);
                if (value.kind == 'NoneValue') {
                    throw new UguisuError('no values');
                }
                return value;
            });
            return call(r, callee, args);
        }
        case 'BinaryOp': {
            const left = evalExpr(r, expr.left);
            const right = evalExpr(r, expr.right);
            if (left.kind == 'NoneValue') {
                throw new UguisuError('no values');
            }
            if (right.kind == 'NoneValue') {
                throw new UguisuError('no values');
            }
            if (isLogicalBinaryOperator(expr.operator)) {
                // Logical Operation
                assertValue(left, 'BoolValue');
                assertValue(right, 'BoolValue');
                switch (expr.operator) {
                    case '&&': {
                        return new BoolValue(left.getValue() && right.getValue());
                    }
                    case '||': {
                        return new BoolValue(left.getValue() || right.getValue());
                    }
                }
                throw new UguisuError('unexpected operation');
            } else if (isEquivalentOperator(expr.operator)) {
                // Equivalent Operation
                switch (left.kind) {
                    case 'NumberValue': {
                        assertValue(right, 'NumberValue');
                        switch (expr.operator) {
                            case '==': {
                                return new BoolValue(left.getValue() == right.getValue());
                            }
                            case '!=': {
                                return new BoolValue(left.getValue() != right.getValue());
                            }
                        }
                        break;
                    }
                    case 'BoolValue': {
                        assertValue(right, 'BoolValue');
                        switch (expr.operator) {
                            case '==': {
                                return new BoolValue(left.getValue() == right.getValue());
                            }
                            case '!=': {
                                return new BoolValue(left.getValue() != right.getValue());
                            }
                        }
                        break;
                    }
                    case 'StringValue': {
                        assertValue(right, 'StringValue');
                        switch (expr.operator) {
                            case '==': {
                                return new BoolValue(left.getValue() == right.getValue());
                            }
                            case '!=': {
                                return new BoolValue(left.getValue() != right.getValue());
                            }
                        }
                        break;
                    }
                    case 'FunctionValue': {
                        function equalFunc(left: FunctionValue, right: FunctionValue): boolean {
                            if ((left.user != null) && (right.user != null)) {
                                return (left.user.node == right.user.node);
                            }
                            if ((left.native != null) && (right.native != null)) {
                                return (left.native == right.native);
                            }
                            return (false);
                        }
                        assertValue(right, 'FunctionValue');
                        switch (expr.operator) {
                            case '==': {
                                return new BoolValue(equalFunc(left, right));
                            }
                            case '!=': {
                                return new BoolValue(!equalFunc(left, right));
                            }
                        }
                        break;
                    }
                    case 'StructValue': {
                        throw new UguisuError(`type \`${getTypeName(left.kind)}\` cannot be used for equivalence comparisons.`);
                        break;
                    }
                }
                throw new UguisuError('unexpected operation');
            } else if (isOrderingOperator(expr.operator)) {
                // Ordering Operation
                switch (left.kind) {
                    case 'NumberValue': {
                        assertValue(right, 'NumberValue');
                        switch (expr.operator) {
                            case '<': {
                                return new BoolValue(left.getValue() < right.getValue());
                            }
                            case '<=': {
                                return new BoolValue(left.getValue() <= right.getValue());
                            }
                            case '>': {
                                return new BoolValue(left.getValue() > right.getValue());
                            }
                            case '>=': {
                                return new BoolValue(left.getValue() >= right.getValue());
                            }
                        }
                        break;
                    }
                    case 'BoolValue':
                    case 'StringValue':
                    case 'FunctionValue':
                    case 'StructValue': {
                        throw new UguisuError(`type \`${getTypeName(left.kind)}\` cannot be used to compare large and small relations.`);
                    }
                }
            } else {
                // Arithmetic Operation
                assertValue(left, 'NumberValue');
                assertValue(right, 'NumberValue');
                switch (expr.operator) {
                    case '+': {
                        return new NumberValue(left.getValue() + right.getValue());
                    }
                    case '-': {
                        return new NumberValue(left.getValue() - right.getValue());
                    }
                    case '*': {
                        return new NumberValue(left.getValue() * right.getValue());
                    }
                    case '/': {
                        return new NumberValue(left.getValue() / right.getValue());
                    }
                    case '%': {
                        return new NumberValue(left.getValue() % right.getValue());
                    }
                }
            }
            throw new UguisuError('unexpected operation');
        }
        case 'UnaryOp': {
            const value = evalExpr(r, expr.expr);
            // Logical Operation
            assertValue(value, 'BoolValue');
            switch (expr.operator) {
                case '!': {
                    return new BoolValue(!value.getValue());
                }
            }
            throw new UguisuError('unexpected operation');
        }
        case 'StructExpr': {
            const fields = new Map<string, Symbol>();
            for (const field of expr.fields) {
                const value = evalExpr(r, field.body);
                const symbol = new Symbol(value);
                fields.set(field.name, symbol);
            }
            return new StructValue(fields);
        }
        case 'ArrayNode': {
            throw new UguisuError('not implemented yet'); // TODO
        }
    }
}
