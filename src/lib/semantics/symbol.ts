import { BadType, FunctionType, PendingType, Type } from './type.js';

export type Symbol =
  | FnSymbol
  | NativeFnSymbol
  | StructSymbol
  | VariableSymbol
  | ExprSymbol;

export class FnSymbol {
  kind = 'FnSymbol' as const;
  constructor(
    public params: { name: string }[],
    public ty: FunctionType | PendingType | BadType,
    /** for wasm */
    public vars: FnVar[]
  ) { }
}
export type FnVar = { name: string, isParam: boolean, ty: Type };

export class NativeFnSymbol {
  kind = 'NativeFnSymbol' as const;
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
