import { AnalyzeContext, createNativeFnSymbol, createStructSymbol, createVariableSymbol, Symbol } from './tools.js';
import { anyType, arrayType, charType, FunctionType, numberType, stringType, Type, voidType } from './types.js';

function setDecl(name: string, paramsTy: Type[], returnTy: Type, a: AnalyzeContext) {
    const params = Array(paramsTy.length).map(() => ({ name: 'x' }));
    const ty = new FunctionType({
        isMethod: false,
        fnParamTypes: paramsTy,
        fnReturnType: returnTy,
    });
    a.env.set(name, createNativeFnSymbol(params, ty));
}

function group(name: string, a: AnalyzeContext, handler: (setItem: (name: string, paramsTy: Type[], returnTy: Type) => void) => void) {
    const fields: Map<string, Symbol> = new Map();
    function setItem(name: string, paramsTy: Type[], returnTy: Type) {
        const ty = new FunctionType({
            isMethod: false,
            fnParamTypes: paramsTy,
            fnReturnType: returnTy,
        });
        const symbol = createVariableSymbol(ty, true);
        fields.set(name, symbol);
    }
    handler(setItem);
    a.env.set(name, createStructSymbol(name, fields));
}

export function setDeclarations(a: AnalyzeContext) {
    // number
    a.typeEnv.implement(numberType, 'toString', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: stringType,
    }));
    a.typeEnv.implement(numberType, 'parse', new FunctionType({
        isMethod: false,
        fnParamTypes: [stringType],
        fnReturnType: numberType,
    }));
    a.typeEnv.implement(numberType, 'assertEq', new FunctionType({
        isMethod: false,
        fnParamTypes: [numberType, numberType],
        fnReturnType: voidType,
    }));

    // char
    a.typeEnv.implement(charType, 'toString', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: stringType,
    }));
    a.typeEnv.implement(charType, 'toNumber', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: numberType,
    }));
    a.typeEnv.implement(charType, 'fromNumber', new FunctionType({
        isMethod: false,
        fnParamTypes: [numberType],
        fnReturnType: charType,
    }));

    // string
    a.typeEnv.implement(stringType, 'toChars', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: arrayType, // char[]
    }));
    a.typeEnv.implement(stringType, 'fromChars', new FunctionType({
        isMethod: false,
        fnParamTypes: [arrayType], // char[]
        fnReturnType: stringType,
    }));
    a.typeEnv.implement(stringType, 'concat', new FunctionType({
        isMethod: false,
        fnParamTypes: [stringType, stringType],
        fnReturnType: stringType,
    }));
    a.typeEnv.implement(stringType, 'assertEq', new FunctionType({
        isMethod: false,
        fnParamTypes: [stringType, stringType],
        fnReturnType: voidType,
    }));

    // array
    a.typeEnv.implement(arrayType, 'insert', new FunctionType({
        isMethod: true,
        fnParamTypes: [numberType, anyType],
        fnReturnType: voidType,
    }));
    a.typeEnv.implement(arrayType, 'add', new FunctionType({
        isMethod: true,
        fnParamTypes: [anyType], // char[]
        fnReturnType: voidType,
    }));
    a.typeEnv.implement(arrayType, 'removeAt', new FunctionType({
        isMethod: true,
        fnParamTypes: [numberType],
        fnReturnType: voidType,
    }));
    a.typeEnv.implement(arrayType, 'count', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: numberType,
    }));

    group('console', a, setItem => {
        setItem(
            'write',
            [stringType],
            voidType
        );
        setItem(
            'writeNum',
            [numberType],
            voidType
        );
        setItem(
            'read',
            [],
            stringType
        );
    });

    setDecl(
        'getUnixtime',
        [],
        numberType,
        a
    );
}
