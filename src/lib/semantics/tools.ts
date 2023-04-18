import { UguisuError } from '../misc/errors.js';
import { ProjectInfo } from '../project-file.js';
import { AstNode } from '../syntax/tools.js';
import { InvalidType, FunctionType, UnresolvedType, Type, TypeEnv } from './types.js';

export class AnalyzeContext {
    env: AnalysisEnv;
    typeEnv: TypeEnv;
    symbolTable: Map<AstNode, Symbol>;
    projectInfo: ProjectInfo;
    warn: string[];
    error: string[];
    // flags
    isUsedAnyType: boolean;

    constructor(env: AnalysisEnv, typeEnv: TypeEnv, symbolTable: Map<AstNode, Symbol>, projectInfo: ProjectInfo) {
        this.env = env;
        this.typeEnv = typeEnv;
        this.symbolTable = symbolTable;
        this.projectInfo = projectInfo;
        this.warn = [];
        this.error = [];
        this.isUsedAnyType = false;
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

// symbols

export type Symbol = FnSymbol | NativeFnSymbol | StructSymbol | VariableSymbol | ExprSymbol;

export type FnSymbol = {
    kind: 'FnSymbol',
    params: { name: string }[],
    ty: FunctionType | InvalidType | UnresolvedType,
    /** for wasm */
    vars: FnVar[],
};

export function createFunctionSymbol(params: { name: string }[], ty: FunctionType | InvalidType | UnresolvedType, vars: FnVar[]): FnSymbol {
    return { kind: 'FnSymbol', params, ty, vars };
}

export type FnVar = { name: string, isParam: boolean, ty: FunctionType | InvalidType | UnresolvedType };

export type NativeFnSymbol = {
    kind: 'NativeFnSymbol',
    params: { name: string }[],
    ty: FunctionType | InvalidType | UnresolvedType,
};

export function createNativeFnSymbol(params: { name: string }[], ty: FunctionType | InvalidType | UnresolvedType): NativeFnSymbol {
    return { kind: 'NativeFnSymbol', params, ty };
}

export type StructSymbol = {
    kind: 'StructSymbol',
    name: string,
    fields: Map<string, Symbol>,
};

export function createStructSymbol(name: string, fields: Map<string, Symbol>): StructSymbol {
    return { kind: 'StructSymbol', name, fields };
}

export type VariableSymbol = {
    kind: 'VariableSymbol',
    ty: Type,
    isDefined: boolean,
};

export function createVariableSymbol(ty: Type, isDefined: boolean): VariableSymbol {
    return { kind: 'VariableSymbol', ty, isDefined };
}

export type ExprSymbol = {
    kind: 'ExprSymbol',
    ty: Type,
};

export function createExprSymbol(ty: Type): ExprSymbol {
    return { kind: 'ExprSymbol', ty };
}

// statement result

export type StatementResult = 'invalid' | 'ok' | 'return' | 'break';
