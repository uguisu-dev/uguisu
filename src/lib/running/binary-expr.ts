import { UguisuError } from '../misc/errors.js';
import { ArithmeticOperator, EquivalentOperator, LogicalBinaryOperator, OrderingOperator } from '../syntax/node.js';
import { Token } from '../syntax/token.js';
import { EvalResult, Complete } from './result.js';
import {
  assertValue,
  BoolValue,
  CharValue,
  FunctionValue,
  getTypeName,
  isNoneValue,
  NumberValue,
  StringValue,
  Value
} from './value.js';

export function evalLogicalBinaryOp(op: LogicalBinaryOperator, left: Value, right: Value): EvalResult<BoolValue> {
  assertValue(left, 'BoolValue');
  assertValue(right, 'BoolValue');
  switch (op) {
    case Token.And2: {
      return new Complete(new BoolValue(left.raw && right.raw));
    }
    case Token.Or2: {
      return new Complete(new BoolValue(left.raw || right.raw));
    }
  }
}

export function evalEquivalentBinaryOp(op: EquivalentOperator, left: Value, right: Value): EvalResult<BoolValue> {
  if (isNoneValue(left)) {
    throw new UguisuError('no values');
  }
  if (isNoneValue(right)) {
    throw new UguisuError('no values');
  }
  switch (left.kind) {
    case 'NumberValue': {
      left = left as NumberValue;
      assertValue(right, 'NumberValue');
      switch (op) {
        case Token.Eq2: {
          return new Complete(new BoolValue(left.raw === right.raw));
        }
        case Token.NotEq: {
          return new Complete(new BoolValue(left.raw !== right.raw));
        }
      }
      break;
    }
    case 'BoolValue': {
      left = left as BoolValue;
      assertValue(right, 'BoolValue');
      switch (op) {
        case Token.Eq2: {
          return new Complete(new BoolValue(left.raw == right.raw));
        }
        case Token.NotEq: {
          return new Complete(new BoolValue(left.raw != right.raw));
        }
      }
      break;
    }
    case 'CharValue': {
      left = left as CharValue;
      assertValue(right, 'CharValue');
      switch (op) {
        case Token.Eq2: {
          return new Complete(new BoolValue(left.raw == right.raw));
        }
        case Token.NotEq: {
          return new Complete(new BoolValue(left.raw != right.raw));
        }
      }
      break;
    }
    case 'StringValue': {
      left = left as StringValue;
      assertValue(right, 'StringValue');
      switch (op) {
        case Token.Eq2: {
          return new Complete(new BoolValue(left.raw == right.raw));
        }
        case Token.NotEq: {
          return new Complete(new BoolValue(left.raw != right.raw));
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
        return false;
      }
      left = left as FunctionValue;
      assertValue(right, 'FunctionValue');
      switch (op) {
        case Token.Eq2: {
          return new Complete(new BoolValue(equalFunc(left, right)));
        }
        case Token.NotEq: {
          return new Complete(new BoolValue(!equalFunc(left, right)));
        }
      }
      break;
    }
    case 'StructValue':
    case 'ArrayValue': {
      break;
    }
  }
  throw new UguisuError(`type \`${getTypeName(left.kind)}\` cannot be used for equivalence comparisons.`);
}

export function evalOrderingBinaryOp(op: OrderingOperator, left: Value, right: Value): EvalResult<BoolValue> {
  if (isNoneValue(left)) {
    throw new UguisuError('no values');
  }
  if (isNoneValue(right)) {
    throw new UguisuError('no values');
  }
  switch (left.kind) {
    case 'NumberValue': {
      left = left as NumberValue;
      assertValue(right, 'NumberValue');
      switch (op) {
        case Token.LessThan: {
          return new Complete(new BoolValue(left.raw < right.raw));
        }
        case Token.LessThanEq: {
          return new Complete(new BoolValue(left.raw <= right.raw));
        }
        case Token.GreaterThan: {
          return new Complete(new BoolValue(left.raw > right.raw));
        }
        case Token.GreaterThanEq: {
          return new Complete(new BoolValue(left.raw >= right.raw));
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
      break;
    }
  }
  throw new UguisuError(`type \`${getTypeName(left.kind)}\` cannot be used to compare large and small relations.`);
}

export function evalArithmeticBinaryOp(op: ArithmeticOperator, left: Value, right: Value): EvalResult<NumberValue> {
  assertValue(left, 'NumberValue');
  assertValue(right, 'NumberValue');
  switch (op) {
    case Token.Plus: {
      return new Complete(new NumberValue(left.raw + right.raw));
    }
    case Token.Minus: {
      return new Complete(new NumberValue(left.raw - right.raw));
    }
    case Token.Asterisk: {
      return new Complete(new NumberValue(left.raw * right.raw));
    }
    case Token.Slash: {
      return new Complete(new NumberValue(left.raw / right.raw));
    }
    case Token.Percent: {
      return new Complete(new NumberValue(left.raw % right.raw));
    }
  }
}
