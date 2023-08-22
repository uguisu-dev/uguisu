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
} from '../syntax/node.js';
import { Token } from '../syntax/token.js';
import {
  evalArithmeticBinaryOp,
  evalEquivalentBinaryOp,
  evalLogicalBinaryOp,
  evalOrderingBinaryOp
} from './binary-expr.js';
import * as builtins from './builtins.js';
import { RunContext, RunningEnv, Symbol } from './common.js';
import { createOk, EvalResult, isReturn, isBreak, isOk, createReturn, createBreak } from './result.js';
import {
  assertValue,
  FunctionValue,
  Value,
  createNoneValue,
  isNoneValue,
  createNumberValue,
  createBoolValue,
  createStringValue,
  createCharValue,
  createStructValue,
  createArrayValue
} from './value.js';

const trace = Trace.getDefault().createChild(false);

export function run(source: SourceFile, env: RunningEnv, options: UguisuOptions, projectInfo: ProjectInfo) {
  const r = new RunContext(env, options, projectInfo);

  // declare top-level
  builtins.setRuntime(r.env, options);
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

  // get entry point
  const entryPointName = 'main';
  const symbol = r.env.lookup(entryPointName);
  if (symbol == null) {
    throw new UguisuError(`function \`${entryPointName}\` is not found`);
  }
  if (symbol.value == null) {
    throw new UguisuError(`function \`${entryPointName}\` is not defined`);
  }
  assertValue(symbol.value, 'FunctionValue');
  const entryPoint = symbol.value;

  // call entry point
  call(r, entryPoint, []);
}

export function call(r: RunContext, func: FunctionValue, args: Value[]): Value {
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
    let result: EvalResult<Value> = createOk(createNoneValue());
    for (const step of func.user.node.body) {
      if (isExprNode(step)) {
        result = evalExpr(ctx, step);
      } else {
        result = evalStatement(ctx, step);
      }
      if (isReturn(result) || isBreak(result)) {
        break;
      }
    }
    ctx.env.leave();
    if (isReturn(result)) {
      return result.value;
    }
    if (isBreak(result)) {
      throw new UguisuError('invalid break');
    }
    return result.value;
  } else if (func.native != null) {
    return func.native(args, r.options);
  } else {
    throw new UguisuError('invalid function');
  }
}

function evalBlock(r: RunContext, block: StepNode[]): EvalResult<Value> {
  r.env.enter();
  let result: EvalResult<Value> = createOk(createNoneValue());
  for (let i = 0; i < block.length; i++) {
    const step = block[i];
    if (isExprNode(step)) {
      const stepResult = evalExpr(r, step);
      if (isReturn(stepResult) || isBreak(stepResult)) {
        return stepResult;
      }
      const isFinalStep = (i == block.length - 1);
      if (isFinalStep) {
        result = createOk(stepResult.value);
      } else {
        // ignore the value
      }
    } else {
      result = evalStatement(r, step);
      if (isReturn(result)) {
        break;
      } else if (isBreak(result)) {
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
      return createOk(symbol);
    }
    case 'FieldAccess': {
      const target = evalExpr(r, expr.target);
      if (isReturn(target) || isBreak(target)) {
        return target;
      }
      assertValue(target.value, 'StructValue');
      const field = target.value.lookupField(expr.name);
      if (field == null) {
        throw new UguisuError('unknown field');
      }
      return createOk(field);
    }
    case 'IndexAccess': {
      const target = evalExpr(r, expr.target);
      const index = evalExpr(r, expr.index);
      if (isReturn(target) || isBreak(target)) {
        return target;
      }
      if (isReturn(index) || isBreak(index)) {
        return index;
      }
      assertValue(target.value, 'ArrayValue');
      assertValue(index.value, 'NumberValue');
      const symbol = target.value.at(index.value);
      if (symbol == null) {
        throw new UguisuError('index out of range');
      }
      return createOk(symbol);
    }
    default: {
      throw new UguisuError('unexpected expression');
    }
  }
}

function evalStatement(r: RunContext, statement: StatementNode): EvalResult<Value> {
  switch (statement.kind) {
    case 'ExprStatement': {
      evalExpr(r, statement.expr);
      return createOk(createNoneValue());
    }
    case 'ReturnStatement': {
      if (statement.expr != null) {
        const result = evalExpr(r, statement.expr);
        if (isOk(result)) {
          return createReturn(result.value);
        } else {
          return result;
        }
      } else {
        return createReturn(createNoneValue());
      }
      break;
    }
    case 'BreakStatement': {
      return createBreak();
    }
    case 'LoopStatement': {
      while (true) {
        const result = evalBlock(r, statement.block);
        if (isReturn(result)) {
          return result;
        } else if (isBreak(result)) {
          break;
        }
      }
      return createOk(createNoneValue());
    }
    case 'VariableDecl': {
      if (statement.body != null) {
        const body = evalExpr(r, statement.body);
        if (isReturn(body) || isBreak(body)) {
          return body;
        }
        if (isNoneValue(body.value)) {
          throw new UguisuError('no values');
        }
        r.env.declare(statement.name, body.value);
      } else {
        r.env.declare(statement.name);
      }
      return createOk(createNoneValue());
    }
    case 'AssignStatement': {
      let target;
      if (statement.target.kind == 'Identifier' || statement.target.kind == 'FieldAccess' || statement.target.kind == 'IndexAccess') {
        target = evalReferenceExpr(r, statement.target);
        if (isReturn(target) || isBreak(target)) {
          return target;
        }
      } else {
        throw new UguisuError('unsupported assign target');
      }
      const symbol = target.value;
      const body = evalExpr(r, statement.body);
      if (isReturn(body) || isBreak(body)) {
        return body;
      }
      if (isNoneValue(body.value)) {
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
          const value = createNumberValue(symbol.value + body.value);
          symbol.value = value;
          break;
        }
        case '-=': {
          if (symbol.value == null) {
            throw new UguisuError('variable is not defined');
          }
          assertValue(symbol.value, 'NumberValue');
          assertValue(body.value, 'NumberValue');
          const value = createNumberValue(symbol.value - body.value);
          symbol.value = value;
          break;
        }
        case '*=': {
          if (symbol.value == null) {
            throw new UguisuError('variable is not defined');
          }
          assertValue(symbol.value, 'NumberValue');
          assertValue(body.value, 'NumberValue');
          const value = createNumberValue(symbol.value * body.value);
          symbol.value = value;
          break;
        }
        case '/=': {
          if (symbol.value == null) {
            throw new UguisuError('variable is not defined');
          }
          assertValue(symbol.value, 'NumberValue');
          assertValue(body.value, 'NumberValue');
          const value = createNumberValue(symbol.value / body.value);
          symbol.value = value;
          break;
        }
        case '%=': {
          if (symbol.value == null) {
            throw new UguisuError('variable is not defined');
          }
          assertValue(symbol.value, 'NumberValue');
          assertValue(body.value, 'NumberValue');
          const value = createNumberValue(symbol.value % body.value);
          symbol.value = value;
          break;
        }
      }
      return createOk(createNoneValue());
    }
  }
}

function evalExpr(r: RunContext, expr: ExprNode): EvalResult<Value> {
  switch (expr.kind) {
    case 'NumberLiteral': {
      return createOk(createNumberValue(expr.value));
    }
    case 'BoolLiteral': {
      return createOk(createBoolValue(expr.value));
    }
    case 'CharLiteral': {
      return createOk(createCharValue(expr.value));
    }
    case 'StringLiteral': {
      return createOk(createStringValue(expr.value));
    }
    case 'StructExpr': {
      const fields = new Map<string, Symbol>();
      for (const field of expr.fields) {
        const result = evalExpr(r, field.body);
        if (isReturn(result) || isBreak(result)) {
          return result;
        }
        const symbol = new Symbol(result.value);
        fields.set(field.name, symbol);
      }
      return createOk(createStructValue(fields));
    }
    case 'ArrayNode': {
      const items: Symbol[] = [];
      for (const x of expr.items) {
        const result = evalExpr(r, x);
        if (isReturn(result) || isBreak(result)) {
          return result;
        }
        items.push(new Symbol(result.value));
      }
      return createOk(createArrayValue(items));
    }
    case 'Identifier':
    case 'FieldAccess':
    case 'IndexAccess': {
      const result = evalReferenceExpr(r, expr);
      if (isReturn(result) || isBreak(result)) {
        return result;
      }
      const symbol = result.value;
      if (symbol.value == null) {
        throw new UguisuError('symbol not defined');
      }
      return createOk(symbol.value);
    }
    case 'BinaryOp': {
      const left = evalExpr(r, expr.left);
      if (isReturn(left) || isBreak(left)) {
        return left;
      }
      const right = evalExpr(r, expr.right);
      if (isReturn(right) || isBreak(right)) {
        return right;
      }
      const op = expr.operator;
      if (isLogicalBinaryOperator(op)) {
        return evalLogicalBinaryOp(op, left.value, right.value);
      } else if (isEquivalentOperator(op)) {
        return evalEquivalentBinaryOp(op, left.value, right.value);
      } else if (isOrderingOperator(op)) {
        return evalOrderingBinaryOp(op, left.value, right.value);
      } else {
        return evalArithmeticBinaryOp(op, left.value, right.value);
      }
      break;
    }
    case 'UnaryOp': {
      const result = evalExpr(r, expr.expr);
      if (isReturn(result) || isBreak(result)) {
        return result;
      }
      // Logical Operation
      assertValue(result.value, 'BoolValue');
      switch (expr.operator) {
        case Token.Not: {
          return createOk(createBoolValue(!result.value));
        }
      }
      throw new UguisuError('unexpected operation');
    }
    case 'IfExpr': {
      const cond = evalExpr(r, expr.cond);
      if (isReturn(cond) || isBreak(cond)) {
        return cond;
      }
      assertValue(cond.value, 'BoolValue');
      if (cond.value) {
        return evalBlock(r, expr.thenBlock);
      } else {
        return evalBlock(r, expr.elseBlock);
      }
    }
    case 'Call': {
      const callee = evalExpr(r, expr.callee);
      if (isReturn(callee) || isBreak(callee)) {
        return callee;
      }
      assertValue(callee.value, 'FunctionValue');
      const args: Value[] = [];
      for (const argExpr of expr.args) {
        const arg = evalExpr(r, argExpr);
        if (isReturn(arg) || isBreak(arg)) {
          return arg;
        }
        if (isNoneValue(arg.value)) {
          throw new UguisuError('no values');
        }
        args.push(arg.value);
      }
      return createOk(call(r, callee.value, args));
    }
  }
}
