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
    const numberInfo = a.typeEnv.getTypeInfo(numberType);
    numberInfo.implement('toString', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: stringType,
    }));
    numberInfo.implement('parse', new FunctionType({
        isMethod: false,
        fnParamTypes: [stringType],
        fnReturnType: numberType,
    }));
    numberInfo.implement('assertEq', new FunctionType({
        isMethod: false,
        fnParamTypes: [numberType, numberType],
        fnReturnType: voidType,
    }));

    // char
    const charInfo = a.typeEnv.getTypeInfo(charType);
    charInfo.implement('toString', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: stringType,
    }));
    charInfo.implement('toNumber', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: numberType,
    }));
    charInfo.implement('fromNumber', new FunctionType({
        isMethod: false,
        fnParamTypes: [numberType],
        fnReturnType: charType,
    }));

    // string
    const stringInfo = a.typeEnv.getTypeInfo(stringType);
    stringInfo.implement('toChars', new FunctionType({
        isMethod: true,
        fnParamTypes: [],
        fnReturnType: arrayType, // char[]
    }));
    stringInfo.implement('fromChars', new FunctionType({
        isMethod: false,
        fnParamTypes: [arrayType], // char[]
        fnReturnType: stringType,
    }));
    stringInfo.implement('concat', new FunctionType({
        isMethod: false,
        fnParamTypes: [stringType, stringType],
        fnReturnType: stringType,
    }));
    stringInfo.implement('assertEq', new FunctionType({
        isMethod: false,
        fnParamTypes: [stringType, stringType],
        fnReturnType: voidType,
    }));

    // array
    const arrayInfo = a.typeEnv.getTypeInfo(arrayType);
    arrayInfo.implement('insert', new FunctionType({
        isMethod: true,
        fnParamTypes: [numberType, anyType],
        fnReturnType: voidType,
    }));
    arrayInfo.implement('add', new FunctionType({
        isMethod: true,
        fnParamTypes: [anyType], // char[]
        fnReturnType: voidType,
    }));
    arrayInfo.implement('removeAt', new FunctionType({
        isMethod: true,
        fnParamTypes: [numberType],
        fnReturnType: voidType,
    }));
    arrayInfo.implement('count', new FunctionType({
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
