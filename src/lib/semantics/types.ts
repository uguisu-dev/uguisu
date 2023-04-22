import { UguisuError } from '../misc/errors.js';
import { AstNode, TyLabel } from '../syntax/tools.js';
import { SymbolEnv, AnalyzeContext } from './tools.js';
import { Symbol } from './symbols.js';

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

export class TypeSymbol {
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

export type Type = IncompleteType | CompleteType;

export type IncompleteType = InvalidType | UnresolvedType;

export type CompleteType = AnyType | VoidType | NeverType | NamedType | FunctionType;

export function isIncompleteType(ty: Type): ty is IncompleteType {
    return isInvalidType(ty) || isUnresolvedType(ty);
}

export function isCompleteType(ty: Type): ty is CompleteType {
    return !isIncompleteType(ty);
}

export function isInvalidType(ty: Type): ty is InvalidType {
    return ty.kind == 'InvalidType';
}

export function isUnresolvedType(ty: Type): ty is UnresolvedType {
    return ty.kind == 'UnresolvedType';
}

export function isAnyType(ty: Type): ty is AnyType {
    return ty.kind == 'AnyType';
}

export function isVoidType(ty: Type): ty is VoidType {
    return ty.kind == 'VoidType';
}

export function isNeverType(ty: Type): ty is NeverType {
    return ty.kind == 'NeverType';
}

export function isNamedType(x: Type): x is NamedType {
    return (x.kind == 'NamedType');
}

export function isFunctionType(ty: Type): ty is FunctionType {
    return ty.kind == 'FunctionType';
}

export class InvalidType {
    kind: 'InvalidType';
    constructor() {
        this.kind = 'InvalidType';
    }
}
export const invalidType = new InvalidType();

export class UnresolvedType {
    kind: 'UnresolvedType';
    constructor() {
        this.kind = 'UnresolvedType';
    }
}
export const unresolvedType = new UnresolvedType();

export class AnyType {
    kind: 'AnyType';
    constructor() {
        this.kind = 'AnyType';
    }
}
export const anyType = new AnyType();

export class VoidType {
    kind: 'VoidType';
    constructor() {
        this.kind = 'VoidType';
    }
}
export const voidType = new VoidType();

export class NeverType {
    kind: 'NeverType';
    constructor() {
        this.kind = 'NeverType';
    }
}
export const neverType = new NeverType();

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

export const numberType = new NamedType('number');
export const boolType = new NamedType('bool');
export const charType = new NamedType('char');
export const stringType = new NamedType('string');
export const arrayType = new NamedType('array');

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

// compare types

export type TypeCompatibility = 'compatible' | 'incompatible' | 'unknown';

export function compareType(x: Type, y: Type): TypeCompatibility {
    if (isIncompleteType(x) || isIncompleteType(y)) {
        return 'unknown';
    }
    if (isAnyType(x) || isAnyType(y)) {
        if (isVoidType(x) || isVoidType(y)) {
            return 'incompatible';
        } else {
            return 'compatible';
        }
    }
    if (x.kind != y.kind) {
        return 'incompatible';
    }
    switch (x.kind) {
        case 'VoidType': {
            return 'compatible';
        }
        case 'NeverType': {
            return 'compatible';
        }
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

export function dispatchTypeError(actual: Type, expected: Type, errorNode: AstNode, ctx: AnalyzeContext) {
    ctx.dispatchError(`type mismatched. expected \`${getTypeString(expected)}\`, found \`${getTypeString(actual)}\``, errorNode);
}

export function getTypeString(ty: Type): string {
    switch (ty.kind) {
        case 'InvalidType':
        case 'UnresolvedType': {
            return '?';
        }
        case 'AnyType': {
            return 'any';
        }
        case 'VoidType': {
            return 'void';
        }
        case 'NeverType': {
            return 'never';
        }
        case 'NamedType': {
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
            return `fn(${params}) -> ${returnType}`;
        }
    }
}

export function getTypeFromSymbol(symbol: Symbol): Type {
    switch (symbol.kind) {
        case 'FnSymbol':
        case 'NativeFnSymbol': {
            return symbol.ty;
        }
        case 'StructSymbol': {
            return new NamedType(symbol.name);
        }
        case 'VariableSymbol': {
            return symbol.ty;
        }
        case 'ExprSymbol': {
            throw new UguisuError('unexpected symbol');
        }
    }
}

export function resolveTyLabel(node: TyLabel, ctx: AnalyzeContext, env: SymbolEnv): Type {
    // builtin type
    switch (node.name) {
        case 'number':
        case 'bool':
        case 'char':
        case 'string':
        case 'array': {
            return new NamedType(node.name);
        }
    }

    // try get user defined type
    const symbol = env.get(node.name);
    if (symbol == null) {
        ctx.dispatchError('unknown type name.', node);
        return invalidType;
    }

    switch (symbol.kind) {
        case 'StructSymbol': {
            return new NamedType(node.name);
        }
        case 'FnSymbol':
        case 'NativeFnSymbol':
        case 'VariableSymbol':
        case 'ExprSymbol': {
            ctx.dispatchError('invalid type name.', node);
            return invalidType;
        }
    }
}

/**
 * Check if it can be used as an index value.
*/
export function checkIfIndexSupported(x: Type, errorNode: AstNode, ctx: AnalyzeContext): boolean {
    if (compareType(x, numberType) == 'incompatible') {
        dispatchTypeError(x, numberType, errorNode, ctx);
        return false;
    }
    return true;
}

export function checkIfLogicalOpsSupported(x: Type, errorNode: AstNode, ctx: AnalyzeContext): boolean {
    if (compareType(x, boolType) == 'incompatible') {
        dispatchTypeError(x, boolType, errorNode, ctx);
        return false;
    }
    return true;
}

export function checkIfOrderOpsSupported(x: Type, errorNode: AstNode, ctx: AnalyzeContext): boolean {
    if (compareType(x, numberType) == 'incompatible') {
        dispatchTypeError(x, numberType, errorNode, ctx);
        return false;
    }
    return true;
}

export function checkIfArithOpsSupported(x: Type, errorNode: AstNode, ctx: AnalyzeContext): boolean {
    if (compareType(x, numberType) == 'incompatible') {
        dispatchTypeError(x, numberType, errorNode, ctx);
        return false;
    }
    return true;
}
