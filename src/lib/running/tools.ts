import { UguisuError } from '../misc/errors.js';
import { UguisuOptions } from '../misc/options.js';
import { Trace } from '../misc/trace.js';
import { FunctionDecl } from '../syntax/tools.js';

export class RunningEnv {
    layers: Map<string, Symbol>[];
    trace?: Trace;

    constructor(baseEnv?: RunningEnv, trace?: Trace) {
        this.trace = trace;
        if (baseEnv != null) {
            this.layers = [...baseEnv.layers];
        } else {
            this.layers = [new Map()];
        }
    }

    declare(name: string, initialValue?: Value) {
        this.trace?.log(`declare symbol: ${name} ${initialValue}`);
        this.layers[0].set(name, new Symbol(initialValue));
    }

    lookup(name: string): Symbol | undefined {
        this.trace?.log(`get symbol: ${name}`);
        for (const layer of this.layers) {
            const symbol = layer.get(name);
            if (symbol != null) {
                return symbol;
            }
        }
        return undefined;
    }

    enter() {
        this.trace?.log(`enter scope`);
        this.layers.unshift(new Map());
    }

    leave() {
        this.trace?.log(`leave scope`);
        if (this.layers.length <= 1) {
            throw new UguisuError('Left the root layer.');
        }
        this.layers.shift();
    }
}

export class Symbol {
    value?: Value;
    constructor(value?: Value) {
        this.value = value;
    }
}

export type StatementResult = OkResult | ReturnResult | BreakResult;

export type OkResult = { kind: 'ok' };

export function createOkResult(): OkResult {
    return { kind: 'ok' };
}

export type ReturnResult = { kind: 'return', value: Value };

export function createReturnResult(value: Value): ReturnResult {
    return { kind: 'return', value };
}

export type BreakResult = { kind: 'break' };

export function createBreakResult(): BreakResult {
    return { kind: 'break' };
}

//#region Values

export type Value = NoneValue | NumberValue | BoolValue | StringValue | StructValue | ArrayValue | FunctionValue;

export type ValueOf<T extends Value['kind']> =
    T extends 'NoneValue' ? NoneValue :
    T extends 'NumberValue' ? NumberValue :
    T extends 'BoolValue' ? BoolValue :
    T extends 'StringValue' ? StringValue :
    T extends 'StructValue' ? StructValue :
    T extends 'ArrayValue' ? ArrayValue :
    T extends 'FunctionValue' ? FunctionValue :
    never;

export function getTypeName(valueKind: Value['kind']): string {
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

export function assertValue<T extends Value['kind']>(value: Value, expectKind: T): asserts value is ValueOf<T> {
    if (value.kind != expectKind) {
        throw new UguisuError(`type mismatched. expected \`${getTypeName(expectKind)}\`, found \`${getTypeName(value.kind)}\``);
    }
}

export class NoneValue {
    kind: 'NoneValue';
    constructor() {
        this.kind = 'NoneValue';
    }
}

export class NumberValue {
    kind: 'NumberValue';
    private _value: number;
    constructor(value: number) {
        this.kind = 'NumberValue';
        this._value = value;
    }
    getValue(): number {
        return this._value;
    }
}

export class BoolValue {
    kind: 'BoolValue';
    private _value: boolean;
    constructor(value: boolean) {
        this.kind = 'BoolValue';
        this._value = value;
    }
    getValue(): boolean {
        return this._value;
    }
}

export class StringValue {
    kind: 'StringValue';
    private _value: string;
    constructor(value: string) {
        this.kind = 'StringValue';
        this._value = value;
    }
    getValue(): string {
        return this._value;
    }
}

export class StructValue {
    kind: 'StructValue';
    private _fields: Map<string, Symbol>;
    constructor(fields: Map<string, Symbol>) {
        this.kind = 'StructValue';
        this._fields = fields;
    }
    getFieldNames() {
        return this._fields.keys();
    }
    lookupField(name: string): Symbol | undefined {
        return this._fields.get(name);
    }
}

export class ArrayValue {
    kind: 'ArrayValue';
    private _items: Symbol[];
    constructor(items: Symbol[]) {
        this.kind = 'ArrayValue';
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

export class FunctionValue {
    kind: 'FunctionValue';
    user?: {
        node: FunctionDecl;
        env: RunningEnv; // lexical scope
    };
    native?: NativeFuncHandler;
    private constructor(user?: FunctionValue['user'], native?: NativeFuncHandler) {
        this.kind = 'FunctionValue';
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

//#endregion Values
