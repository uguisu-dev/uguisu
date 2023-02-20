import { failure, nextToken, parseBlock, parseExpr, Result, Success, success } from '.';
import { AstNode, IfStatementNode, makeIfStatement } from '../ast';
import { Token, TokenKind } from '../scan';

/**
 * ```text
 * <FunctionDeclaration> = "fn" <Identifier> "(" <FnDeclParams>? ")" <TyLabel>? <Block>
 * ```
*/
function parseFunctionDeclaration(offset: number, input: Token[]) {
	// TODO
}

/**
 * ```text
 * <FnDeclParams> = <FnDeclParam> ("," <FnDeclParam>)*
 * ```
*/
function parseFnDeclParams(offset: number, input: Token[]) {
	// TODO
}

/**
 * ```text
 * <FnDeclParam> = <Identifier> <TyLabel>?
 * ```
*/
function parseFnDeclParam(offset: number, input: Token[]) {
	// TODO
}

/**
 * ```text
 * <VariableDeclaration> = "var" <Identifier> ("=" <Expr>)? ";"
 * ```
*/
function parseVariableDeclaration(offset: number, input: Token[]) {
	// TODO
}

/**
 * ```text
 * <IfStatement> = <IfBlock> ("else" <IfBlock>)* ("else" <Block>)?
 * ```
*/
export function parseIfStatement(offset: number, input: Token[]): Result<AstNode> {
	let result;

	const ifBlocks: Success<[AstNode, AstNode[]]>[] = [];

	// if block
	result = parseIfBlock(offset, input);
	if (!result.success) {
		return result;
	}
	ifBlocks.push(result);

	let index = result.next;
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

		ifBlocks.push(result);
		index = result.next;
	}

	// "else"
	let elseBlock: AstNode[] | null = null;
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

	result = desugarIf(0, ifBlocks, elseBlock, input);
	if (result.success) {
		return success(result.data, offset, index);
	} else {
		throw new Error('invalid if statement');
	}
}

function desugarIf(i: number, ifBlocks: Success<[AstNode, AstNode[]]>[], lastElseBlock: AstNode[] | null, input: Token[]): Result<IfStatementNode> {
	if (i < ifBlocks.length) {
		const ifBlock = ifBlocks[i];
		const child = desugarIf(i + 1, ifBlocks, lastElseBlock, input);
		let elseBlock;
		if (child.success) {
			elseBlock = [child.data];
		} else {
			elseBlock = lastElseBlock ?? [];
		}
		const pos = input[ifBlock.index].pos;
		return success(makeIfStatement(ifBlock.data[0], ifBlock.data[1], elseBlock, pos), ifBlock.index, ifBlock.next);
	} else {
		return failure('', 0);
	}
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
