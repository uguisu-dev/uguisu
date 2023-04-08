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
    StatementNode,
    StepNode
} from '../syntax/tools.js';
import * as builtins from './builtins.js';
import {
    ArrayValue,
    assertValue,
    BoolValue,
    CharValue,
    createBreakResult,
    createOkResult,
    createReturnResult,
    EvalResult,
    FunctionValue,
    getTypeName,
    isOkResult,
    NoneValue,
    NumberValue,
    RunningEnv,
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
        let result: EvalResult<Value> = createOkResult(new NoneValue());
        for (const step of func.user.node.body) {
            if (isExprNode(step)) {
                result = evalExpr(ctx, step);
            } else {
                result = evalStatement(ctx, step);
            }
            if (!isOkResult(result)) {
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

function evalBlock(r: RunContext, block: StepNode[]): EvalResult<Value> {
    r.env.enter();

    let result: EvalResult<Value> = createOkResult(new NoneValue());
    for (let i = 0; i < block.length; i++) {
        const step = block[i];

        if (isExprNode(step)) {
            const stepResult = evalExpr(r, step);
            if (!isOkResult(stepResult)) {
                return stepResult;
            }
            const isFinalStep = (i == block.length - 1);
            if (isFinalStep) {
                result = createOkResult(stepResult.value);
            } else {
                // ignore the value
            }
        } else {
            result = evalStatement(r, step);
            if (result.kind == 'return') {
                break;
            } else if (result.kind == 'break') {
                break;
            }
        }
    }

    r.env.leave();

    return result;
}

function evalReferenceExpr(r: RunContext, expr: ExprNode): EvalResult<Symbol> {
    switch (expr.kind) {
        case 'Identifier': {
            const symbol = r.env.lookup(expr.name);
            if (symbol == null) {
                throw new UguisuError(`identifier \`${expr.name}\` is not defined`);
            }
            return createOkResult(symbol);
        }
        case 'FieldAccess': {
            const target = evalExpr(r, expr.target);
            if (!isOkResult(target)) {
                return target;
            }
            assertValue(target.value, 'StructValue');
            const field = target.value.lookupField(expr.name);
            if (field == null) {
                throw new UguisuError('unknown field');
            }
            return createOkResult(field);
        }
        case 'IndexAccess': {
            const target = evalExpr(r, expr.target);
            const index = evalExpr(r, expr.index);
            if (!isOkResult(target)) {
                return target;
            }
            if (!isOkResult(index)) {
                return index;
            }
            assertValue(target.value, 'ArrayValue');
            assertValue(index.value, 'NumberValue');
            const symbol = target.value.at(index.value.getValue());
            if (symbol == null) {
                throw new UguisuError('index out of range');
            }
            return createOkResult(symbol);
        }
        default: {
            throw new UguisuError('unexpected expression');
        }
    }
}

function evalStatement(r: RunContext, statement: StatementNode): EvalResult<Value> {
    switch (statement.kind) {
        case 'ExprStatement': {
            // TODO
            evalExpr(r, statement.expr);
            return createOkResult(new NoneValue());
        }
        case 'ReturnStatement': {
            if (statement.expr != null) {
                const result = evalExpr(r, statement.expr);
                if (isOkResult(result)) {
                    return createReturnResult(result.value);
                } else {
                    return result;
                }
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
            return createOkResult(new NoneValue());
        }
        case 'VariableDecl': {
            if (statement.body != null) {
                const body = evalExpr(r, statement.body);
                if (!isOkResult(body)) {
                    return body;
                }
                if (body.value.kind == 'NoneValue') {
                    throw new UguisuError('no values');
                }
                r.env.declare(statement.name, body.value);
            } else {
                r.env.declare(statement.name);
            }
            return createOkResult(new NoneValue());
        }
        case 'AssignStatement': {
            let target;
            if (statement.target.kind == 'Identifier' || statement.target.kind == 'FieldAccess' || statement.target.kind == 'IndexAccess') {
                target = evalReferenceExpr(r, statement.target);
                if (!isOkResult(target)) {
                    return target;
                }
            } else {
                throw new UguisuError('unsupported assign target');
            }
            const symbol = target.value;
            const body = evalExpr(r, statement.body);
            if (!isOkResult(body)) {
                return body;
            }
            if (body.value.kind == 'NoneValue') {
                throw new UguisuError('no values');
            }
            switch (statement.mode) {
                case '=': {
                    symbol.value = body.value;
                    break;
                }
                case '+=': {
                    if (symbol.value == null) {
                        throw new UguisuError('variable is not defined');
                    }
                    assertValue(symbol.value, 'NumberValue');
                    assertValue(body.value, 'NumberValue');
                    const value = new NumberValue(symbol.value.getValue() + body.value.getValue());
                    symbol.value = value;
                    break;
                }
                case '-=': {
                    if (symbol.value == null) {
                        throw new UguisuError('variable is not defined');
                    }
                    assertValue(symbol.value, 'NumberValue');
                    assertValue(body.value, 'NumberValue');
                    const value = new NumberValue(symbol.value.getValue() - body.value.getValue());
                    symbol.value = value;
                    break;
                }
                case '*=': {
                    if (symbol.value == null) {
                        throw new UguisuError('variable is not defined');
                    }
                    assertValue(symbol.value, 'NumberValue');
                    assertValue(body.value, 'NumberValue');
                    const value = new NumberValue(symbol.value.getValue() * body.value.getValue());
                    symbol.value = value;
                    break;
                }
                case '/=': {
                    if (symbol.value == null) {
                        throw new UguisuError('variable is not defined');
                    }
                    assertValue(symbol.value, 'NumberValue');
                    assertValue(body.value, 'NumberValue');
                    const value = new NumberValue(symbol.value.getValue() / body.value.getValue());
                    symbol.value = value;
                    break;
                }
                case '%=': {
                    if (symbol.value == null) {
                        throw new UguisuError('variable is not defined');
                    }
                    assertValue(symbol.value, 'NumberValue');
                    assertValue(body.value, 'NumberValue');
                    const value = new NumberValue(symbol.value.getValue() % body.value.getValue());
                    symbol.value = value;
                    break;
                }
            }
            return createOkResult(new NoneValue());
        }
    }
}

function evalExpr(r: RunContext, expr: ExprNode): EvalResult<Value> {
    switch (expr.kind) {
        case 'Identifier': {
            const result = evalReferenceExpr(r, expr);
            if (!isOkResult(result)) {
                return result;
            }
            const symbol = result.value;
            if (symbol.value == null) {
                throw new UguisuError(`identifier \`${expr.name}\` is not defined`);
            }
            return createOkResult(symbol.value);
        }
        case 'FieldAccess': {
            const result = evalReferenceExpr(r, expr);
            if (!isOkResult(result)) {
                return result;
            }
            const symbol = result.value;
            if (symbol.value == null) {
                throw new UguisuError('field not defined');
            }
            return createOkResult(symbol.value);
        }
        case 'IndexAccess': {
            const result = evalReferenceExpr(r, expr);
            if (!isOkResult(result)) {
                return result;
            }
            const symbol = result.value;
            if (symbol.value == null) {
                throw new UguisuError('symbol not defined');
            }
            return createOkResult(symbol.value);
        }
        case 'NumberLiteral': {
            return createOkResult(new NumberValue(expr.value));
        }
        case 'BoolLiteral': {
            return createOkResult(new BoolValue(expr.value));
        }
        case 'CharLiteral': {
            return createOkResult(new CharValue(expr.value));
        }
        case 'StringLiteral': {
            return createOkResult(new StringValue(expr.value));
        }
        case 'Call': {
            const callee = evalExpr(r, expr.callee);
            if (!isOkResult(callee)) {
                return callee;
            }
            assertValue(callee.value, 'FunctionValue');
            const args: Value[] = [];
            for (const argExpr of expr.args) {
                const arg = evalExpr(r, argExpr);
                if (!isOkResult(arg)) {
                    return arg;
                }
                if (arg.value.kind == 'NoneValue') {
                    throw new UguisuError('no values');
                }
                args.push(arg.value);
            }
            return createOkResult(call(r, callee.value, args));
        }
        case 'BinaryOp': {
            const left = evalExpr(r, expr.left);
            const right = evalExpr(r, expr.right);
            if (!isOkResult(left)) {
                return left;
            }
            if (!isOkResult(right)) {
                return right;
            }
            if (left.value.kind == 'NoneValue') {
                throw new UguisuError('no values');
            }
            if (right.value.kind == 'NoneValue') {
                throw new UguisuError('no values');
            }
            if (isLogicalBinaryOperator(expr.operator)) {
                // Logical Operation
                assertValue(left.value, 'BoolValue');
                assertValue(right.value, 'BoolValue');
                switch (expr.operator) {
                    case '&&': {
                        return createOkResult(new BoolValue(left.value.getValue() && right.value.getValue()));
                    }
                    case '||': {
                        return createOkResult(new BoolValue(left.value.getValue() || right.value.getValue()));
                    }
                }
                throw new UguisuError('unexpected operation');
            } else if (isEquivalentOperator(expr.operator)) {
                // Equivalent Operation
                switch (left.value.kind) {
                    case 'NumberValue': {
                        assertValue(right.value, 'NumberValue');
                        switch (expr.operator) {
                            case '==': {
                                return createOkResult(new BoolValue(left.value.getValue() == right.value.getValue()));
                            }
                            case '!=': {
                                return createOkResult(new BoolValue(left.value.getValue() != right.value.getValue()));
                            }
                        }
                        break;
                    }
                    case 'BoolValue': {
                        assertValue(right.value, 'BoolValue');
                        switch (expr.operator) {
                            case '==': {
                                return createOkResult(new BoolValue(left.value.getValue() == right.value.getValue()));
                            }
                            case '!=': {
                                return createOkResult(new BoolValue(left.value.getValue() != right.value.getValue()));
                            }
                        }
                        break;
                    }
                    case 'CharValue': {
                        assertValue(right.value, 'CharValue');
                        switch (expr.operator) {
                            case '==': {
                                return createOkResult(new BoolValue(left.value.getValue() == right.value.getValue()));
                            }
                            case '!=': {
                                return createOkResult(new BoolValue(left.value.getValue() != right.value.getValue()));
                            }
                        }
                        break;
                    }
                    case 'StringValue': {
                        assertValue(right.value, 'StringValue');
                        switch (expr.operator) {
                            case '==': {
                                return createOkResult(new BoolValue(left.value.getValue() == right.value.getValue()));
                            }
                            case '!=': {
                                return createOkResult(new BoolValue(left.value.getValue() != right.value.getValue()));
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
                        assertValue(right.value, 'FunctionValue');
                        switch (expr.operator) {
                            case '==': {
                                return createOkResult(new BoolValue(equalFunc(left.value, right.value)));
                            }
                            case '!=': {
                                return createOkResult(new BoolValue(!equalFunc(left.value, right.value)));
                            }
                        }
                        break;
                    }
                    case 'StructValue':
                    case 'ArrayValue': {
                        throw new UguisuError(`type \`${getTypeName(left.value.kind)}\` cannot be used for equivalence comparisons.`);
                        break;
                    }
                }
                throw new UguisuError('unexpected operation');
            } else if (isOrderingOperator(expr.operator)) {
                // Ordering Operation
                switch (left.value.kind) {
                    case 'NumberValue': {
                        assertValue(right.value, 'NumberValue');
                        switch (expr.operator) {
                            case '<': {
                                return createOkResult(new BoolValue(left.value.getValue() < right.value.getValue()));
                            }
                            case '<=': {
                                return createOkResult(new BoolValue(left.value.getValue() <= right.value.getValue()));
                            }
                            case '>': {
                                return createOkResult(new BoolValue(left.value.getValue() > right.value.getValue()));
                            }
                            case '>=': {
                                return createOkResult(new BoolValue(left.value.getValue() >= right.value.getValue()));
                            }
                        }
                        break;
                    }
                    case 'BoolValue':
                    case 'CharValue':
                    case 'StringValue':
                    case 'FunctionValue':
                    case 'StructValue':
                    case 'ArrayValue': {
                        throw new UguisuError(`type \`${getTypeName(left.value.kind)}\` cannot be used to compare large and small relations.`);
                    }
                }
            } else {
                // Arithmetic Operation
                assertValue(left.value, 'NumberValue');
                assertValue(right.value, 'NumberValue');
                switch (expr.operator) {
                    case '+': {
                        return createOkResult(new NumberValue(left.value.getValue() + right.value.getValue()));
                    }
                    case '-': {
                        return createOkResult(new NumberValue(left.value.getValue() - right.value.getValue()));
                    }
                    case '*': {
                        return createOkResult(new NumberValue(left.value.getValue() * right.value.getValue()));
                    }
                    case '/': {
                        return createOkResult(new NumberValue(left.value.getValue() / right.value.getValue()));
                    }
                    case '%': {
                        return createOkResult(new NumberValue(left.value.getValue() % right.value.getValue()));
                    }
                }
            }
            throw new UguisuError('unexpected operation');
        }
        case 'UnaryOp': {
            const result = evalExpr(r, expr.expr);
            if (!isOkResult(result)) {
                return result;
            }
            // Logical Operation
            assertValue(result.value, 'BoolValue');
            switch (expr.operator) {
                case '!': {
                    return createOkResult(new BoolValue(!result.value.getValue()));
                }
            }
            throw new UguisuError('unexpected operation');
        }
        case 'StructExpr': {
            const fields = new Map<string, Symbol>();
            for (const field of expr.fields) {
                const result = evalExpr(r, field.body);
                if (!isOkResult(result)) {
                    return result;
                }
                const symbol = new Symbol(result.value);
                fields.set(field.name, symbol);
            }
            return createOkResult(new StructValue(fields));
        }
        case 'ArrayNode': {
            const items: Symbol[] = [];
            for (const x of expr.items) {
                const result = evalExpr(r, x);
                if (!isOkResult(result)) {
                    return result;
                }
                items.push(new Symbol(result.value));
            }
            return createOkResult(new ArrayValue(items));
        }
        case 'IfExpr': {
            // TODO
            const cond = evalExpr(r, expr.cond);
            if (!isOkResult(cond)) {
                return cond;
            }
            assertValue(cond.value, 'BoolValue');
            if (cond.value.getValue()) {
                evalBlock(r, expr.thenBlock);
            } else {
                evalBlock(r, expr.elseBlock);
            }
            return createOkResult(new NoneValue());
        }
    }
}
