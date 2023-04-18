import { AnalyzeContext, createNativeFnSymbol, createStructSymbol } from './tools.js';
import { anyType, arrayType, charType, FunctionType, NamedType, numberType, stringType, Type, voidType } from './types.js';

function setDecl(name: string, paramsTy: Type[], returnTy: Type, a: AnalyzeContext) {
    const params = Array(paramsTy.length).map(() => ({ name: 'x' }));
    const ty = new FunctionType({
        isMethod: false,
        fnParamTypes: paramsTy,
        fnReturnType: returnTy,
    });
    a.env.set(name, createNativeFnSymbol(params, ty));
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

    // console namespace
    a.env.set('console', createStructSymbol('console', new Map()));
    const consoleSpaceTy = new NamedType('console');
    a.typeEnv.implement(consoleSpaceTy, 'write', new FunctionType({
        isMethod: false,
        fnParamTypes: [stringType],
        fnReturnType: voidType,
    }));
    a.typeEnv.implement(consoleSpaceTy, 'writeNum', new FunctionType({
        isMethod: false,
        fnParamTypes: [numberType],
        fnReturnType: voidType,
    }));
    a.typeEnv.implement(consoleSpaceTy, 'read', new FunctionType({
        isMethod: false,
        fnParamTypes: [],
        fnReturnType: stringType,
    }));

    setDecl(
        'getUnixtime',
        [],
        numberType,
        a
    );
}
