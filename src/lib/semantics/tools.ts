import { UguisuError } from '../misc/errors.js';
import { ProjectInfo } from '../project-file.js';
import { AstNode } from '../syntax/tools.js';

export class AnalyzeContext {
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

export type Symbol = FunctionSymbol | NativeFnSymbol | StructSymbol | VariableSymbol | ExprSymbol;

export type FunctionSymbol = {
    kind: 'FnSymbol',
    params: { name: string }[],
    ty: FunctionType | InvalidType,
    /** for wasm */
    vars: FnVar[],
};

export function newFunctionSymbol(params: { name: string }[], ty: FunctionType | InvalidType, vars: FnVar[]): FunctionSymbol {
    return { kind: 'FnSymbol', params, ty, vars };
}

export type FnVar = { name: string, isParam: boolean, ty: Type };

export type NativeFnSymbol = {
    kind: 'NativeFnSymbol',
    params: { name: string }[],
    ty: FunctionType | InvalidType,
};

export function newNativeFnSymbol(params: { name: string }[], ty: FunctionType | InvalidType): NativeFnSymbol {
    return { kind: 'NativeFnSymbol', params, ty };
}

export type StructSymbol = {
    kind: 'StructSymbol',
    fields: Map<string, { ty: Type }>,
};

export function newStructSymbol(fields: Map<string, { ty: Type }>): StructSymbol {
    return { kind: 'StructSymbol', fields };
}

export type VariableSymbol = {
    kind: 'VariableSymbol',
    ty: Type,
};

export type ExprSymbol = {
    kind: 'ExprSymbol',
    ty: Type,
};

// types

export type Type = InvalidType | ValidType;

export type InvalidType = BadType | PendingType;

export function isValidType(ty: Type): ty is ValidType {
    return ty.kind != 'BadType' && ty.kind != 'PendingType';
}

export type ValidType = SimpleType | FunctionType | GenericType;

export type BadType = {
    kind: 'BadType',
};
function newBadType(): BadType {
    return { kind: 'BadType' };
}

export type PendingType = {
    kind: 'PendingType',
};
function newPendingType(): PendingType {
    return { kind: 'PendingType' };
}

export type SimpleType = {
    kind: 'SimpleType',
    name: string,
};
export function newSimpleType(name: string): SimpleType {
    return { kind: 'SimpleType', name };
}

export type GenericType = {
    kind: 'GenericType',
    name: string,
    innerTypes: Type[],
};
export function newGenericType(name: string, innerTypes: Type[]): GenericType {
    return { kind: 'GenericType', name, innerTypes };
}

export type FunctionType = {
    kind: 'FunctionType',
    paramTypes: Type[],
    returnType: Type,
};
export function newFunctionType(paramTypes: Type[], returnType: Type): FunctionType {
    return { kind: 'FunctionType', paramTypes, returnType };
}

// builtin types
export const badType = newBadType();
export const pendingType = newPendingType();
export const voidType = newSimpleType('void');
export const numberType = newSimpleType('number');
export const boolType = newSimpleType('bool');
export const stringType = newSimpleType('string');

export type CompareTypeResult = 'unknown' | 'compatible' | 'incompatible';

export function compareType(x: Type, y: Type): CompareTypeResult {
    if (!isValidType(x) || !isValidType(y)) {
        return 'unknown';
    }
    if (x.kind != y.kind) {
        return 'incompatible';
    }
    switch (x.kind) {
        case 'SimpleType': {
            if (x.name == (y as SimpleType).name) {
                return 'compatible';
            } else {
                return 'incompatible';
            }
            break;
        }
        case 'FunctionType': {
            y = y as FunctionType;
            if (!isValidType(x.returnType) || !isValidType(y.returnType)) {
                return 'unknown';
            }
            for (const ty of [...x.paramTypes, ...y.paramTypes]) {
                if (!isValidType(ty)) {
                    return 'unknown';
                }
            }
            if (compareType(x.returnType, y.returnType) == 'incompatible') {
                return 'incompatible';
            }
            if (x.paramTypes.length != y.paramTypes.length) {
                return 'incompatible';
            }
            for (let i = 0; i < x.paramTypes.length; i++) {
                if (compareType(x.paramTypes[i], y.paramTypes[i]) == 'incompatible') {
                    return 'incompatible';
                }
            }
            return 'compatible';
        }
        case 'GenericType': {
            y = y as GenericType;
            for (const ty of [...x.innerTypes, ...y.innerTypes]) {
                if (!isValidType(ty)) {
                    return 'unknown';
                }
            }
            if (x.name != y.name) {
                return 'incompatible';
            }
            if (x.innerTypes.length != y.innerTypes.length) {
                return 'incompatible';
            }
            for (let i = 0; i < x.innerTypes.length; i++) {
                if (compareType(x.innerTypes[i], y.innerTypes[i]) == 'incompatible') {
                    return 'incompatible';
                }
            }
            return 'compatible';
        }
    }
}

export function dispatchTypeError(ctx: AnalyzeContext, actual: Type, expected: Type, errorNode: AstNode) {
    ctx.dispatchError(`type mismatched. expected \`${getTypeString(expected)}\`, found \`${getTypeString(actual)}\``, errorNode);
}

export function getTypeString(ty: Type): string {
    switch (ty.kind) {
        case 'BadType':
        case 'PendingType': {
            return '?';
        }
        case 'SimpleType': {
            return ty.name;
        }
        case 'FunctionType': {
            const params = ty.paramTypes.map(x => getTypeString(x)).join(', ');
            const returnType = getTypeString(ty.returnType);
            return `(${params}) => ${returnType}`;
        }
        case 'GenericType': {
            const inner = ty.innerTypes.map(x => getTypeString(x)).join(', ');
            return `${ty.name}<${inner}>`;
        }
    }
}
