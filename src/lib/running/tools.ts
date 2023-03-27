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

    declare(name: string) {
        this.trace?.log(`declare symbol: ${name}`);
        this.layers[0].set(name, { defined: false, value: undefined });
    }

    define(name: string, value: Value) {
        this.trace?.log(`define symbol: ${name}`, value);
        this.layers[0].set(name, { defined: true, value });
    }

    get(name: string): Symbol | undefined {
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

export type Symbol = { defined: true, value: Value } | { defined: false, value: undefined };

export function newDefinedSymbol(value: Value): Symbol {
    return { defined: true, value };
}

export function newDeclaredSymbol(): Symbol {
    return { defined: false, value: undefined };
}

//#region Values

export type Value = NoneValue | NumberValue | BoolValue | StringValue | StructValue | FunctionValue;

export function getTypeName(value: Value): string {
    switch (value.kind) {
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
        case 'FunctionValue': {
            return 'fn';
        }
    }
}

export class NoneValue {
    kind: 'NoneValue';
    constructor() {
        this.kind = 'NoneValue';
    }
}

export function isNoneValue(value: Value): value is NoneValue {
    return (value.kind == 'NoneValue');
}

export function assertNone(value: Value): asserts value is NoneValue {
    if (!isNoneValue(value)) {
        throw new UguisuError(`type mismatched. expected \`none\`, found \`${getTypeName(value)}\``);
    }
}

export function newNoneValue() {
    return new NoneValue();
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

export function assertNumber(value: Value): asserts value is NumberValue {
    if (value.kind != 'NumberValue') {
        throw new UguisuError(`type mismatched. expected \`number\`, found \`${getTypeName(value)}\``);
    }
}

export function newNumber(value: number) {
    return new NumberValue(value);
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

export function assertBool(value: Value): asserts value is BoolValue {
    if (value.kind != 'BoolValue') {
        throw new UguisuError(`type mismatched. expected \`bool\`, found \`${getTypeName(value)}\``);
    }
}

export function newBool(value: boolean) {
    return new BoolValue(value);
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

export function assertString(value: Value): asserts value is StringValue {
    if (value.kind != 'StringValue') {
        throw new UguisuError(`type mismatched. expected \`string\`, found \`${getTypeName(value)}\``);
    }
}

export function newString(value: string) {
    return new StringValue(value);
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
    getFieldSymbol(name: string): Symbol | undefined {
        return this._fields.get(name);
    }
}

export function assertStruct(value: Value): asserts value is StructValue {
    if (value.kind != 'StructValue') {
        throw new UguisuError(`type mismatched. expected \`struct\`, found \`${getTypeName(value)}\``);
    }
}

export function newStruct(fields: Map<string, Symbol>) {
    return new StructValue(fields);
}

export type NativeFuncHandler = (args: Value[], options: UguisuOptions) => Value;

export class FunctionValue {
    kind: 'FunctionValue';
    user?: {
        node: FunctionDecl;
        env: RunningEnv; // lexical scope
    };
    native?: NativeFuncHandler;
    constructor(user?: FunctionValue['user'], native?: NativeFuncHandler) {
        this.kind = 'FunctionValue';
        this.user = user;
        this.native = native;
    }
}

export function assertFunction(value: Value): asserts value is FunctionValue {
    if (value.kind != 'FunctionValue') {
        throw new UguisuError(`type mismatched. expected \`fn\`, found \`${getTypeName(value)}\``);
    }
}

export function newFunction(node: FunctionDecl, env: RunningEnv) {
    return new FunctionValue({ node, env });
}

export function newNativeFunction(native: NativeFuncHandler) {
    return new FunctionValue(undefined, native);
}

//#endregion Values
