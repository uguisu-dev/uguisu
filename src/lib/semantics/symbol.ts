import { FunctionType, NamedType, Type } from './type.js';

export type Symbol =
  | BadSymbol
  | FuncSymbol
  | NativeFuncSymbol
  | StructSymbol
  | StructFieldSymbol
  | VariableSymbol
  | PremitiveSymbol;

export class BadSymbol {
  kind = 'BadSymbol' as const;
}

export class FuncSymbol {
  kind = 'FuncSymbol' as const;
  constructor(
    public isDefined: boolean,
    public params: { name: string, ty: Type }[],
    public retTy: Type,
    /** for wasm */
    public vars: FuncVar[]
  ) { }

  createType() {
    return new FunctionType(this.params.map(x => x.ty), this.retTy);
  }
}
export type FuncVar = { name: string, isParam: boolean, ty: Type };

export class NativeFuncSymbol {
  kind = 'NativeFuncSymbol' as const;
  constructor(
    public params: { name: string, ty: Type }[],
    public retTy: Type,
  ) { }

  createType() {
    return new FunctionType(this.params.map(x => x.ty), this.retTy);
  }
}

export class StructSymbol {
  kind = 'StructSymbol' as const;
  constructor(
    public name: string,
    public fields: Map<string, StructFieldSymbol>,
  ) { }

  createType() {
    return new NamedType(this.name, this);
  }
}

export class StructFieldSymbol {
  kind = 'StructFieldSymbol' as const;
  constructor(
    public name: string,
    public parent: StructSymbol,
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

export class PremitiveSymbol {
  kind = 'PremitiveSymbol' as const;
  constructor(
    public ty: Type,
  ) { }
}
