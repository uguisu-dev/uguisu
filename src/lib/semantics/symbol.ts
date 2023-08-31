import { Type } from './type.js';

export type Symbol =
  | FuncSymbol
  | NativeFuncSymbol
  | StructSymbol
  | StructFieldSymbol
  | VariableSymbol
  | ExprSymbol;

export class FuncSymbol {
  kind = 'FuncSymbol' as const;
  constructor(
    public isDefined: boolean,
    public params: { name: string, ty: Type }[],
    public retTy: Type,
    /** for wasm */
    public vars: FuncVar[]
  ) { }
}
export type FuncVar = { name: string, isParam: boolean, ty: Type };

export class NativeFuncSymbol {
  kind = 'NativeFuncSymbol' as const;
  constructor(
    public params: { name: string, ty: Type }[],
    public retTy: Type,
  ) { }
}

export class StructSymbol {
  kind = 'StructSymbol' as const;
  constructor(
    public name: string,
    public fields: Map<string, StructFieldSymbol>,
  ) { }
}

export class StructFieldSymbol {
  kind = 'StructFieldSymbol' as const;
  constructor(
    public name: string,
    public ty: Type,
  ) { }
}

export class VariableSymbol {
  kind = 'VariableSymbol' as const;
  constructor(
    public isDefined: boolean,
    public ty: Type,
  ) { }
}

export class ExprSymbol {
  kind = 'ExprSymbol' as const;
  constructor(
    public ty: Type,
  ) { }
}
