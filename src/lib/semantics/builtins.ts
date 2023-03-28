import {
    AnalyzeContext,
    createFunctionType,
    createNativeFnSymbol,
    numberType,
    stringType,
    ValidType,
    voidType
} from './tools.js';

function setDecl(name: string, paramsTy: ValidType[], returnTy: ValidType, a: AnalyzeContext) {
    const params = Array(paramsTy.length).map(() => ({ name: 'x' }));
    const ty = createFunctionType(paramsTy, returnTy);
    a.env.set(name, createNativeFnSymbol(params, ty));
}

export function setDeclarations(a: AnalyzeContext) {
    setDecl(
        'printStr',
        [stringType],
        voidType,
        a
    );
    setDecl(
        'printNum',
        [numberType],
        voidType,
        a
    );
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
        'toString',
        [numberType],
        stringType,
        a
    );
}
