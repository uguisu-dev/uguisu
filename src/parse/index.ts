import { parseIfStatement } from './syntax';
import { AstNode, makeIdentifier, makeNumber } from '../ast';
import { isEofToken, Token, TokenKind } from '../scan';

export type Result<T> = Success<T> | Failure;

export type Success<T> = {
	success: true,
	index: number,
	next: number,
	data: T,
};

export type Failure = {
	success: false,
	message: string,
	index: number,
};

export function success<T>(data: T, index: number, next: number): Success<T> {
	return {
		success: true,
		index,
		next,
		data,
	};
}

export function failure(message: string, index: number): Failure {
	return {
		success: false,
		message,
		index,
	};
}

export function getToken(index: number, input: Token[]): Token {
	const token = input[index];
	if (token == null) {
		throw new Error('invalid index');
	}
	return token;
}

export function nextToken(index: number, input: Token[]): Success<Token> {
	const token = getToken(index, input);
	return success(token, index, index + 1);
}

/**
 * ```text
 * <Root> = <Statement>*
 * ```
*/
export function parse(offset: number, input: Token[]): AstNode[] {
	let result;
	let index = offset;

	let accum: AstNode[] = [];
	while (true) {
		if (isEofToken(getToken(index, input))) {
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

/**
 * ```text
 * <Statement> = <IfStatement>
 * ```
*/
export function parseStatement(offset: number, input: Token[]): Result<AstNode> {
	let result;

	const token = getToken(offset, input);
	if (token.kind == TokenKind.KEYWORD && token.value == 'if') {
		return parseIfStatement(offset, input);
	}

	// expr
	result = parseExpr(offset, input);
	if (result.success) {
		const expr = result.data;
		// ";"
		result = nextToken(result.next, input);
		if (result.data.kind != TokenKind.PUNCTUATOR || result.data.value != ';') {
			return failure(`unexpected token: ${TokenKind[result.data.kind]}`, result.index);
		}
		return success(expr, result.index, result.next);
	}

	return failure(`unexpected token: ${TokenKind[token.kind]}`, offset);
}

/**
 * ```text
 * <Expr> = <Number> / <Identifier>
 * ```
*/
export function parseExpr(offset: number, input: Token[]): Result<AstNode> {
	let token;
	let index = offset;

	token = getToken(index, input);

	if (token.kind == TokenKind.DIGITS) {
		const node = makeNumber(parseInt(token.value, 10), token.pos);
		index++;
		return success(node, offset, index);
	}

	if (token.kind == TokenKind.IDENTIFIER) {
		const node = makeIdentifier(token.value, token.pos);
		index++;
		return success(node, offset, index);
	}

	return failure(`unexpected token: ${TokenKind[token.kind]}`, offset);
}

/**
 * ```text
 * <Block> = "{" <Statement>* "}"
 * ```
*/
export function parseBlock(offset: number, input: Token[]): Result<AstNode[]> {
	let result;

	// "{"
	result = nextToken(offset, input);
	if (result.data.kind != TokenKind.PUNCTUATOR || result.data.value != '{') {
		return failure(`unexpected token: ${TokenKind[result.data.kind]}`, result.index);
	}

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
	if (result.data.kind != TokenKind.PUNCTUATOR || result.data.value != '}') {
		return failure(`unexpected token: ${TokenKind[result.data.kind]}`, result.index);
	}

	return success(content, offset, result.next);
}

/**
 * ```text
 * <TyLabel> = ":" <Identifier>
 * ```
*/
export function parseTyLabel(offset: number, input: Token[]) {
	// TODO
}
