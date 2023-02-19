import assert from 'assert';
import { scan } from '../src/tokenize';
import { parse } from '../src/parse';
import { makeNumber, makeIdentifier } from '../src/ast';

describe('number', () => {
	test('basic', () => {
		const input = '123';
		const expected = [
			makeNumber('123', 0),
		];
		assert.deepEqual(parse(0, scan(0, input)), expected);
	});
});

describe('identifier', () => {
	test('basic', () => {
		const input = 'abc';
		const expected = [
			makeIdentifier('abc', 0),
		];
		assert.deepEqual(parse(0, scan(0, input)), expected);
	});
});
