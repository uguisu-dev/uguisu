import { UguisuError } from '../misc/errors.js';
import { UguisuOptions } from '../misc/options.js';
import { FunctionDecl } from '../syntax/node.js';
import { RunningEnv, Symbol } from './common.js';

export type Value =
    | NoneValue
    | NumberValue
    | BoolValue
    | StringValue
    | CharValue
    | StructValue
    | ArrayValue
    | FunctionValue;

export type ValueOf<T extends ValueKind>
    = T extends 'NoneValue' ? NoneValue
    : T extends 'NumberValue' ? NumberValue
    : T extends 'BoolValue' ? BoolValue
    : T extends 'StringValue' ? StringValue
    : T extends 'CharValue' ? CharValue
    : T extends 'StructValue' ? StructValue
    : T extends 'ArrayValue' ? ArrayValue
    : T extends 'FunctionValue' ? FunctionValue
    : never;

export function getTypeName(valueKind: ValueKind): string {
    switch (valueKind) {
        case 'NoneValue': {
            return 'none';
        }
        case 'NumberValue': {
            return 'number';
        }
        case 'BoolValue': {
            return 'bool';
        }
        case 'CharValue': {
            return 'char';
        }
        case 'StringValue': {
            return 'string';
        }
        case 'StructValue': {
            return 'struct';
        }
        case 'ArrayValue': {
            return 'array';
        }
        case 'FunctionValue': {
            return 'fn';
        }
    }
}

export function assertValue<T extends ValueKind>(value: Value, expectKind: T): asserts value is ValueOf<T> {
    const valueKind = getValueKind(value);
    if (valueKind != expectKind) {
        throw new UguisuError(`type mismatched. expected \`${getTypeName(expectKind)}\`, found \`${getTypeName(valueKind)}\``);
    }
}

export type ValueKind =
    | 'NoneValue'
    | 'NumberValue'
    | 'BoolValue'
    | 'StringValue'
    | 'CharValue'
    | 'StructValue'
    | 'ArrayValue'
    | 'FunctionValue';

export function getValueKind(x: Value): ValueKind {
    if (isNoneValue(x)) {
        return 'NoneValue';
    }
    if (isNumberValue(x)) {
        return 'NumberValue';
    }
    if (isBoolValue(x)) {
        return 'BoolValue';
    }
    if (isStringValue(x)) {
        return 'StringValue';
    }
    if (isCharValue(x)) {
        return 'CharValue';
    }
    if (isStructValue(x)) {
        return 'StructValue';
    }
    if (isArrayValue(x)) {
        return 'ArrayValue';
    }
    if (isFunctionValue(x)) {
        return 'FunctionValue';
    }
    throw new UguisuError('unexpected type');
}

export type NoneValue = undefined;
export function createNoneValue(): NoneValue {
    return undefined;
}
export function isNoneValue(x: Value): x is NoneValue {
    return (typeof x == 'undefined');
}

export type NumberValue = number;
export function createNumberValue(raw: number): NumberValue {
    return raw;
}
export function isNumberValue(x: Value): x is NumberValue {
    return (typeof x == 'number');
}

export type BoolValue = boolean;
export function createBoolValue(raw: boolean): BoolValue {
    return raw;
}
export function isBoolValue(x: Value): x is BoolValue {
    return (typeof x == 'boolean');
}

export type StringValue = string;
export function createStringValue(raw: string): StringValue {
    return raw;
}
export function isStringValue(x: Value): x is StringValue {
    return (typeof x == 'string');
}

export class CharValue {
    raw: string;
    constructor(raw: string) {
        this.raw = raw;
    }
}
export function createCharValue(raw: string): CharValue {
    return new CharValue(raw);
}
export function isCharValue(x: Value): x is CharValue {
    return (x instanceof CharValue);
}

export class StructValue {
    private _fields: Map<string, Symbol>;
    constructor(fields: Map<string, Symbol>) {
        this._fields = fields;
    }
    getFieldNames() {
        return this._fields.keys();
    }
    lookupField(name: string): Symbol | undefined {
        return this._fields.get(name);
    }
}
export function createStructValue(fields: Map<string, Symbol>): StructValue {
    return new StructValue(fields);
}
export function isStructValue(x: Value): x is StructValue {
    return (x instanceof StructValue);
}

export class ArrayValue {
    private _items: Symbol[];
    constructor(items: Symbol[]) {
        this._items = items;
    }
    at(index: number): Symbol | undefined {
        return this._items.at(index);
    }
    insert(index: number, item: Symbol) {
        this._items.splice(index, 0, item);
    }
    removeAt(index: number) {
        this._items.splice(index, 1);
    }
    count(): number {
        return this._items.length;
    }
}
export function createArrayValue(raw: Symbol[]): ArrayValue {
    return new ArrayValue(raw);
}
export function isArrayValue(x: Value): x is ArrayValue {
    return (x instanceof ArrayValue);
}

export class FunctionValue {
    user?: {
        node: FunctionDecl;
        env: RunningEnv; // lexical scope
    };
    native?: NativeFuncHandler;
    private constructor(user?: FunctionValue['user'], native?: NativeFuncHandler) {
        this.user = user;
        this.native = native;
    }
    static create(node: FunctionDecl, env: RunningEnv): FunctionValue {
        return new FunctionValue({ node, env }, undefined);
    }
    static createNative(native: NativeFuncHandler): FunctionValue {
        return new FunctionValue(undefined, native);
    }
}
export type NativeFuncHandler = (args: Value[], options: UguisuOptions) => Value;
export function isFunctionValue(x: Value): x is FunctionValue {
    return (x instanceof FunctionValue);
}
