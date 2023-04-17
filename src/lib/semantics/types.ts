// types

export class TypeEnv {
    private items: TypeEnvItem[];
    private features: Feature[];
    constructor() {
        this.items = [];
        this.features = [];
    }
    addFeature(x: Feature) {
        this.features.push(x);
    }
    getTypeInfo(x: Type): TypeEnvItem {
        // find item
        let info = this.items.find(info => compareType(info.type, x) == 'compatible');
        if (info == null) {
            // new item
            info = new TypeEnvItem(x);
            this.items.push(info);
        }
        return info;
    }
}

export class TypeEnvItem {
    type: Type;
    private features: Map<string, Feature>;
    private implemented: Map<string, Type>;
    constructor(type: Type) {
        this.type = type;
        this.features = new Map();
        this.implemented = new Map();
    }
    setFeature(featureName: string, feature: Feature) {
        this.features.set(featureName, feature);
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

export type CompareTypeResult = 'compatible' | 'incompatible' | 'unknown';

export function compareType(x: Type, y: Type): CompareTypeResult {
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

export function createArrayType(inner: Type) {
    return new NamedType('array', [inner]);
}

// features

export class Feature {
    name: string;
    typeParams: Type[];
    members: Map<string, FeatureMember>;
    constructor(opts: { name: string, typeParams?: Type[], members?: Map<string, FeatureMember> }) {
        this.name = opts.name;
        this.typeParams = opts.typeParams ?? [];
        this.members = opts.members ?? new Map();
    }
    addMember(memberName: string, member: FeatureMember) {
        this.members.set(memberName, member);
    }
}

export class FeatureMember {
    name: string;
    type: Type;
    constructor(name: string, type: Type) {
        this.name = name;
        this.type = type;
    }
}

// expt

function exptFeatures(env: TypeEnv) {
    // equal feature

    /*
    feature Equal<T> {
        fn equal(this, other: T): bool;
    }
    */
    const equalFeature = new Feature({ name: 'Equal', typeParams: [new NamedType('T')] });
    env.addFeature(equalFeature);
    const equalFuncTy = new FunctionType({
        isMethod: true,
        fnParamTypes: [new NamedType('T')],
        fnReturnType: new NamedType('bool'),
    });
    equalFeature.addMember('equal', new FeatureMember('equal', equalFuncTy));

    // arith features

    /*
    feature Arithmetic<T, R> {
        fn add(this, other: T): R;
    }
    */
    const arithmeticFeature = new Feature({ name: 'Arithmetic', typeParams: [new NamedType('T'), new NamedType('R')] });
    env.addFeature(arithmeticFeature);
    const arithFuncTy = new FunctionType({
        isMethod: true,
        fnParamTypes: [new NamedType('T')],
        fnReturnType: new NamedType('R'),
    });
    arithmeticFeature.addMember('add', new FeatureMember('add', arithFuncTy));

    // order feature

    /*
    feature Order<T> {
        fn order(this, other: T): ordering;
    }
    */
    const orderFeature = new Feature({ name: 'Order', typeParams: [new NamedType('T')] });
    env.addFeature(orderFeature);
    const orderFuncTy = new FunctionType({
        isMethod: true,
        fnParamTypes: [new NamedType('T')],
        fnReturnType: new NamedType('Ordering'),
    });
    orderFeature.addMember('order', new FeatureMember('order', orderFuncTy));

    // implement number

    // implement equal for number

    const numberInfo = env.getTypeInfo(new NamedType('number'))!;

    /*
    implement Equal<number> for number {
        fn equal(this, other: number): bool { [native code] }
    }
    */
    numberInfo.setFeature('Equal', equalFeature);
    numberInfo.implement('equal', equalFuncTy);

    // implement arith for number

    /*
    implement Arithmetic<number, number> for number {
        fn add(this, other: number): number { [native code] }
    }
    */
    numberInfo.setFeature('Add', arithmeticFeature);
    numberInfo.implement('add', arithFuncTy);

    // implement order for number

    /*
    implement Order<number> for number {
        fn order(this, other: number): Ordering { [native code] }
    }
    */
    numberInfo.setFeature('Order', orderFeature);
    numberInfo.implement('order', orderFuncTy);
}
