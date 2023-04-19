import { createNativeFnSymbol, createStructSymbol } from './symbols.js';
import { SymbolEnv } from './tools.js';
import {
    anyType,
    arrayType,
    charType,
    CompleteType,
    FunctionType,
    NamedType,
    numberType,
    stringType,
    TypeEnv,
    voidType
} from './types.js';

function setDecl(name: string, paramsTy: CompleteType[], returnTy: CompleteType, env: SymbolEnv) {
    const params = Array(paramsTy.length).map(() => ({ name: 'x' }));
    const ty = new FunctionType({
        isMethod: false,
        fnParamTypes: paramsTy,
        fnReturnType: returnTy,
    });
    env.set(name, createNativeFnSymbol(params, ty));
}

export function setDeclarations(env: SymbolEnv, typeEnv: TypeEnv) {
    // number
    typeEnv.implement(numberType, 'toString', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: stringType,
    }));
    typeEnv.implement(numberType, 'parse', new FunctionType({
        isMethod: false,
        fnParamTypes: [stringType],
        fnReturnType: numberType,
    }));
    typeEnv.implement(numberType, 'assertEq', new FunctionType({
        isMethod: false,
        fnParamTypes: [numberType, numberType],
        fnReturnType: voidType,
    }));

    // char
    typeEnv.implement(charType, 'toString', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: stringType,
    }));
    typeEnv.implement(charType, 'toNumber', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: numberType,
    }));
    typeEnv.implement(charType, 'fromNumber', new FunctionType({
        isMethod: false,
        fnParamTypes: [numberType],
        fnReturnType: charType,
    }));

    // string
    typeEnv.implement(stringType, 'toChars', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: arrayType, // char[]
    }));
    typeEnv.implement(stringType, 'fromChars', new FunctionType({
        isMethod: false,
        fnParamTypes: [arrayType], // char[]
        fnReturnType: stringType,
    }));
    typeEnv.implement(stringType, 'concat', new FunctionType({
        isMethod: false,
        fnParamTypes: [stringType, stringType],
        fnReturnType: stringType,
    }));
    typeEnv.implement(stringType, 'assertEq', new FunctionType({
        isMethod: false,
        fnParamTypes: [stringType, stringType],
        fnReturnType: voidType,
    }));

    // array
    typeEnv.implement(arrayType, 'insert', new FunctionType({
        isMethod: true,
        fnParamTypes: [numberType, anyType],
        fnReturnType: voidType,
    }));
    typeEnv.implement(arrayType, 'add', new FunctionType({
        isMethod: true,
        fnParamTypes: [anyType], // char[]
        fnReturnType: voidType,
    }));
    typeEnv.implement(arrayType, 'removeAt', new FunctionType({
        isMethod: true,
        fnParamTypes: [numberType],
        fnReturnType: voidType,
    }));
    typeEnv.implement(arrayType, 'count', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: numberType,
    }));

    // console namespace
    env.set('console', createStructSymbol('console', new Map()));
    const consoleSpaceTy = new NamedType('console');
    typeEnv.implement(consoleSpaceTy, 'write', new FunctionType({
        isMethod: false,
        fnParamTypes: [stringType],
        fnReturnType: voidType,
    }));
    typeEnv.implement(consoleSpaceTy, 'writeNum', new FunctionType({
        isMethod: false,
        fnParamTypes: [numberType],
        fnReturnType: voidType,
    }));
    typeEnv.implement(consoleSpaceTy, 'read', new FunctionType({
        isMethod: false,
        fnParamTypes: [],
        fnReturnType: stringType,
    }));

    setDecl(
        'getUnixtime',
        [],
        numberType,
        env
    );
}
