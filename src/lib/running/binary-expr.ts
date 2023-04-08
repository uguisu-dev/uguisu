import { UguisuError } from '../misc/errors';
import { ArithmeticOperator, EquivalentOperator, LogicalBinaryOperator, OrderingOperator } from '../syntax/tools';
import { assertValue, BoolValue, createOk, EvalResult, FunctionValue, getTypeName, NumberValue, Value } from './tools';

export function logicalBinaryOp(op: LogicalBinaryOperator, left: Value, right: Value): EvalResult<Value> {
    assertValue(left, 'BoolValue');
    assertValue(right, 'BoolValue');
    switch (op) {
        case '&&': {
            return createOk(new BoolValue(left.getValue() && right.getValue()));
        }
        case '||': {
            return createOk(new BoolValue(left.getValue() || right.getValue()));
        }
    }
}

export function equivalentBinaryOp(op: EquivalentOperator, left: Value, right: Value): EvalResult<Value> {
    if (left.kind == 'NoneValue') {
        throw new UguisuError('no values');
    }
    if (right.kind == 'NoneValue') {
        throw new UguisuError('no values');
    }
    switch (left.kind) {
        case 'NumberValue': {
            assertValue(right, 'NumberValue');
            switch (op) {
                case '==': {
                    return createOk(new BoolValue(left.getValue() == right.getValue()));
                }
                case '!=': {
                    return createOk(new BoolValue(left.getValue() != right.getValue()));
                }
            }
            break;
        }
        case 'BoolValue': {
            assertValue(right, 'BoolValue');
            switch (op) {
                case '==': {
                    return createOk(new BoolValue(left.getValue() == right.getValue()));
                }
                case '!=': {
                    return createOk(new BoolValue(left.getValue() != right.getValue()));
                }
            }
            break;
        }
        case 'CharValue': {
            assertValue(right, 'CharValue');
            switch (op) {
                case '==': {
                    return createOk(new BoolValue(left.getValue() == right.getValue()));
                }
                case '!=': {
                    return createOk(new BoolValue(left.getValue() != right.getValue()));
                }
            }
            break;
        }
        case 'StringValue': {
            assertValue(right, 'StringValue');
            switch (op) {
                case '==': {
                    return createOk(new BoolValue(left.getValue() == right.getValue()));
                }
                case '!=': {
                    return createOk(new BoolValue(left.getValue() != right.getValue()));
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
            assertValue(right, 'FunctionValue');
            switch (op) {
                case '==': {
                    return createOk(new BoolValue(equalFunc(left, right)));
                }
                case '!=': {
                    return createOk(new BoolValue(!equalFunc(left, right)));
                }
            }
            break;
        }
        case 'StructValue':
        case 'ArrayValue': {
            throw new UguisuError(`type \`${getTypeName(left.kind)}\` cannot be used for equivalence comparisons.`);
        }
    }
}

export function orderingBinaryOp(op: OrderingOperator, left: Value, right: Value): EvalResult<Value> {
    if (left.kind == 'NoneValue') {
        throw new UguisuError('no values');
    }
    if (right.kind == 'NoneValue') {
        throw new UguisuError('no values');
    }
    switch (left.kind) {
        case 'NumberValue': {
            assertValue(right, 'NumberValue');
            switch (op) {
                case '<': {
                    return createOk(new BoolValue(left.getValue() < right.getValue()));
                }
                case '<=': {
                    return createOk(new BoolValue(left.getValue() <= right.getValue()));
                }
                case '>': {
                    return createOk(new BoolValue(left.getValue() > right.getValue()));
                }
                case '>=': {
                    return createOk(new BoolValue(left.getValue() >= right.getValue()));
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
            throw new UguisuError(`type \`${getTypeName(left.kind)}\` cannot be used to compare large and small relations.`);
        }
    }
}

export function arithmeticBinaryOp(op: ArithmeticOperator, left: Value, right: Value): EvalResult<Value> {
    assertValue(left, 'NumberValue');
    assertValue(right, 'NumberValue');
    switch (op) {
        case '+': {
            return createOk(new NumberValue(left.getValue() + right.getValue()));
        }
        case '-': {
            return createOk(new NumberValue(left.getValue() - right.getValue()));
        }
        case '*': {
            return createOk(new NumberValue(left.getValue() * right.getValue()));
        }
        case '/': {
            return createOk(new NumberValue(left.getValue() / right.getValue()));
        }
        case '%': {
            return createOk(new NumberValue(left.getValue() % right.getValue()));
        }
    }
}
