import assert from 'assert';
import { tokenize, makeToken, TokenKind } from '../src';

describe('digit', () => {
	test('0', () => {
		const input = '0';
		const expected = [
			makeToken(TokenKind.Digits, '0', 0),
		];
		assert.deepEqual(tokenize(0, input), expected);
	});

	test('1', () => {
		const input = '1';
		const expected = [
			makeToken(TokenKind.Digits, '1', 0),
		];
		assert.deepEqual(tokenize(0, input), expected);
	});

	test('10', () => {
		const input = '10';
		const expected = [
			makeToken(TokenKind.Digits, '10', 0),
		];
		assert.deepEqual(tokenize(0, input), expected);
	});

	test('01', () => {
		const input = '01';
		const expected = [
			makeToken(TokenKind.Digits, '01', 0),
		];
		assert.deepEqual(tokenize(0, input), expected);
	});

	test('1 0', () => {
		const input = '1 0';
		const expected = [
			makeToken(TokenKind.Digits, '1', 0),
			makeToken(TokenKind.Digits, '0', 2),
		];
		assert.deepEqual(tokenize(0, input), expected);
	});
});

describe('punctuator', () => {
	test('==', () => {
		const input = ' == ';
		const expected = [
			makeToken(TokenKind.Punctuator, '==', 1),
		];
		assert.deepEqual(tokenize(0, input), expected);
	});

	test('=', () => {
		const input = ' =';
		const expected = [
			makeToken(TokenKind.Punctuator, '=', 1),
		];
		assert.deepEqual(tokenize(0, input), expected);
	});

	test('<=', () => {
		const input = ' <= ';
		const expected = [
			makeToken(TokenKind.Punctuator, '<=', 1),
		];
		assert.deepEqual(tokenize(0, input), expected);
	});

	test('<', () => {
		const input = ' < ';
		const expected = [
			makeToken(TokenKind.Punctuator, '<', 1),
		];
		assert.deepEqual(tokenize(0, input), expected);
	});
});
