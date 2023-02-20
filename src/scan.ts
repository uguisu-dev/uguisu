export type Token = {
	kind: TokenKind;
	value: string;
	pos: number;
};

export enum TokenKind {
	IDENTIFIER,
	KEYWORD,
	DIGITS,
	PUNCTUATOR,
	EOF,
}

export function makeToken(kind: TokenKind, value: string, pos: number): Token {
	return { kind, value, pos };
}

export function isEofToken(x: Token): boolean {
	return x.kind == TokenKind.EOF;
}

function isEof(index: number, input: string): boolean {
	return index >= input.length;
}

function skip(index: number, input: string): string {
	return input.slice(index);
}

function scanDigits(index: number, input: string): [Token, number] | null {
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

	return [makeToken(TokenKind.DIGITS, buf, index), p];
}

function isKeyword(word: string): boolean {
	return ['var', 'const', 'let', 'fn', 'struct', 'return', 'if', 'else', 'loop', 'number', 'string', 'bool'].includes(word);
}

function scanWord(index: number, input: string): [Token, number] | null {
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

	return [makeToken(isKeyword(buf) ? TokenKind.KEYWORD : TokenKind.IDENTIFIER, buf, index), p];
}

const longPunct = ['==', '!=', '<=', '>='];
const punctChar = /^[!%&'()*+,-./:;<=>?`{|}~]/;
function scanPunctuator(index: number, input: string): [Token, number] | null {
	for (const item of longPunct) {
		if (input.startsWith(item, index)) {
			return [makeToken(TokenKind.PUNCTUATOR, item, index), index + item.length];
		}
	}
	if (punctChar.test(skip(index, input))) {
		return [makeToken(TokenKind.PUNCTUATOR, input[index], index), index + 1];
	}
	return null;
}

const space = [' ', '\t', '\r', '\n'];
export function scan(index: number, input: string): Token[] {
	let p = index;
	let result;
	const accum: Token[] = [];

	while (!isEof(p, input)) {
		if (space.includes(input[p])) {
			p++;
			continue;
		}

		result = scanDigits(p, input);
		if (result != null) {
			accum.push(result[0]);
			p = result[1];
			continue;
		}
		result = scanWord(p, input);
		if (result != null) {
			accum.push(result[0]);
			p = result[1];
			continue;
		}
		result = scanPunctuator(p, input);
		if (result != null) {
			accum.push(result[0]);
			p = result[1];
			continue;
		}
		throw new Error(`invalid character: "${input[p]}"`);
	}
	accum.push(makeToken(TokenKind.EOF, '', p));

	return accum;
}
