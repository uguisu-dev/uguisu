import { BadType, FunctionType, PendingType, Type } from './type.js';

export type Symbol =
  | FuncSymbol
  | NativeFuncSymbol
  | StructSymbol
  | VariableSymbol
  | ExprSymbol;

export class FuncSymbol {
  kind = 'FuncSymbol' as const;
  constructor(
    public params: { name: string }[],
    public ty: FunctionType | PendingType | BadType,
    /** for wasm */
    public vars: FuncVar[]
  ) { }
}
export type FuncVar = { name: string, isParam: boolean, ty: Type };

export class NativeFuncSymbol {
  kind = 'NativeFuncSymbol' as const;
  constructor(
    public params: { name: string }[],
    public ty: FunctionType | PendingType | BadType,
  ) { }
}

export class StructSymbol {
  kind = 'StructSymbol' as const;
  constructor(
    public name: string,
    public fields: Map<string, Symbol>,
  ) { }
}

export class VariableSymbol {
  kind = 'VariableSymbol' as const;
  constructor(
    public ty: Type,
    public isDefined: boolean,
  ) { }
}

export class ExprSymbol {
  kind = 'ExprSymbol' as const;
  constructor(
    public ty: Type,
  ) { }
}
