import { UguisuError } from '../misc/errors.js';
import { AstNode } from '../syntax/tools.js';

export class AnalysisContext {
    env: AnalysisEnv;
    symbolTable: Map<AstNode, Symbol>;
    warn: string[];
    error: string[];

    constructor(env: AnalysisEnv, symbolTable: Map<AstNode, Symbol>) {
        this.env = env;
        this.symbolTable = symbolTable;
        this.warn = [];
        this.error = [];
    }

    dispatchWarn(message: string, node?: AstNode) {
        if (node != null) {
            this.warn.push(`${message} (${node.pos[0]}:${node.pos[1]})`);
        } else {
            this.warn.push(message);
        }
    }

    dispatchError(message: string, errorNode?: AstNode) {
        if (errorNode != null) {
            this.error.push(`${message} (${errorNode.pos[0]}:${errorNode.pos[1]})`);
        } else {
            this.error.push(message);
        }
    }
}

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
    params: { name: string, ty: MaybeType }[],
    returnTy: MaybeType,
    /** for wasm */
    vars: FnVar[],
};

export type FnVar = { name: string, isParam: boolean, ty: MaybeType };

export type NativeFnSymbol = {
    kind: 'NativeFnSymbol',
    params: { name: string, ty: MaybeType }[],
    returnTy: MaybeType,
};

export function newNativeFnSymbol(params: { name: string, ty: MaybeType }[], returnTy: MaybeType): NativeFnSymbol {
    return { kind: 'NativeFnSymbol', params, returnTy };
}

export type VariableSymbol = {
    kind: 'VariableSymbol',
    defined: boolean,
    ty: MaybeType,
};

export type ExprSymbol = {
    kind: 'ExprSymbol',
    ty: MaybeType,
};

export type MaybeType = Type | '(unresolved)' | '(invalid)';
export type Type = 'void' | 'number' | 'bool' | 'string' | 'function';

export function isType(x: MaybeType): x is Type {
    if (x == '(invalid)' || x == '(unresolved)') {
        return false;
    }
    return true;
}

export function assertType(ctx: AnalysisContext, actual: Type, expected: Type, errorNode: AstNode) {
    if (actual == 'void') {
        ctx.dispatchError(`A function call that does not return a value cannot be used as an expression.`, errorNode);
    }
    if (actual != expected) {
        ctx.dispatchError(`type mismatched. expected \`${expected}\`, found \`${actual}\``, errorNode);
    }
}
