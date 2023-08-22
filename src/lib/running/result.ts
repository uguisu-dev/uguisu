import { Value } from './value.js';

export type EvalResult<T> =
  | OkResult<T>
  | ReturnResult
  | BreakResult;

export type OkResult<T> = {
  code: 'ok',
  value: T,
};

export type ReturnResult = {
  code: 'return',
  value: Value,
};

export type BreakResult = {
  code: 'break',
};

export function createOk<T>(value: T): EvalResult<T> {
  return { code: 'ok', value };
}

export function createReturn<T>(value: Value): EvalResult<T> {
  return { code: 'return', value };
}

export function createBreak<T>(): EvalResult<T> {
  return { code: 'break' };
}

export function isOk<T>(x: EvalResult<T>): x is OkResult<T> {
  return (x.code == 'ok');
}

export function isReturn(x: EvalResult<unknown>): x is ReturnResult {
  return (x.code == 'return');
}

export function isBreak(x: EvalResult<unknown>): x is BreakResult {
  return (x.code == 'break');
}
