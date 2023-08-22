import { SyntaxNode } from '../syntax/node.js';
import { AnalyzeContext } from './common.js';

export type Type =
  | ValidType
  | BadType
  | PendingType;

export type ValidType =
  | AnyType
  | VoidType
  | NeverType
  | NamedType
  | FunctionType
  | GenericType;

export function isValidType(ty: Type): ty is ValidType {
  return !isBadType(ty) && !isPendingType(ty);
}

export function isBadType(ty: Type): ty is BadType {
  return ty.kind == 'BadType';
}

export function isPendingType(ty: Type): ty is PendingType {
  return ty.kind == 'PendingType';
}

export function isNeverType(ty: Type): ty is NeverType {
  return ty.kind == 'NeverType';
}

export type BadType = {
  kind: 'BadType',
};

export type PendingType = {
  kind: 'PendingType',
};

export type AnyType = {
  kind: 'AnyType',
};

export type VoidType = {
  kind: 'VoidType',
};

export type NeverType = {
  kind: 'NeverType',
};

export type NamedType = {
  kind: 'NamedType',
  name: string,
};

export function createNamedType(name: string): NamedType {
  return { kind: 'NamedType', name };
}

export type FunctionType = {
  kind: 'FunctionType',
  paramTypes: Type[],
  returnType: Type,
};

export function createFunctionType(paramTypes: Type[], returnType: Type): FunctionType {
  return { kind: 'FunctionType', paramTypes, returnType };
}

export type GenericType = {
  kind: 'GenericType',
  name: string,
  innerTypes: Type[],
};

export function createGenericType(name: string, innerTypes: Type[]): GenericType {
  return { kind: 'GenericType', name, innerTypes };
}

// builtin types
export const badType = { kind: 'BadType' } as BadType;
export const pendingType = { kind: 'PendingType' } as PendingType;
export const anyType = { kind: 'AnyType' } as AnyType;
export const voidType = { kind: 'VoidType' } as VoidType;
export const neverType = { kind: 'NeverType' } as NeverType;
export const numberType = createNamedType('number');
export const boolType = createNamedType('bool');
export const charType = createNamedType('char');
export const stringType = createNamedType('string');
export const arrayType = createNamedType('array');

export type CompareTypeResult = 'unknown' | 'compatible' | 'incompatible';

export function compareType(x: Type, y: Type): CompareTypeResult {
  if (isBadType(x) || isBadType(y)) {
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
    case 'NamedType': {
      if (x.name == (y as NamedType).name) {
        return 'compatible';
      } else {
        return 'incompatible';
      }
      break;
    }
    case 'FunctionType': {
      y = y as FunctionType;
      if (isBadType(x.returnType) || isBadType(y.returnType)) {
        return 'unknown';
      }
      if (isPendingType(x.returnType) || isPendingType(y.returnType)) {
        return 'incompatible';
      }
      for (const ty of [...x.paramTypes, ...y.paramTypes]) {
        if (isBadType(ty) || isBadType(ty)) {
          return 'unknown';
        }
        if (isPendingType(ty) || isPendingType(ty)) {
          return 'incompatible';
        }
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
      for (const ty of [...x.innerTypes, ...y.innerTypes]) {
        if (isBadType(ty) || isBadType(ty)) {
          return 'unknown';
        }
        if (isPendingType(ty) || isPendingType(ty)) {
          return 'incompatible';
        }
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

export function dispatchTypeError(actual: Type, expected: Type, errorNode: SyntaxNode, a: AnalyzeContext) {
  a.dispatchError(`type mismatched. expected \`${getTypeString(expected)}\`, found \`${getTypeString(actual)}\``, errorNode);
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
