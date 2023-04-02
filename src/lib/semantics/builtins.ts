import {
    AnalyzeContext,
    anyType,
    arrayType,
    createFunctionType,
    createNativeFnSymbol,
    createStructSymbol,
    numberType,
    stringType,
    Symbol,
    ValidType,
    VariableSymbol,
    voidType
} from './tools.js';

function setDecl(name: string, paramsTy: ValidType[], returnTy: ValidType, a: AnalyzeContext) {
    const params = Array(paramsTy.length).map(() => ({ name: 'x' }));
    const ty = createFunctionType(paramsTy, returnTy);
    a.env.set(name, createNativeFnSymbol(params, ty));
}

function group(name: string, a: AnalyzeContext, handler: (setItem: (name: string, paramsTy: ValidType[], returnTy: ValidType) => void) => void) {
    const fields: Map<string, Symbol> = new Map();
    function setItem(name: string, paramsTy: ValidType[], returnTy: ValidType) {
        const ty = createFunctionType(paramsTy, returnTy);
        const symbol = {
            kind: 'VariableSymbol',
            ty,
        } as VariableSymbol;
        fields.set(name, symbol);
    }
    handler(setItem);
    a.env.set(name, createStructSymbol(name, fields));
}

export function setDeclarations(a: AnalyzeContext) {
    group('number', a, setItem => {
        setItem(
            'parse',
            [stringType],
            numberType
        );
        setItem(
            'toString',
            [numberType],
            stringType
        );
        setItem(
            'assertEq',
            [numberType, numberType],
            voidType
        );
    });

    group('string', a, setItem => {
        setItem(
            'concat',
            [stringType, stringType],
            stringType
        );
        setItem(
            'assertEq',
            [stringType, stringType],
            voidType
        );
    });

    group('array', a, setItem => {
        setItem(
            'insert',
            [arrayType, numberType, anyType],
            voidType
        );
        setItem(
            'add',
            [arrayType, anyType],
            voidType
        );
        setItem(
            'removeAt',
            [arrayType, numberType],
            voidType
        );
        setItem(
            'count',
            [arrayType],
            numberType
        );
    });

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
