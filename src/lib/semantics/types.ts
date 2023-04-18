// types

import { AstNode } from "../syntax/tools";
import { AnalyzeContext, dispatchTypeError } from "./tools";

export class TypeEnv {
    private items: TypeEnvItem[];
    constructor() {
        this.items = [];
    }
    private _getItem(target: Type) {
        let item = this.items.find(info => compareType(info.type, target) == 'compatible');
        if (item == null) {
            item = new TypeEnvItem(target);
            this.items.push(item);
        }
        return item;
    }
    getMember(target: Type, memberName: string): Type | undefined {
        const envItem = this._getItem(target);
        return envItem.getMember(memberName);
    }
    implement(target: Type, memberName: string, memberType: Type) {
        const envItem = this._getItem(target);
        envItem.implement(memberName, memberType);
    }
}

export class TypeEnvItem {
    type: Type;
    private implemented: Map<string, Type>;
    constructor(type: Type) {
        this.type = type;
        this.implemented = new Map();
    }
    getMember(memberName: string): Type | undefined {
        return this.implemented.get(memberName);
    }
    implement(memberName: string, type: Type) {
        this.implemented.set(memberName, type);
    }
}

export type Type = NamedType | FunctionType;

// Name<TypeParam1, TypeParam2, ...>
export class NamedType {
    kind: 'NamedType';
    name: string;
    typeParams: Type[];
    constructor(name: string, typeParams?: Type[]) {
        this.kind = 'NamedType';
        this.name = name;
        this.typeParams = typeParams ?? [];
    }
}

export function isNamedType(x: Type): x is NamedType {
    return (x instanceof NamedType);
}

// when the isMethod is true:
//   fn<TypeParam1, TypeParam2, ...>(this, FnParamType1, FnParamType2, ...): FnReturnType
// when the isMethod is false:
//   fn<TypeParam1, TypeParam2, ...>(FnParamType1, FnParamType2, ...): FnReturnType
export class FunctionType {
    kind: 'FunctionType';
    isMethod: boolean;
    typeParams: Type[];
    fnParamTypes: Type[];
    fnReturnType: Type;
    constructor(opts: { isMethod?: boolean, typeParams?: Type[], fnParamTypes: Type[], fnReturnType: Type }) {
        this.kind = 'FunctionType';
        this.isMethod = opts.isMethod ?? false;
        this.typeParams = opts.typeParams ?? [];
        this.fnParamTypes = opts.fnParamTypes;
        this.fnReturnType = opts.fnReturnType;
    }
}

// special types

export const unresolvedType = new NamedType('unresolved');
export const invalidType = new NamedType('invalid');
export const anyType = new NamedType('any');
export const voidType = new NamedType('void');
export const neverType = new NamedType('never');

export type SpecialTypeName = 'unresolved' | 'invalid' | 'any' | 'void' | 'never';

export function isSpecialType(x: Type, name: SpecialTypeName): boolean {
    return (isNamedType(x) && x.name == name && x.typeParams == null);
}

// builtin types
export const numberType = new NamedType('number');
export const boolType = new NamedType('bool');
export const charType = new NamedType('char');
export const stringType = new NamedType('string');
export const arrayType = new NamedType('array');

// compare types

export type TypeCompatibility = 'compatible' | 'incompatible' | 'unknown';

export function compareType(x: Type, y: Type): TypeCompatibility {
    if (isSpecialType(x, 'unresolved') || isSpecialType(y, 'unresolved') ) {
        return 'unknown';
    }
    if (isSpecialType(x, 'invalid') || isSpecialType(y, 'invalid')) {
        return 'unknown';
    }
    if (isSpecialType(x, 'any') || isSpecialType(y, 'any')) {
        if (isSpecialType(x, 'void') || isSpecialType(y, 'void')) {
            return 'incompatible';
        } else {
            return 'compatible';
        }
    }
    if (x.kind != y.kind) {
        return 'incompatible';
    }
    switch (x.kind) {
        case 'NamedType': {
            y = y as NamedType;
            if (x.name != y.name) {
                return 'incompatible';
            }
            // if generic type
            if (x.typeParams != null || y.typeParams != null) {
                if (x.typeParams != null && y.typeParams != null) {
                    // check count of type params
                    if (x.typeParams.length != y.typeParams.length) {
                        return 'incompatible';
                    }
                    // check type params
                    for (let i = 0; i < x.typeParams.length; i++) {
                        const paramResult = compareType(x.typeParams[i], y.typeParams[i]);
                        if (paramResult != 'compatible') {
                            return paramResult;
                        }
                    }
                } else {
                    return 'incompatible';
                }
            }
            return 'compatible';
        }
        case 'FunctionType': {
            y = y as FunctionType;
            if (x.isMethod != y.isMethod) {
                return 'incompatible';
            }
            // check return type
            const retResult = compareType(x.fnReturnType, y.fnReturnType);
            if (retResult != 'compatible') {
                return retResult;
            }
            // check params count
            if (x.fnParamTypes.length != y.fnParamTypes.length) {
                return 'incompatible';
            }
            // check params type
            for (let i = 0; i < x.fnParamTypes.length; i++) {
                const paramResult = compareType(x.fnParamTypes[i], y.fnParamTypes[i]);
                if (paramResult != 'compatible') {
                    return paramResult;
                }
            }
            return 'compatible';
        }
    }
}

export function getTypeString(ty: Type): string {
    switch (ty.kind) {
        case 'NamedType': {
            if (isSpecialType(ty, 'invalid') || isSpecialType(ty, 'unresolved')) {
                return '?';
            }
            if (ty.typeParams.length > 0) {
                const inner = ty.typeParams.map(x => getTypeString(x)).join(', ');
                return `${ty.name}<${inner}>`;
            } else {
                return ty.name;
            }
        }
        case 'FunctionType': {
            const params = ty.fnParamTypes.map(x => getTypeString(x)).join(', ');
            const returnType = getTypeString(ty.fnReturnType);
            return `(${params}) => ${returnType}`;
        }
    }
}

/**
 * Check if it can be used as an index value.
*/
export function checkIfIndexSupported(x: Type, errorNode: AstNode, a: AnalyzeContext): boolean {
    if (compareType(x, numberType) == 'incompatible') {
        dispatchTypeError(x, numberType, errorNode, a);
        return false;
    }
    return true;
}

export function checkIfLogicalOpsSupported(x: Type, errorNode: AstNode, a: AnalyzeContext): boolean {
    if (compareType(x, boolType) == 'incompatible') {
        dispatchTypeError(x, boolType, errorNode, a);
        return false;
    }
    return true;
}

export function checkIfOrderOpsSupported(x: Type, errorNode: AstNode, a: AnalyzeContext): boolean {
    if (compareType(x, numberType) == 'incompatible') {
        dispatchTypeError(x, numberType, errorNode, a);
        return false;
    }
    return true;
}

export function checkIfArithOpsSupported(x: Type, errorNode: AstNode, a: AnalyzeContext): boolean {
    if (compareType(x, numberType) == 'incompatible') {
        dispatchTypeError(x, numberType, errorNode, a);
        return false;
    }
    return true;
}
