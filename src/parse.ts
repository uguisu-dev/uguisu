import { AstNode, makeIdentifier, makeIfStatement, makeNumber } from './ast';
import { Token, TokenKind } from './tokenize';

type Result<T> = Success<T> | Failure;

type Success<T> = {
	success: true,
	index: number,
	next: number,
	data: T,
};

type Failure = {
	success: false,
	message: string,
	index: number,
};

export function makeSuccess<T>(data: T, index: number, next: number): Success<T> {
	return {
		success: true,
		index,
		next,
		data,
	};
}

export function makeFailure(message: string, index: number): Failure {
	return {
		success: false,
		message,
		index,
	};
}

function getToken(index: number, input: Token[]): Token {
	const token = input[index];
	if (token == null) {
		throw new Error('invalid index');
	}
	return token;
}

function nextToken(index: number, input: Token[]): Success<Token> {
	const token = getToken(index, input);
	return makeSuccess(token, index, index + 1);
}

function isEof(x: Token): boolean {
	return x.kind == TokenKind.Eof;
}

export function parse(offset: number, input: Token[]): AstNode[] {
	let result;
	let index = offset;

	let accum: AstNode[] = [];
	while (true) {
		if (isEof(getToken(index, input))) {
			break;
		}

		result = parseStatement(index, input);
		if (result.success) {
			accum.push(result.data);
			index = result.next;
			continue;
		}

		const token = getToken(result.index, input);
		throw new Error(`${result.message} (pos: ${token.pos})`);
	}

	return accum;
}

export function parseStatement(offset: number, input: Token[]): Result<AstNode> {
	const token = getToken(offset, input);

	if (token.kind == TokenKind.Keyword && token.value == 'if') {
		return parseIfStatement(offset, input);
	}

	return makeFailure('unexpected token', offset);
}

export function parseExpr(offset: number, input: Token[]): Result<AstNode> {
	let token;
	let index = offset;

	token = getToken(index, input);

	if (token.kind == TokenKind.Digits) {
		const node = makeNumber(token.value, token.pos);
		index++;
		return makeSuccess(node, offset, index);
	}

	if (token.kind == TokenKind.Identifier) {
		const node = makeIdentifier(token.value, token.pos);
		index++;
		return makeSuccess(node, offset, index);
	}

	return makeFailure('unexpected token', offset);
}

function parseIfStatement(offset: number, input: Token[]): Result<AstNode> {
	let result;

	result = parseIfCondBlock(offset, input);
	if (result.success) {
		const cond = result.data[0];
		const thenBlock = result.data[1];

		// else if blocks

		// else

		const node = makeIfStatement(cond, thenBlock, offset);
		return makeSuccess(node, offset, result.next);
	}

	return result;
}

/**
 * ```text
 * "if" <cond> "{" <statement>... "}"
 * ```
*/
function parseIfCondBlock(offset: number, input: Token[]): Result<[AstNode, AstNode[]]> {
	let result;

	// "if"
	result = nextToken(offset, input);
	if (result.data.kind == TokenKind.Keyword && result.data.value == 'if') {

		// cond
		result = parseExpr(result.next, input);
		if (result.success) {
			const cond = result.data;

			// block
			result = parseBlock(result.next, input);
			if (result.success) {
				const block = result.data;

				return makeSuccess([cond, block], offset, result.next)
			}
		}

		return result;
	}

	return makeFailure('unexpected token', offset);
}

/**
 * ```text
 * "{" <statement>... "}"
 * ```
*/
function parseBlock(offset: number, input: Token[]): Result<AstNode[]> {
	let result;

	// "{"
	result = nextToken(offset, input);
	if (result.success) {
		if (result.data.kind == TokenKind.Punctuator && result.data.value == '{') {

			let index = result.next;
			const content: AstNode[] = [];
			while (true) {
				// statement
				result = parseStatement(index, input);
				if (!result.success) {
					break;
				}
				content.push(result.data);
				index = result.next;
			}

			// "}"
			result = nextToken(index, input);
			if (result.success) {
				if (result.data.kind == TokenKind.Punctuator && result.data.value == '}') {
					return makeSuccess(content, offset, result.next);
				}
			}
		}
	}

	return makeFailure('unexpected token', result.index);
}
