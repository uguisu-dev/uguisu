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
    group('console', a, setItem => {
        setItem(
            'write',
            [stringType],
            voidType
        );
        setItem(
            'read',
            [],
            stringType
        );
    });

    setDecl(
        'assertEqNum',
        [numberType, numberType],
        voidType,
        a
    );
    setDecl(
        'assertEqStr',
        [stringType, stringType],
        voidType,
        a
    );
    setDecl(
        'getUnixtime',
        [],
        numberType,
        a
    );
    setDecl(
        'concatStr',
        [stringType, stringType],
        stringType,
        a
    );
    setDecl(
        'parseNum',
        [stringType],
        numberType,
        a
    );
    setDecl(
        'numToStr',
        [numberType],
        stringType,
        a
    );
    setDecl(
        'insertItem',
        [arrayType, numberType, anyType],
        voidType,
        a
    );
    setDecl(
        'addItem',
        [arrayType, anyType],
        voidType,
        a
    );
    setDecl(
        'removeItemAt',
        [arrayType, numberType],
        voidType,
        a
    );
    setDecl(
        'countItems',
        [arrayType],
        numberType,
        a
    );
}
