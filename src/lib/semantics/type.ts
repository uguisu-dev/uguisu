import { SyntaxNode } from '../syntax/node.js';
import { AnalyzeContext } from './common.js';
import { Symbol } from './symbol.js';

export type Type =
  | ValidType
  | BadType
  | PendingType;

export type ValidType =
  | AnyType
  | VoidType
  | NeverType
  | PremitiveType
  | NamedType
  | FunctionType
  | GenericType;

export function isValidType(ty: Type): ty is ValidType {
  return ty.kind !== 'BadType' && !isPendingType(ty);
}

export function isPendingType(ty: Type): ty is PendingType {
  return (ty.kind === 'PendingType');
}

export function isNeverType(ty: Type): ty is NeverType {
  return (ty.kind === 'NeverType');
}

export class BadType {
  kind = 'BadType' as const;
}

export class PendingType {
  kind = 'PendingType' as const;
}

export class AnyType {
  kind = 'AnyType' as const;
}

export class VoidType {
  kind = 'VoidType' as const;
}

export class NeverType {
  kind = 'NeverType' as const;
}

export class PremitiveType {
  kind = 'PremitiveType' as const;
  constructor(
    public name: string,
    ) { }
}

export class NamedType {
  kind = 'NamedType' as const;
  constructor(
    public name: string,
    public symbol: Symbol,
    ) { }
}

export class FunctionType {
  kind = 'FunctionType' as const;
  constructor(
    public paramTypes: Type[],
    public returnType: Type
  ) { }
}

export class GenericType {
  kind = 'GenericType' as const;
  constructor(
    public name: string,
    public innerTypes: Type[],
  ) { }
}

// builtin types
export const badType = new BadType();
export const pendingType = new PendingType();
export const anyType = new AnyType();
export const voidType = new VoidType();
export const neverType = new NeverType();
export const numberType = new PremitiveType('number');
export const boolType = new PremitiveType('bool');
export const charType = new PremitiveType('char');
export const stringType = new PremitiveType('string');
export const arrayType = new PremitiveType('array');

export type CompareTypeResult = 'unknown' | 'compatible' | 'incompatible';

export function compareType(x: Type, y: Type): CompareTypeResult {
  if (x.kind === 'BadType' || y.kind === 'BadType') {
    return 'unknown';
  }
  if (isPendingType(x) || isPendingType(y)) {
    return 'incompatible';
  }
  // any type
  if (x.kind == 'AnyType' || y.kind == 'AnyType') {
    if (x.kind == 'VoidType' || y.kind == 'VoidType') {
      return 'incompatible';
    } else {
      return 'compatible';
    }
  }
  if (x.kind != y.kind) {
    return 'incompatible';
  }
  switch (x.kind) {
    case 'VoidType': {
      return 'compatible';
    }
    case 'NeverType': {
      return 'compatible';
    }
    case 'PremitiveType': {
      if (x.name !== (y as PremitiveType).name) {
        return 'incompatible';
      }
      return 'compatible';
    }
    case 'NamedType': {
      if (x.name !== (y as NamedType).name) {
        return 'incompatible';
      }
      if (x.symbol !== (y as NamedType).symbol) {
        return 'incompatible';
      }
      return 'compatible';
    }
    case 'FunctionType': {
      y = y as FunctionType;
      if (x.returnType.kind === 'BadType' || y.returnType.kind === 'BadType') {
        return 'unknown';
      }
      if ([...x.paramTypes, ...y.paramTypes].some(x => x.kind === 'BadType')) {
        return 'unknown';
      }
      if (isPendingType(x.returnType) || isPendingType(y.returnType)) {
        return 'incompatible';
      }
      if ([...x.paramTypes, ...y.paramTypes].some(x => isPendingType(x))) {
        return 'incompatible';
      }
      if (compareType(x.returnType, y.returnType) == 'incompatible') {
        return 'incompatible';
      }
      if (x.paramTypes.length != y.paramTypes.length) {
        return 'incompatible';
      }
      for (let i = 0; i < x.paramTypes.length; i++) {
        if (compareType(x.paramTypes[i], y.paramTypes[i]) == 'incompatible') {
          return 'incompatible';
        }
      }
      return 'compatible';
    }
    case 'GenericType': {
      y = y as GenericType;
      if ([...x.innerTypes, ...y.innerTypes].some(x => x.kind === 'BadType')) {
        return 'unknown';
      }
      if ([...x.innerTypes, ...y.innerTypes].some(x => isPendingType(x))) {
        return 'incompatible';
      }
      if (x.name != y.name) {
        return 'incompatible';
      }
      if (x.innerTypes.length != y.innerTypes.length) {
        return 'incompatible';
      }
      for (let i = 0; i < x.innerTypes.length; i++) {
        if (compareType(x.innerTypes[i], y.innerTypes[i]) == 'incompatible') {
          return 'incompatible';
        }
      }
      return 'compatible';
    }
  }
}

export function dispatchTypeError(actual: Type, expected: Type, errorNode: SyntaxNode, ctx: AnalyzeContext) {
  ctx.dispatchError(`type mismatched. expected \`${getTypeString(expected)}\`, found \`${getTypeString(actual)}\``, errorNode);
}

export function getTypeString(ty: Type): string {
  switch (ty.kind) {
    case 'BadType':
    case 'PendingType': {
      return '?';
    }
    case 'AnyType': {
      return 'any';
    }
    case 'VoidType': {
      return 'void';
    }
    case 'NeverType': {
      return 'never';
    }
    case 'PremitiveType':
    case 'NamedType': {
      return ty.name;
    }
    case 'FunctionType': {
      const params = ty.paramTypes.map(x => getTypeString(x)).join(', ');
      const returnType = getTypeString(ty.returnType);
      return `(${params}) => ${returnType}`;
    }
    case 'GenericType': {
      const inner = ty.innerTypes.map(x => getTypeString(x)).join(', ');
      return `${ty.name}<${inner}>`;
    }
  }
}
