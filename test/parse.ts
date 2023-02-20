import assert from 'assert';
import { scan } from '../src/scan';
import { parse, parseExpr, success } from '../src/parse';
import { makeNumber, makeIdentifier, makeIfStatement } from '../src/ast';

describe('number', () => {
	test('basic', () => {
		const input = '123';
		const expected = success(makeNumber(123, 0), 0, 1);
		assert.deepEqual(parseExpr(0, scan(0, input)), expected);
	});
});

describe('identifier', () => {
	test('basic', () => {
		const input = 'abc';
		const expected = success(makeIdentifier('abc', 0), 0, 1);
		assert.deepEqual(parseExpr(0, scan(0, input)), expected);
	});
});

describe('if', () => {
	test('basic', () => {
		const input = 'if 1 {}';
		const expected = [makeIfStatement(makeNumber(1, 3), [], [], 0)];
		assert.deepEqual(parse(0, scan(0, input)), expected);
	});
});
