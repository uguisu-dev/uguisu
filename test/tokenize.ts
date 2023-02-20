import assert from 'assert';
import { scan, TokenKind } from '../src';
import { makeToken } from '../src/scan';

describe('digit', () => {
	test('0', () => {
		const input = '0';
		const expected = [
			makeToken(TokenKind.DIGITS, '0', 0),
			makeToken(TokenKind.EOF, '', 1),
		];
		assert.deepEqual(scan(0, input), expected);
	});

	test('1', () => {
		const input = '1';
		const expected = [
			makeToken(TokenKind.DIGITS, '1', 0),
			makeToken(TokenKind.EOF, '', 1),
		];
		assert.deepEqual(scan(0, input), expected);
	});

	test('10', () => {
		const input = '10';
		const expected = [
			makeToken(TokenKind.DIGITS, '10', 0),
			makeToken(TokenKind.EOF, '', 2),
		];
		assert.deepEqual(scan(0, input), expected);
	});

	test('01', () => {
		const input = '01';
		const expected = [
			makeToken(TokenKind.DIGITS, '01', 0),
			makeToken(TokenKind.EOF, '', 2),
		];
		assert.deepEqual(scan(0, input), expected);
	});

	test('1 0', () => {
		const input = '1 0';
		const expected = [
			makeToken(TokenKind.DIGITS, '1', 0),
			makeToken(TokenKind.DIGITS, '0', 2),
			makeToken(TokenKind.EOF, '', 3),
		];
		assert.deepEqual(scan(0, input), expected);
	});
});

describe('PUNCTUATOR', () => {
	test('==', () => {
		const input = ' == ';
		const expected = [
			makeToken(TokenKind.PUNCTUATOR, '==', 1),
			makeToken(TokenKind.EOF, '', 4),
		];
		assert.deepEqual(scan(0, input), expected);
	});

	test('=', () => {
		const input = ' =';
		const expected = [
			makeToken(TokenKind.PUNCTUATOR, '=', 1),
			makeToken(TokenKind.EOF, '', 2),
		];
		assert.deepEqual(scan(0, input), expected);
	});

	test('<=', () => {
		const input = ' <= ';
		const expected = [
			makeToken(TokenKind.PUNCTUATOR, '<=', 1),
			makeToken(TokenKind.EOF, '', 4),
		];
		assert.deepEqual(scan(0, input), expected);
	});

	test('<', () => {
		const input = ' < ';
		const expected = [
			makeToken(TokenKind.PUNCTUATOR, '<', 1),
			makeToken(TokenKind.EOF, '', 3),
		];
		assert.deepEqual(scan(0, input), expected);
	});
});
