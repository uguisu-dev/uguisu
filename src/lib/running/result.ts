import { Value } from './value.js';

export type EvalResult<T> =
  | Complete<T>
  | Return
  | Break;

export class Complete<T> {
  kind = 'Complete' as const;
  constructor(public value: T) { }
}

export class Return {
  kind = 'Return' as const;
  constructor(public value: Value) { }
}

export class Break {
  kind = 'Break' as const;
}

export function isComplete<T>(x: EvalResult<T>): x is Complete<T> {
  return (x.kind === 'Complete');
}

export function isReturn(x: EvalResult<unknown>): x is Return {
  return (x.kind === 'Return');
}

export function isBreak(x: EvalResult<unknown>): x is Break {
  return (x.kind === 'Break');
}
