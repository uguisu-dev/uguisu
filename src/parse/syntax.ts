import { failure, nextToken, parseBlock, parseExpr, Result, success } from '.';
import { AstNode, makeIfStatement } from '../ast';
import { Token, TokenKind } from '../scan';

/**
 * ```text
 * <IfStatement> = <IfBlock> ("else" <IfBlock>)* ("else" <Block>)?
 * ```
*/
export function parseIfStatement(offset: number, input: Token[]): Result<AstNode> {
	let result;

	// if block
	result = parseIfBlock(offset, input);
	if (!result.success) {
		return result;
	}
	const cond = result.data[0];
	const thenBlock = result.data[1];

	let index = result.next;
	const elifAccum: [AstNode, AstNode[]][] = [];
	while (true) {
		// "else"
		result = nextToken(index, input);
		if (result.data.kind != TokenKind.KEYWORD || result.data.value != 'else') {
			break;
		}

		// if block
		result = parseIfBlock(result.next, input);
		if (!result.success) {
			break;
		}

		elifAccum.push([result.data[0], result.data[1]]);
		index = result.next;
	}

	// "else"
	let elseBlock: AstNode[] = [];
	result = nextToken(index, input);
	if (result.data.kind == TokenKind.KEYWORD && result.data.value == 'else') {
		// block
		result = parseBlock(result.next, input);
		if (!result.success) {
			return result;
		}
		elseBlock = result.data;
		index = result.next;
	}

	// TODO: else if parts

	const node = makeIfStatement(cond, thenBlock, elseBlock, offset);
	return success(node, offset, index);
}

/**
 * ```text
 * <IfBlock> = "if" <Expr> <Block>
 * ```
*/
function parseIfBlock(offset: number, input: Token[]): Result<[AstNode, AstNode[]]> {
	let result;

	// "if"
	result = nextToken(offset, input);
	if (result.data.kind != TokenKind.KEYWORD || result.data.value != 'if') {
		return failure(`unexpected token: ${TokenKind[result.data.kind]}`, offset);
	}

	// expr
	result = parseExpr(result.next, input);
	if (!result.success) {
		return result;
	}
	const cond = result.data;

	// block
	result = parseBlock(result.next, input);
	if (!result.success) {
		return result;
	}
	const block = result.data;

	return success([cond, block], offset, result.next);
}
