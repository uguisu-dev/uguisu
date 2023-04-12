import { RunContext } from './tools';

class Value<T = any> {
    type: Type;
    raw: T;

    constructor(type: Type, raw: T) {
        this.type = type;
        this.raw = raw;
    }
}

type Type = NamedType | FunctionType | GenericType;

interface IType {
    kind: string;
    compareType(other: Type): boolean;
}

// - type name
// - type parameter
class NamedType implements IType {
    kind: 'NamedType';
    name: string;
    typeVerInfo?: {
        isTypeVar: true,
        typeVarIndex: number,
    } | {
        isTypeVar: false,
    };

    constructor(name: string) {
        this.kind = 'NamedType';
        this.name = name;
    }

    compareType(other: Type): boolean {
        if (other.kind != 'NamedType') {
            return false;
        }
        return (this.name == other.name);
    }
}

class FunctionType implements IType {
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

    compareType(other: Type): boolean {
        if (other.kind != 'FunctionType') {
            return false;
        }
        if (this.isMethod != other.isMethod) {
            return false;
        }
        // check return type
        if (!this.ret.compareType(other.ret)) {
            return false;
        }
        // check params count
        if (this.params.length != other.params.length) {
            return false;
        }
        // check params type
        for (let i = 0; i < this.params.length; i++) {
            if (!this.params[i].compareType(other.params[i])) {
                return false;
            }
        }
        return true;
    }
}

class GenericType implements IType {
    kind: 'GenericType';
    name: string;
    params: Type[];

    constructor(name: string, params: Type[]) {
        this.kind = 'GenericType';
        this.name = name;
        this.params = params;
    }

    compareType(other: Type): boolean {
        if (other.kind != 'GenericType') {
            return false;
        }
        // check params count
        if (this.name != other.name || this.params.length != other.params.length) {
            return false;
        }
        // check params type
        for (let i = 0; i < this.params.length; i++) {
            if (!this.params[i].compareType(other.params[i])) {
                return false;
            }
        }
        return true;
    }
}

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
        return this.types.find(info => info.type.compareType(x));
    }
}

class TypeInfo {
    type: Type;
    features: Map<string, Feature>;
    featureImpl: Map<string, Value>;

    constructor(type: Type) {
        this.type = type;
        this.features = new Map();
        this.featureImpl = new Map();
    }
}

type NativeFn = (r: RunContext, self: Value, args: Value[]) => Value;

function isNativeFn(x: any): x is Function {
    return Object.prototype.toString.call(x) === '[object Function]';
}

type Ordering = 'less' | 'equal' | 'greater';

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

    function buildEqualImpl() {
        function funcImpl(r: RunContext, self: Value, args: Value[]) {
            if (!self.type.compareType(args[0].type)) {
                throw new Error('type error');
            }
            const raw = (self.raw == args[0].raw);
            return new Value(boolTy, raw);
        };
        return new Value<NativeFn>(equalFuncTy, funcImpl);
    }

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
    numberInfo.featureImpl.set('equal', buildEqualImpl());

    // implement arith for number

    function buildArithImpl<T>(predicate: (x: number, y: number) => T) {
        function funcImpl(r: RunContext, self: Value, args: Value[]) {
            if (args[0].type.kind != 'NamedType' || args[0].type.name != 'number') {
                throw new Error('type error');
            }
            const raw = predicate(self.raw, args[0].raw);
            return new Value(self.type, raw);
        };
        return new Value<NativeFn>(arithFuncTy, funcImpl);
    }

    /*
    implement Arithmetic<number, number> for number {
        fn add(this, other: number): number { [native code] }
    }
    */
    numberInfo.features.set('add', arithmeticFeature);
    numberInfo.featureImpl.set('add', buildArithImpl((x, y) => x + y));

    // implement order for number

    /*
    implement Order<number> for number {
        fn order(this, other: number): Ordering { [native code] }
    }
    */
    function buildOrderNumberImpl() {
        function funcImpl(r: RunContext, self: Value, args: Value[]) {
            if (args[0].type.kind != 'NamedType' || args[0].type.name != 'number') {
                throw new Error('type error');
            }
            let ordering: Ordering = 'equal';
            if (self.raw < args[0].raw) {
                ordering = 'less';
            }
            if (self.raw > args[0].raw) {
                ordering = 'greater';
            }
            return new Value(orderingTy, ordering);
        };
        return new Value<NativeFn>(orderFuncTy, funcImpl);
    }
    numberInfo.features.set('order', orderFeature);
    numberInfo.featureImpl.set('order', buildOrderNumberImpl());
}
