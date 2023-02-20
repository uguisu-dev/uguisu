import { AstNode, makeIdentifier, makeIfStatement, makeNumber } from './ast';
import { Token, TokenKind } from './tokenize';

function isEof(index: number, input: Token[]) {
	return index >= input.length;
}

function getToken(index: number, input: Token[]): Token | null {
	return input[index];
}

function nextToken(index: number, input: Token[]): [Token, number] | null {
	if (isEof(index, input)) {
		return null;
	} else {
		return [input[index], index + 1];
	}
}

export function parse(offset: number, input: Token[]): AstNode[] {
	let result;
	let token;
	let index = offset;

	let accum: AstNode[] = [];
	while (!isEof(index, input)) {
		if ((token = getToken(index, input)) != null) {

			result = parseStatement(index, input);
			if (result != null) {
				accum.push(result[0]);
				index = result[1];
				continue;
			}

			throw new Error(`syntax error (index: ${token.pos})`);
		}
	}

	return accum;
}

function parseStatement(offset: number, input: Token[]): [AstNode, number] | null {
	let result;
	let index = offset;

	if ((result = getToken(index, input)) != null) {
		const token = result;
		if (token.kind == TokenKind.Keyword && token.value == 'if') {
			if ((result = parseIfStatement(index, input)) != null) {
				return result;
			}
		}
	}

	return null;
}

export function parseExpr(offset: number, input: Token[]): [AstNode, number] | null {
	let token;
	let index = offset;

	if ((token = getToken(index, input)) != null) {
		if (token.kind == TokenKind.Digits) {
			const node = makeNumber(token.value, token.pos);
			index++;
			return [node, index];
		}

		if (token.kind == TokenKind.Identifier) {
			const node = makeIdentifier(token.value, token.pos);
			index++;
			return [node, index];
		}
	}

	return null;
}

function parseIfStatement(offset: number, input: Token[]): [AstNode, number] | null {
	let result;
	let token;
	let index = offset;

	if ((result = parseIfCondBlock(index, input)) != null) {
		const cond = result[0];
		const thenBlock = result[1];
		index = result[2];

		// else if blocks

		// else

		const node = makeIfStatement(cond, thenBlock, offset);
		return [node, index];
	}

	return null;
}

/**
 * ```text
 * "if" <cond> "{" <statement>... "}"
 * ```
*/
function parseIfCondBlock(offset: number, input: Token[]): [AstNode, AstNode[], number] | null {
	let result;
	let token;
	let index = offset;

	// "if"
	if ((token = getToken(index, input)) != null) {
		if (token.kind == TokenKind.Keyword && token.value == 'if') {
			index++;

			// cond
			if ((result = parseExpr(index, input)) != null) {
				const cond = result[0];
				index = result[1];

				// block
				if ((result = parseBlock(index, input)) != null) {
					const block = result[0];
					index = result[1];
					return [cond, block, index];
				}
			}
		}
	}

	return null;
}

/**
 * ```text
 * "{" <statement>... "}"
 * ```
*/
function parseBlock(offset: number, input: Token[]): [AstNode[], number] | null {
	let result;
	let token;
	let index = offset;

	// "{"
	if ((result = nextToken(index, input)) != null) {
		[token, index] = result;
		if (token.kind == TokenKind.Punctuator && token.value == '{') {

			const content: AstNode[] = [];
			while (true) {
				// statement
				result = parseStatement(index, input);
				if (result == null) {
					break;
				}
				content.push(result[0]);
				index = result[1];
			}

			// "}"
			if ((result = nextToken(index, input)) != null) {
				[token, index] = result;
				if (token.kind == TokenKind.Punctuator && token.value == '}') {
					return [content, index];
				}
			}
		}
	}

	return null;
}
