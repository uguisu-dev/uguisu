export type Token = {
	kind: TokenKind;
	value: string;
	pos: number;
};

export enum TokenKind {
	Identifier,
	Keyword,
	Digits,
	Punctuator,
}

export function makeToken(kind: TokenKind, value: string, pos: number): Token {
	return { kind, value, pos };
}

function isEof(index: number, input: string) {
	return index >= input.length;
}

function skip(index: number, input: string): string {
	return input.slice(index);
}

function consumeDigits(index: number, input: string): [Token, number] | null {
	let p = index;
	let s;
	const allowedChar = /^[0-9]/;
	let buf = '';

	while (true) {
		s = skip(p, input);
		if (!allowedChar.test(s)) {
			break;
		}
		buf += s[0];
		p++;
	}

	if (buf.length == 0) {
		return null;
	}

	return [makeToken(TokenKind.Digits, buf, index), p];
}

function isKeyword(word: string): boolean {
	return ['fn', 'struct', 'return', 'if', 'else', 'loop', 'number', 'string', 'bool'].includes(word);
}

function consumeWord(index: number, input: string): [Token, number] | null {
	let p = index;
	let s;
	const allowedChar = /^[a-zA-Z0-9_]/;
	let buf = '';

	while (true) {
		s = skip(p, input);
		if (!allowedChar.test(s)) {
			break;
		}
		buf += s[0];
		p++;
	}

	if (buf.length == 0) {
		return null;
	}

	return [makeToken(isKeyword(buf) ? TokenKind.Keyword : TokenKind.Identifier, buf, index), p];
}

const longPunct = ['==', '!=', '<=', '>='];
const punctChar = /^[!%&'()*+,-./:;<=>?`{|}~]/;
function consumePunctuator(index: number, input: string): [Token, number] | null {
	for (const item of longPunct) {
		if (input.startsWith(item, index)) {
			return [makeToken(TokenKind.Punctuator, item, index), index + item.length];
		}
	}
	if (punctChar.test(skip(index, input))) {
		return [makeToken(TokenKind.Punctuator, input[index], index), index + 1];
	}
	return null;
}

export function tokenize(index: number, input: string): Token[] {
	let p = index;
	let result;
	const accum: Token[] = [];

	while (!isEof(p, input)) {
		if (input[p] == ' ') {
			p++;
			continue;
		}

		result = consumeDigits(p, input);
		if (result != null) {
			accum.push(result[0]);
			p = result[1];
			continue;
		}
		result = consumeWord(p, input);
		if (result != null) {
			accum.push(result[0]);
			p = result[1];
			continue;
		}
		result = consumePunctuator(p, input);
		if (result != null) {
			accum.push(result[0]);
			p = result[1];
			continue;
		}
		throw new Error('invalid input');
	}

	return accum;
}