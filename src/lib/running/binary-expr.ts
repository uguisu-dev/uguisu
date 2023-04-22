import { UguisuError } from '../misc/errors';
import { ArithmeticOperator, EquivalentOperator, LogicalBinaryOperator, OrderingOperator } from '../syntax/node';
import {
    assertValue,
    BoolValue,
    CharValue,
    createBoolValue,
    createNumberValue,
    createOk,
    EvalResult,
    FunctionValue,
    getTypeName,
    getValueKind,
    isNoneValue,
    NumberValue,
    StringValue,
    Value
} from './tools';

export function evalLogicalBinaryOp(op: LogicalBinaryOperator, left: Value, right: Value): EvalResult<BoolValue> {
    assertValue(left, 'BoolValue');
    assertValue(right, 'BoolValue');
    switch (op) {
        case '&&': {
            return createOk(createBoolValue(left && right));
        }
        case '||': {
            return createOk(createBoolValue(left || right));
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
    switch (getValueKind(left)) {
        case 'NumberValue': {
            left = left as NumberValue;
            assertValue(right, 'NumberValue');
            switch (op) {
                case '==': {
                    return createOk(createBoolValue(left == right));
                }
                case '!=': {
                    return createOk(createBoolValue(left != right));
                }
            }
            break;
        }
        case 'BoolValue': {
            left = left as BoolValue;
            assertValue(right, 'BoolValue');
            switch (op) {
                case '==': {
                    return createOk(createBoolValue(left == right));
                }
                case '!=': {
                    return createOk(createBoolValue(left != right));
                }
            }
            break;
        }
        case 'CharValue': {
            left = left as CharValue;
            assertValue(right, 'CharValue');
            switch (op) {
                case '==': {
                    return createOk(createBoolValue(left == right));
                }
                case '!=': {
                    return createOk(createBoolValue(left != right));
                }
            }
            break;
        }
        case 'StringValue': {
            left = left as StringValue;
            assertValue(right, 'StringValue');
            switch (op) {
                case '==': {
                    return createOk(createBoolValue(left == right));
                }
                case '!=': {
                    return createOk(createBoolValue(left != right));
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
                case '==': {
                    return createOk(createBoolValue(equalFunc(left, right)));
                }
                case '!=': {
                    return createOk(createBoolValue(!equalFunc(left, right)));
                }
            }
            break;
        }
        case 'StructValue':
        case 'ArrayValue': {
            break;
        }
    }
    throw new UguisuError(`type \`${getTypeName(getValueKind(left))}\` cannot be used for equivalence comparisons.`);
}

export function evalOrderingBinaryOp(op: OrderingOperator, left: Value, right: Value): EvalResult<BoolValue> {
    if (isNoneValue(left)) {
        throw new UguisuError('no values');
    }
    if (isNoneValue(right)) {
        throw new UguisuError('no values');
    }
    switch (getValueKind(left)) {
        case 'NumberValue': {
            assertValue(right, 'NumberValue');
            switch (op) {
                case '<': {
                    return createOk(createBoolValue(left < right));
                }
                case '<=': {
                    return createOk(createBoolValue(left <= right));
                }
                case '>': {
                    return createOk(createBoolValue(left > right));
                }
                case '>=': {
                    return createOk(createBoolValue(left >= right));
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
    throw new UguisuError(`type \`${getTypeName(getValueKind(left))}\` cannot be used to compare large and small relations.`);
}

export function evalArithmeticBinaryOp(op: ArithmeticOperator, left: Value, right: Value): EvalResult<NumberValue> {
    assertValue(left, 'NumberValue');
    assertValue(right, 'NumberValue');
    switch (op) {
        case '+': {
            return createOk(createNumberValue(left + right));
        }
        case '-': {
            return createOk(createNumberValue(left - right));
        }
        case '*': {
            return createOk(createNumberValue(left * right));
        }
        case '/': {
            return createOk(createNumberValue(left / right));
        }
        case '%': {
            return createOk(createNumberValue(left % right));
        }
    }
}
