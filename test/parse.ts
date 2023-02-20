import assert from 'assert';
import { scan } from '../src/tokenize';
import { parseExpr, parseStatement, makeSuccess } from '../src/parse';
import { makeNumber, makeIdentifier, makeIfStatement } from '../src/ast';

describe('number', () => {
	test('basic', () => {
		const input = '123';
		const expected = makeSuccess(makeNumber('123', 0), 0, 1);
		assert.deepEqual(parseExpr(0, scan(0, input)), expected);
	});
});

describe('identifier', () => {
	test('basic', () => {
		const input = 'abc';
		const expected = makeSuccess(makeIdentifier('abc', 0), 0, 1);
		assert.deepEqual(parseExpr(0, scan(0, input)), expected);
	});
});

describe('if', () => {
	test('basic', () => {
		const input = 'if 1 {}';
		const expected = makeSuccess(makeIfStatement(makeNumber('1', 3), [], 0), 0, 4);
		assert.deepEqual(parseStatement(0, scan(0, input)), expected);
	});
});
