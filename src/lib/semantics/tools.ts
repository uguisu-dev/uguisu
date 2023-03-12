import { UguisuError } from '../misc/errors.js';
import { AstNode } from '../syntax/tools.js';

export class AnalysisEnv {
    private layers: Map<string, Symbol>[];

    constructor(baseEnv?: AnalysisEnv) {
        if (baseEnv != null) {
            this.layers = [...baseEnv.layers];
        } else {
            this.layers = [new Map()];
        }
    }

    set(name: string, symbol: Symbol) {
        this.layers[0].set(name, symbol);
    }

    get(name: string): Symbol | undefined {
        for (const layer of this.layers) {
            const symbol = layer.get(name);
            if (symbol != null) {
                return symbol;
            }
        }
        return undefined;
    }

    enter() {
        this.layers.unshift(new Map());
    }

    leave() {
        if (this.layers.length <= 1) {
            throw new UguisuError('Left the root layer.');
        }
        this.layers.shift();
    }
}

export type Symbol = FunctionSymbol | NativeFnSymbol | VariableSymbol | ExprSymbol;

export type FunctionSymbol = {
    kind: 'FnSymbol',
    defined: boolean,
    params: { name: string, ty: Type }[],
    returnTy: Type,
    /** for wasm */
    vars: FnVar[],
};

export type FnVar = { name: string, isParam: boolean, ty?: Type };

export type NativeFnSymbol = {
    kind: 'NativeFnSymbol',
    params: { name: string, ty: Type }[],
    returnTy: Type,
};

export function newNativeFnSymbol(params: { name: string, ty: Type }[], returnTy: Type): NativeFnSymbol {
    return { kind: 'NativeFnSymbol', params, returnTy };
}

export type VariableSymbol = {
    kind: 'VariableSymbol',
    defined: boolean,
    ty?: Type,
};

export type ExprSymbol = {
    kind: 'ExprSymbol',
    ty: Type,
};

export type Type = 'void' | 'number' | 'bool' | 'string' | 'function';

export function assertType(actual: Type, expected: Type, errorNode: AstNode) {
    if (actual == 'void') {
        dispatchError(`A function call that does not return a value cannot be used as an expression.`, errorNode);
    }
    if (actual != expected) {
        dispatchError(`type mismatched. expected \`${expected}\`, found \`${actual}\``, errorNode);
    }
}

export function dispatchError(message: string, errorNode?: AstNode): never {
    if (errorNode != null) {
        throw new UguisuError(`${message} (${errorNode.pos[0]}:${errorNode.pos[1]})`);
    } else {
        throw new UguisuError(message);
    }
}
