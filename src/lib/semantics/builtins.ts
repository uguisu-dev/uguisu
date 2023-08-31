import { NativeFuncSymbol, StructFieldSymbol, StructSymbol, VariableSymbol } from './symbol.js';
import {
  AnalyzeContext
} from './common.js';
import {
  anyType,
  arrayType,
  charType,
  FunctionType,
  NamedType,
  numberType,
  stringType,
  ValidType,
  voidType
} from './type.js';

function setDecl(name: string, paramsTy: ValidType[], returnTy: ValidType, ctx: AnalyzeContext) {
  const params = paramsTy.map(x => ({ name: 'x', ty: x }));
  const ty = new FunctionType(paramsTy, returnTy);
  ctx.env.set(name, new NativeFuncSymbol(params, ty));
}

function group(name: string, ctx: AnalyzeContext, handler: (setItem: (name: string, paramsTy: ValidType[], returnTy: ValidType) => void) => void) {
  const fields: Map<string, StructFieldSymbol> = new Map();
  function setItem(name: string, paramsTy: ValidType[], returnTy: ValidType) {
    const ty = new FunctionType(paramsTy, returnTy);
    const symbol = new StructFieldSymbol(name, ty);
    fields.set(name, symbol);
  }
  handler(setItem);
  ctx.env.set(name, new VariableSymbol(true, new NamedType(name, new StructSymbol(name, fields))));
}

export function setDeclarations(ctx: AnalyzeContext) {
  group('number', ctx, setItem => {
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

  group('char', ctx, setItem => {
    setItem(
      'fromNumber',
      [numberType],
      charType
    );
    setItem(
      'toNumber',
      [charType],
      numberType
    );
    setItem(
      'toString',
      [charType],
      stringType
    );
  });

  group('string', ctx, setItem => {
    setItem(
      'concat',
      [stringType, stringType],
      stringType
    );
    setItem(
      'fromChars',
      [arrayType],
      stringType
    );
    setItem(
      'toChars',
      [stringType],
      arrayType
    );
    setItem(
      'assertEq',
      [stringType, stringType],
      voidType
    );
  });

  group('array', ctx, setItem => {
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

  group('console', ctx, setItem => {
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
    ctx
  );
}
