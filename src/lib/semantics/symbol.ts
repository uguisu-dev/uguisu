import { BadType, FunctionType, PendingType, Type } from './type.js';

export type Symbol =
  | FnSymbol
  | NativeFnSymbol
  | StructSymbol
  | VariableSymbol
  | ExprSymbol;

export type FnSymbol = {
  kind: 'FnSymbol',
  params: { name: string }[],
  ty: FunctionType | PendingType | BadType,
  /** for wasm */
  vars: FnVar[],
};

export function createFunctionSymbol(params: { name: string }[], ty: FunctionType | PendingType | BadType, vars: FnVar[]): FnSymbol {
  return { kind: 'FnSymbol', params, ty, vars };
}

export type FnVar = { name: string, isParam: boolean, ty: Type };

export type NativeFnSymbol = {
  kind: 'NativeFnSymbol',
  params: { name: string }[],
  ty: FunctionType | PendingType | BadType,
};

export function createNativeFnSymbol(params: { name: string }[], ty: FunctionType | PendingType | BadType): NativeFnSymbol {
  return { kind: 'NativeFnSymbol', params, ty };
}

export type StructSymbol = {
  kind: 'StructSymbol',
  name: string,
  fields: Map<string, Symbol>,
};

export function createStructSymbol(name: string, fields: Map<string, Symbol>): StructSymbol {
  return { kind: 'StructSymbol', name, fields };
}

export type VariableSymbol = {
  kind: 'VariableSymbol',
  ty: Type,
  isDefined: boolean,
};

export function createVariableSymbol(ty: Type, isDefined: boolean): VariableSymbol {
  return { kind: 'VariableSymbol', ty, isDefined };
}

export type ExprSymbol = {
  kind: 'ExprSymbol',
  ty: Type,
};

export function createExprSymbol(ty: Type): ExprSymbol {
  return { kind: 'ExprSymbol', ty };
}
