import { UguisuError } from '../misc/errors.js';
import { ProjectInfo } from '../project-file.js';
import { AstNode } from '../syntax/tools.js';

export class AnalysisContext {
    env: AnalysisEnv;
    symbolTable: Map<AstNode, Symbol>;
    projectInfo: ProjectInfo;
    warn: string[];
    error: string[];

    constructor(env: AnalysisEnv, symbolTable: Map<AstNode, Symbol>, projectInfo: ProjectInfo) {
        this.env = env;
        this.symbolTable = symbolTable;
        this.projectInfo = projectInfo;
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
    params: { name: string, ty: MaybeValidType }[],
    returnTy: MaybeValidType,
    /** for wasm */
    vars: FnVar[],
};

export type FnVar = { name: string, isParam: boolean, ty: MaybeValidType };

export type NativeFnSymbol = {
    kind: 'NativeFnSymbol',
    params: { name: string, ty: MaybeValidType }[],
    returnTy: MaybeValidType,
};

export function newNativeFnSymbol(params: { name: string, ty: MaybeValidType }[], returnTy: MaybeValidType): NativeFnSymbol {
    return { kind: 'NativeFnSymbol', params, returnTy };
}

export type VariableSymbol = {
    kind: 'VariableSymbol',
    defined: boolean,
    ty: MaybeValidType,
};

export type ExprSymbol = {
    kind: 'ExprSymbol',
    ty: MaybeValidType,
};

export type MaybeValidType = ValidType | '(unresolved)' | '(invalid)';
export type ValidType = 'void' | 'number' | 'bool' | 'string' | 'function';

export function isValidType(x: MaybeValidType): x is ValidType {
    if (x == '(invalid)' || x == '(unresolved)') {
        return false;
    }
    return true;
}

export function assertType(ctx: AnalysisContext, actual: ValidType, expected: ValidType, errorNode: AstNode) {
    if (actual != expected) {
        ctx.dispatchError(`type mismatched. expected \`${expected}\`, found \`${actual}\``, errorNode);
    }
}
