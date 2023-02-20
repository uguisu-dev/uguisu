import assert from 'assert';
import { scan } from '../src/tokenize';
import { parseExpr, parseStatement } from '../src/parse';
import { makeNumber, makeIdentifier, makeIfStatement } from '../src/ast';

describe('number', () => {
	test('basic', () => {
		const input = '123';
		const expected = [makeNumber('123', 0), 1];
		assert.deepEqual(parseExpr(0, scan(0, input)), expected);
	});
});

describe('identifier', () => {
	test('basic', () => {
		const input = 'abc';
		const expected = [makeIdentifier('abc', 0), 1];
		assert.deepEqual(parseExpr(0, scan(0, input)), expected);
	});
});

describe('if', () => {
	test('basic', () => {
		const input = 'if 1 {}';
		const expected = makeIfStatement(makeNumber('1', 1), [], 0);
		assert.deepEqual(parseStatement(0, scan(0, input)), [expected, 4]);
	});
});
