import { DebugLogger } from '../logger';
import {
	AssignMode,
	AssignStatement,
	BreakStatement,
	ExprNode,
	FunctionDecl,
	Identifier,
	IfStatement,
	LoopStatement,
	newAssignStatement,
	newBreakStatement,
	newFunctionDecl,
	newIdentifier,
	newLoopStatement,
	newNumberLiteral,
	newReturnStatement,
	newSourceFile,
	newTyLabel,
	newVariableDecl,
	ReturnStatement,
	SourceFile,
	StatementNode,
	TyLabel,
	VariableDecl,
} from './ast';
import { LiteralKind, Scanner } from './scan';
import { Token } from './token';

const logger = DebugLogger.getRootLogger().createChild();
logger.enabled = false;

export class Parser {
	s: Scanner;

	constructor(s: Scanner) {
		this.s = s;
	}

	setup() {
		this.s.setup();
	}

	getPos(): [number, number] {
		return this.s.getPos();
	}

	getToken() {
		return this.s.getToken();
	}

	getIdentValue() {
		return this.s.getIdentValue();
	}

	getLiteralValue() {
		return this.s.getLiteralValue();
	}

	/**
	 * Move to the next token.
	*/
	next() {
		this.s.next();
	}

	/**
	 * Expect the current token.
	*/
	expect(token: Token) {
		logger.debug(`[parse] expect (expect ${Token[token]}, actual ${Token[this.getToken()]})`);
		if (this.getToken() != token) {
			throw new Error(`unexpected token: ${Token[token]}`);
		}
	}

	/**
	 * Expect the current token and move to the next token.
	*/
	expectAndNext(token: Token) {
		this.expect(token);
		this.next();
	}

	parse(filename: string): SourceFile {
		this.next();
		return parseSourceFile(this, filename);
	}
}

/**
 * ```text
 * <SourceFile> = (<FunctionDecl>)*
 * ```
*/
function parseSourceFile(p: Parser, filename: string): SourceFile {
	let funcs: FunctionDecl[] = [];
	logger.debugEnter('[parse] parseSourceFile');

	while (true) {
		logger.debugEnter('[parse] declaration item');
		if (p.getToken() == Token.EOF) {
			logger.debugLeave();
			break;
		}
		switch (p.getToken()) {
			case Token.Fn: {
				funcs.push(parseFunctionDecl(p));
				break;
			}
			default: {
				throw new Error(`unexpected token: ${Token[p.getToken()]}`);
			}
		}
		logger.debugLeave();
	}

	logger.debugLeave();
	return newSourceFile([1, 1], filename, funcs);
}

/**
 * ```text
 * <Statement> = <VariableDecl> / <AssignStatement> / <IfStatement> / <LoopStatement> / <ReturnStatement> / <BreakStatement> / <ExprNode>
 * ```
*/
function parseStatement(p: Parser): StatementNode {
	switch (p.getToken()) {
		case Token.Var: {
			return parseVariableDecl(p);
		}
		case Token.If: {
			return parseIfStatement(p);
		}
		case Token.Loop: {
			return parseLoopStatement(p);
		}
		case Token.Return: {
			return parseReturnStatement(p);
		}
		case Token.Break: {
			return parseBreakStatement(p);
		}
		default: {
			return parseStatementStartWithExpr(p);
		}
	}
}

/**
 * ```text
 * <Expr> = <NumberLiteral> / <BoolLiteral> / <StringLiteral> / <BinaryOp> / <UnaryOp> / <Identifier> / <Call>
 * ```
*/
function parseExpr(p: Parser): ExprNode {
	const pos = p.getPos();
	switch (p.getToken()) {
		case Token.Literal: {
			const literal = p.getLiteralValue();
			p.next();
			if (literal.kind == LiteralKind.Number) {
				return newNumberLiteral(pos, parseInt(literal.value));
			}
			throw new Error('not implemented yet');
		}
		case Token.Ident: {
			const name = p.getIdentValue();
			p.next();
			return newIdentifier(pos, name);
		}
		default: {
			throw new Error(`unexpected token: ${Token[p.getToken()]}`);
		}
	}
}

/**
 * AssignStatement or Identifier
 * ```text
 * <StatementStartWithExpr>
 *   = <Expr> ("=" / "+=" / "-=" / "*=" / "/=" / "%=") <Expr> ";"
 *   / <Expr> ";"
 * ```
*/
function parseStatementStartWithExpr(p: Parser): StatementNode {
	logger.debugEnter('[parse] parseStatementStartWithExpr');

	const expr = parseExpr(p);
	switch (p.getToken()) {
		case Token.Assign: {
			p.next();
			const mode = AssignMode.Assign;
			const body = parseExpr(p);
			p.expectAndNext(Token.Semi);
			logger.debugLeave();
			return newAssignStatement(expr.pos, expr, body, mode);
		}
		case Token.Semi: {
			p.next();
			logger.debugLeave();
			return expr;
		}
		default: {
			throw new Error(`unexpected token: ${Token[p.getToken()]}`);
		}
	}
}

/**
 * ```text
 * <FunctionDecl> = "fn" <identifier> "(" <FnDeclParams>? ")" <TyLabel>? <Block>
 * ```
*/
function parseFunctionDecl(p: Parser): FunctionDecl {
	logger.debugEnter('[parse] parseFunctionDecl');

	const pos = p.getPos();
	p.next();

	p.expect(Token.Ident);
	const name = p.getIdentValue();
	p.next();

	p.expectAndNext(Token.BeginParen);
	parseFnDeclParams(p);
	p.expectAndNext(Token.EndParen);

	let returnTy;
	if (p.getToken() == Token.Colon) {
		returnTy = parseTyLabel(p);
	}

	parseBlock(p);

	logger.debugLeave();
	return newFunctionDecl(pos, name, returnTy);
}

//#region Statements

/**
 * ```text
 * <FnDeclParams> = <FnDeclParam> ("," <FnDeclParam>)*
 * ```
*/
function parseFnDeclParams(p: Parser) {
	logger.debugEnter('[parse] parseFnDeclParams');
	// TODO
	logger.debugLeave();
}

/**
 * ```text
 * <FnDeclParam> = <identifier> <TyLabel>?
 * ```
*/
function parseFnDeclParam(p: Parser) {
	logger.debugEnter('[parse] parseFnDeclParam');
	// TODO
	logger.debugLeave();
}

/**
 * ```text
 * <VariableDecl> = "var" <identifier> <TyLabel>? ("=" <Expr>)? ";"
 * ```
*/
function parseVariableDecl(p: Parser): VariableDecl {
	logger.debugEnter('[parse] parseVariableDecl');

	p.next();
	const pos = p.getPos();
	p.expect(Token.Ident);
	const name = p.getIdentValue();
	p.next();

	let ty;
	if (p.getToken() == Token.Colon) {
		ty = parseTyLabel(p);
	}

	let body;
	if (p.getToken() == Token.Assign) {
		p.next();
		body = parseExpr(p);
	}
	p.expectAndNext(Token.Semi);

	logger.debugLeave();
	return newVariableDecl(pos, name, ty, body);
}

/**
 * ```text
 * <BreakStatement> = "break" ";"
 * ```
*/
function parseBreakStatement(p: Parser): BreakStatement {
	logger.debugEnter('[parse] parseBreakStatement');

	const pos = p.getPos();
	p.expectAndNext(Token.Break);
	p.expectAndNext(Token.Semi);

	logger.debugLeave();
	return newBreakStatement(pos);
}

/**
 * ```text
 * <ReturnStatement> = "return" <Expr>? ";"
 * ```
*/
function parseReturnStatement(p: Parser): ReturnStatement {
	logger.debugEnter('[parse] parseReturnStatement');

	const pos = p.getPos();
	p.expectAndNext(Token.Return);
	let expr;
	if (p.getToken() != Token.Semi) {
		expr = parseExpr(p);
	}
	p.expectAndNext(Token.Semi);

	logger.debugLeave();
	return newReturnStatement(pos, expr);
}

/**
 * ```text
 * <IfStatement> = <IfBlock> ("else" <IfBlock>)* ("else" <Block>)?
 * ```
*/
function parseIfStatement(p: Parser): IfStatement {
	logger.debugEnter('[parse] parseIfStatement');
	// TODO
	logger.debugLeave();

	// let result;

	// const ifBlocks: Success<[AstNode, AstNode[]]>[] = [];

	// // if block
	// result = parseIfBlock(offset, input);
	// if (!result.success) {
	// 	return result;
	// }
	// ifBlocks.push(result);

	// let index = result.next;
	// while (true) {
	// 	// "else"
	// 	result = nextToken(index, input);
	// 	if (result.data.kind != TokenKind.KEYWORD || result.data.value != 'else') {
	// 		break;
	// 	}

	// 	// if block
	// 	result = parseIfBlock(result.next, input);
	// 	if (!result.success) {
	// 		break;
	// 	}

	// 	ifBlocks.push(result);
	// 	index = result.next;
	// }

	// // "else"
	// let elseBlock: AstNode[] | null = null;
	// result = nextToken(index, input);
	// if (result.data.kind == TokenKind.KEYWORD && result.data.value == 'else') {
	// 	// block
	// 	result = parseBlock(result.next, input);
	// 	if (!result.success) {
	// 		return result;
	// 	}
	// 	elseBlock = result.data;
	// 	index = result.next;
	// }

	// result = desugarIf(0, ifBlocks, elseBlock, input);
	// if (result.success) {
	// 	return success(result.data, offset, index);
	// } else {
	// 	throw new Error('invalid if statement');
	// }
}

// function desugarIf(i: number, ifBlocks: Success<[AstNode, AstNode[]]>[], lastElseBlock: AstNode[] | null, input): Result<IfStatementNode> {
// 	if (i < ifBlocks.length) {
// 		const ifBlock = ifBlocks[i];
// 		const child = desugarIf(i + 1, ifBlocks, lastElseBlock, input);
// 		let elseBlock;
// 		if (child.success) {
// 			elseBlock = [child.data];
// 		} else {
// 			elseBlock = lastElseBlock ?? [];
// 		}
// 		const pos = input[ifBlock.index].pos;
// 		return success(makeIfStatement(ifBlock.data[0], ifBlock.data[1], elseBlock, pos), ifBlock.index, ifBlock.next);
// 	} else {
// 		return failure('', 0);
// 	}
// }

/**
 * ```text
 * <IfBlock> = "if" <Expr> <Block>
 * ```
*/
function parseIfBlock(p: Parser)/*: Result<[AstNode, AstNode[]]>*/ {
	logger.debugEnter('[parse] parseIfBlock');
	// TODO
	logger.debugLeave();

	// let result;

	// // "if"
	// result = nextToken(offset, input);
	// if (result.data.kind != TokenKind.KEYWORD || result.data.value != 'if') {
	// 	return failure(`unexpected token: ${TokenKind[result.data.kind]}`, offset);
	// }

	// // expr
	// result = parseExpr(result.next, input);
	// if (!result.success) {
	// 	return result;
	// }
	// const cond = result.data;

	// // block
	// result = parseBlock(result.next, input);
	// if (!result.success) {
	// 	return result;
	// }
	// const block = result.data;

	// return success([cond, block], offset, result.next);
}

/**
 * ```text
 * <LoopStatement> = "loop" <Block>
 * ```
*/
function parseLoopStatement(p: Parser): LoopStatement {
	logger.debugEnter('[parse] parseLoopStatement');

	const pos = p.getPos();
	p.expectAndNext(Token.Loop);
	const block = parseBlock(p);

	logger.debugLeave();
	return newLoopStatement(pos, block);
}

//#endregion Statements

/**
 * ```text
 * <Block> = "{" <Statement>* "}"
 * ```
*/
function parseBlock(p: Parser): StatementNode[] {
	logger.debugEnter('[parse] parseBlock');

	p.expectAndNext(Token.BeginBrace);
	const statements: StatementNode[] = [];
	while (p.getToken() != Token.EndBrace) {
		statements.push(parseStatement(p));
	}
	p.expectAndNext(Token.EndBrace);

	logger.debugLeave();
	return statements;
}

/**
 * ```text
 * <TyLabel> = ":" <identifier>
 * ```
*/
function parseTyLabel(p: Parser): TyLabel {
	logger.debugEnter('[parse] parseTyLabel');

	p.expectAndNext(Token.Colon);
	const pos = p.getPos();
	p.expect(Token.Ident);
	const name = p.getIdentValue();
	p.next();

	logger.debugLeave();
	return newTyLabel(pos, name);
}
