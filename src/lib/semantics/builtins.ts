import { AnalysisEnv, newNativeFnSymbol, ValidType } from './tools.js';

export function setDeclarations(env: AnalysisEnv) {
    setDecl('printStr', ['string'], 'void', env);
    setDecl('printNum', ['number'], 'void', env);
    setDecl('assertEqNum', ['number', 'number'], 'void', env);
    setDecl('assertEqStr', ['string', 'string'], 'void', env);
    setDecl('getUnixtime', [], 'number', env);
    setDecl('concatStr', ['string', 'string'], 'string', env);
    setDecl('toString', ['number'], 'string', env);
}

function setDecl(name: string, paramsTy: ValidType[], returnTy: ValidType, env: AnalysisEnv) {
    const params = paramsTy.map(ty => ({ name: 'x', ty }));
    env.set(name, newNativeFnSymbol(params, returnTy));
}
