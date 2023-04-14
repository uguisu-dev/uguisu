// types

export type Type = NamedType | FunctionType;

export class NamedType {
    kind: 'NamedType';
    name: string;
    genericParams?: Type[];
    constructor(name: string, genericParams?: Type[]) {
        this.kind = 'NamedType';
        this.name = name;
        this.genericParams = genericParams;
    }
}

export class FunctionType {
    kind: 'FunctionType';
    isMethod: boolean;
    params: Type[];
    ret: Type;
    typeVars: Type[];
    constructor(info: { typeVars?: Type[], isMethod?: boolean, params: Type[], ret: Type }) {
        this.kind = 'FunctionType';
        this.typeVars = info.typeVars ?? [];
        this.isMethod = info.isMethod ?? false;
        this.params = info.params;
        this.ret = info.ret;
    }
}

// special types

export const unresolvedType = new NamedType('unresolved');
export const invalidType = new NamedType('invalid');
export const anyType = new NamedType('any');
export const voidType = new NamedType('void');
export const neverType = new NamedType('never');

type SpecialTypeName = 'unresolved' | 'invalid' | 'any' | 'void' | 'never';

export function isSpecialType(x: Type, name: SpecialTypeName): boolean {
    return (x.kind == 'NamedType' && x.name == name && x.genericParams == null);
}

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
            if (x.genericParams != null || y.genericParams != null) {
                if (x.genericParams != null && y.genericParams != null) {
                    // check params count
                    if (x.genericParams.length != y.genericParams.length) {
                        return 'incompatible';
                    }
                    // check params type
                    for (let i = 0; i < x.genericParams.length; i++) {
                        const paramResult = compareType(x.genericParams[i], y.genericParams[i]);
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
            const retResult = compareType(x.ret, y.ret);
            if (retResult != 'compatible') {
                return retResult;
            }
            // check params count
            if (x.params.length != y.params.length) {
                return 'incompatible';
            }
            // check params type
            for (let i = 0; i < x.params.length; i++) {
                const paramResult = compareType(x.params[i], y.params[i]);
                if (paramResult != 'compatible') {
                    return paramResult;
                }
            }
            return 'compatible';
        }
    }
}

// features

class Feature {
    name: string;
    members: Map<string, FeatureMember>;
    constructor(name: string, members: Map<string, FeatureMember>) {
        this.name = name;
        this.members = members;
    }
}

class FeatureMember {
    name: string;
    type: Type;
    constructor(name: string, type: Type) {
        this.name = name;
        this.type = type;
    }
}

class TypeEnv {
    private types: TypeInfo[];
    private features: Feature[];
    constructor() {
        this.types = [];
        this.features = [];
    }
    addFeature(x: Feature) {
        this.features.push(x);
    }
    addTypeInfo(x: TypeInfo) {
        this.types.push(x);
    }
    getTypeInfo(x: Type) {
        return this.types.find(info => compareType(info.type, x) == 'compatible');
    }
}

class TypeInfo {
    type: Type;
    features: Map<string, Feature>;
    featureImpl: Map<string, Type>;
    constructor(type: Type) {
        this.type = type;
        this.features = new Map();
        this.featureImpl = new Map();
    }
}

function setTypes(env: TypeEnv) {
    /*
    type number;
    */
    const numberTy = new NamedType('number');
    env.addTypeInfo(new TypeInfo(numberTy));
    const numberInfo = env.getTypeInfo(numberTy)!;

    /*
    type bool;
    */
    const boolTy = new NamedType('bool');
    env.addTypeInfo(new TypeInfo(boolTy));

    /*
    type Ordering;
    */
    // TODO: enum value
    const orderingTy = new NamedType('Ordering');
    env.addTypeInfo(new TypeInfo(orderingTy));

    // equal feature

    const equalFuncTy = new FunctionType({
        typeVars: [new NamedType('T')],
        isMethod: true,
        params: [new NamedType('T')],
        ret: new NamedType('bool'),
    });

    /*
    feature Equal<T> {
        fn equal(this, other: T): bool;
    }
    */
    const equalFeature = new Feature('Equal', new Map());
    equalFeature.members.set('equal', new FeatureMember('equal', equalFuncTy));
    env.addFeature(equalFeature);

    // arith features

    const arithFuncTy = new FunctionType({
        typeVars: [new NamedType('T'), new NamedType('R')],
        isMethod: true,
        params: [new NamedType('T')],
        ret: new NamedType('R'),
    });

    /*
    feature Arithmetic<T, R> {
        fn add(this, other: T): R;
    }
    */
    const arithmeticFeature = new Feature('Arithmetic', new Map());
    arithmeticFeature.members.set('add', new FeatureMember('add', arithFuncTy));
    env.addFeature(arithmeticFeature);

    // order feature

    const orderFuncTy = new FunctionType({
        typeVars: [new NamedType('T')],
        isMethod: true,
        params: [new NamedType('T')],
        ret: new NamedType('ordering'),
    });

    /*
    feature Order<T> {
        fn order(this, other: T): ordering;
    }
    */
    const orderFeature = new Feature('Order', new Map());
    orderFeature.members.set('order', new FeatureMember('order', orderFuncTy));
    env.addFeature(orderFeature);

    // implement number

    // implement equal for number

    /*
    implement Equal<number> for number {
        fn equal(this, other: number): bool { [native code] }
    }
    */
    numberInfo.features.set('equal', equalFeature);
    numberInfo.featureImpl.set('equal', equalFuncTy);

    // implement arith for number

    /*
    implement Arithmetic<number, number> for number {
        fn add(this, other: number): number { [native code] }
    }
    */
    numberInfo.features.set('add', arithmeticFeature);
    numberInfo.featureImpl.set('add', arithFuncTy);

    // implement order for number

    /*
    implement Order<number> for number {
        fn order(this, other: number): Ordering { [native code] }
    }
    */
    numberInfo.features.set('order', orderFeature);
    numberInfo.featureImpl.set('order', orderFuncTy);
}
