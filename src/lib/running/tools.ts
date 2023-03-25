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

export type Value = NoneValue | NumberValue | BoolValue | FunctionValue | StringValue | StructValue;

export type FunctionValue = {
    kind: 'FunctionValue',
    node: FunctionDecl,
    native: undefined,
    env: RunningEnv, // lexical scope
} | {
    kind: 'FunctionValue',
    node: undefined,
    native: NativeFuncHandler,
};

export type NativeFuncHandler = (args: Value[], options: UguisuOptions) => Value;

export function newFunction(node: FunctionDecl, env: RunningEnv): FunctionValue {
    return { kind: 'FunctionValue', node, env, native: undefined };
}
export function newNativeFunction(native: NativeFuncHandler): FunctionValue {
    return { kind: 'FunctionValue', native, node: undefined };
}
export function assertFunction(value: Value): asserts value is FunctionValue {
    if (value.kind != 'FunctionValue') {
        throw new UguisuError(`type mismatched. expected \`fn\`, found \`${getTypeName(value)}\``);
    }
}

export type StructValue = {
    kind: 'StructValue',
    fields: Map<string, Symbol>,
};
export function newStruct(fields: Map<string, Symbol>): StructValue {
    return { kind: 'StructValue', fields };
}
export function assertStruct(value: Value): asserts value is StructValue {
    if (value.kind != 'StructValue') {
        throw new UguisuError(`type mismatched. expected struct, found \`${getTypeName(value)}\``);
    }
}

export type NumberValue = {
    kind: 'NumberValue',
    value: number,
};
export function newNumber(value: number): NumberValue {
    return { kind: 'NumberValue', value };
}
export function assertNumber(value: Value): asserts value is NumberValue {
    if (value.kind != 'NumberValue') {
        throw new UguisuError(`type mismatched. expected \`number\`, found \`${getTypeName(value)}\``);
    }
}

export type BoolValue = {
    kind: 'BoolValue',
    value: boolean,
};
export function newBool(value: boolean): BoolValue {
    return { kind: 'BoolValue', value };
}
export function assertBool(value: Value): asserts value is BoolValue {
    if (value.kind != 'BoolValue') {
        throw new UguisuError(`type mismatched. expected \`bool\`, found \`${getTypeName(value)}\``);
    }
}

export type StringValue = {
    kind: 'StringValue',
    value: string,
};
export function newString(value: string): StringValue {
    return { kind: 'StringValue', value };
}
export function assertString(value: Value): asserts value is StringValue {
    if (value.kind != 'StringValue') {
        throw new UguisuError(`type mismatched. expected \`string\`, found \`${getTypeName(value)}\``);
    }
}

export type NoneValue = {
    kind: 'NoneValue',
}
export function newNoneValue(): NoneValue {
    return { kind: 'NoneValue' };
}
export function isNoneValue(value: Value): value is NoneValue {
    return (value.kind == 'NoneValue');
}

export function getTypeName(value: Value): string {
    switch (value.kind) {
        case 'NoneValue': {
            return 'none';
        }
        case 'FunctionValue': {
            return 'fn';
        }
        case 'StructValue': {
            return 'struct';
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
    }
}

//#endregion Values
