import { AnalyzeContext, newNativeFnSymbol, ValidType } from './tools.js';

export function setDeclarations(a: AnalyzeContext) {
    setDecl('printStr', ['string'], 'void', a);
    setDecl('printNum', ['number'], 'void', a);
    setDecl('assertEqNum', ['number', 'number'], 'void', a);
    setDecl('assertEqStr', ['string', 'string'], 'void', a);
    setDecl('getUnixtime', [], 'number', a);
    setDecl('concatStr', ['string', 'string'], 'string', a);
    setDecl('toString', ['number'], 'string', a);
}

function setDecl(name: string, paramsTy: ValidType[], returnTy: ValidType, a: AnalyzeContext) {
    const params = paramsTy.map(ty => ({ name: 'x', ty }));
    a.env.set(name, newNativeFnSymbol(params, returnTy));
}
