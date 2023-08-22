import { UguisuError } from '../misc/errors.js';
import { UguisuOptions } from '../misc/options.js';
import { FunctionDecl } from '../syntax/node.js';
import { RunningEnv, Symbol } from './common.js';

export type Value =
  | NoneValue
  | NumberValue
  | BoolValue
  | StringValue
  | CharValue
  | StructValue
  | ArrayValue
  | FunctionValue;

export type ValueOf<T extends ValueKind>
  = T extends 'NoneValue' ? NoneValue
  : T extends 'NumberValue' ? NumberValue
  : T extends 'BoolValue' ? BoolValue
  : T extends 'StringValue' ? StringValue
  : T extends 'CharValue' ? CharValue
  : T extends 'StructValue' ? StructValue
  : T extends 'ArrayValue' ? ArrayValue
  : T extends 'FunctionValue' ? FunctionValue
  : never;

export function getTypeName(valueKind: ValueKind): string {
  switch (valueKind) {
    case 'NoneValue': {
      return 'none';
    }
    case 'NumberValue': {
      return 'number';
    }
    case 'BoolValue': {
      return 'bool';
    }
    case 'CharValue': {
      return 'char';
    }
    case 'StringValue': {
      return 'string';
    }
    case 'StructValue': {
      return 'struct';
    }
    case 'ArrayValue': {
      return 'array';
    }
    case 'FunctionValue': {
      return 'fn';
    }
  }
}

export function assertValue<T extends ValueKind>(value: Value, expectKind: T): asserts value is ValueOf<T> {
  if (value.kind != expectKind) {
    throw new UguisuError(`type mismatched. expected \`${getTypeName(expectKind)}\`, found \`${getTypeName(value.kind)}\``);
  }
}

export type ValueKind =
  | 'NoneValue'
  | 'NumberValue'
  | 'BoolValue'
  | 'StringValue'
  | 'CharValue'
  | 'StructValue'
  | 'ArrayValue'
  | 'FunctionValue';

export class NoneValue {
  kind = 'NoneValue' as const;
}
export function isNoneValue(x: Value): x is NoneValue {
  return x.kind === 'NoneValue';
}

export class NumberValue {
  kind = 'NumberValue' as const;
  constructor(public raw: number) { }
}
export function isNumberValue(x: Value): x is NumberValue {
  return x.kind === 'NumberValue';
}

export class BoolValue {
  kind = 'BoolValue' as const;
  constructor(public raw: boolean) { }
}
export function isBoolValue(x: Value): x is BoolValue {
  return x.kind === 'BoolValue';
}

export class StringValue {
  kind = 'StringValue' as const;
  constructor(public raw: string) { }
}
export function isStringValue(x: Value): x is StringValue {
  return x.kind === 'StringValue';
}

export class CharValue {
  kind = 'CharValue' as const;
  constructor(public raw: string) { }
}
export function isCharValue(x: Value): x is CharValue {
  return x.kind === 'CharValue';
}

export class StructValue {
  kind = 'StructValue' as const;
  private _fields: Map<string, Symbol>;
  constructor(fields: Map<string, Symbol>) {
    this._fields = fields;
  }
  getFieldNames() {
    return this._fields.keys();
  }
  lookupField(name: string): Symbol | undefined {
    return this._fields.get(name);
  }
}
export function isStructValue(x: Value): x is StructValue {
  return x.kind === 'StructValue';
}

export class ArrayValue {
  kind = 'ArrayValue' as const;
  private _items: Symbol[];
  constructor(raw: Symbol[]) {
    this._items = raw;
  }
  at(index: number): Symbol | undefined {
    return this._items.at(index);
  }
  insert(index: number, item: Symbol) {
    this._items.splice(index, 0, item);
  }
  removeAt(index: number) {
    this._items.splice(index, 1);
  }
  count(): number {
    return this._items.length;
  }
}
export function isArrayValue(x: Value): x is ArrayValue {
  return x.kind === 'ArrayValue';
}

export class FunctionValue {
  kind = 'FunctionValue' as const;
  user?: {
    node: FunctionDecl;
    env: RunningEnv; // lexical scope
  };
  native?: NativeFuncHandler;
  private constructor(user?: FunctionValue['user'], native?: NativeFuncHandler) {
    this.user = user;
    this.native = native;
  }
  static create(node: FunctionDecl, env: RunningEnv): FunctionValue {
    return new FunctionValue({ node, env }, undefined);
  }
  static createNative(native: NativeFuncHandler): FunctionValue {
    return new FunctionValue(undefined, native);
  }
}
export type NativeFuncHandler = (args: Value[], options: UguisuOptions) => Value;
export function isFunctionValue(x: Value): x is FunctionValue {
  return x.kind === 'FunctionValue';
}
