import { DebugLogger } from '../logger';
import {
	AssignMode,
	BreakStatement,
	ExprNode,
	FnDeclParam,
	FunctionDecl,
	IfStatement,
	LoopStatement,
	newAssignStatement,
	newBoolLiteral,
	newBreakStatement,
	newFnDeclParam,
	newFunctionDecl,
	newIdentifier,
	newIfStatement,
	newLoopStatement,
	newNumberLiteral,
	newReturnStatement,
	newSourceFile,
	newStringLiteral,
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
			throw new Error(`unexpected token: ${Token[this.getToken()]}`);
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
			if (literal.kind == LiteralKind.Bool) {
				return newBoolLiteral(pos, (literal.value == 'true'));
			}
			if (literal.kind == LiteralKind.String) {
				return newStringLiteral(pos, literal.value);
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
	let params: FnDeclParam[];
	if (p.getToken() != Token.EndParen) {
		params = parseFnDeclParams(p);
	} else {
		params = [];
	}
	p.expectAndNext(Token.EndParen);

	let returnTy;
	if (p.getToken() == Token.Colon) {
		returnTy = parseTyLabel(p);
	}

	const body = parseBlock(p);

	logger.debugLeave();
	return newFunctionDecl(pos, name, params, body, returnTy);
}

//#region Statements

/**
 * ```text
 * <FnDeclParams> = <FnDeclParam> ("," <FnDeclParam>)*
 * ```
*/
function parseFnDeclParams(p: Parser): FnDeclParam[] {
	logger.debugEnter('[parse] parseFnDeclParams');

	const accum: FnDeclParam[] = [];
	accum.push(parseFnDeclParam(p));
	while (p.getToken() == Token.Comma) {
		p.next();
		accum.push(parseFnDeclParam(p));
	}

	logger.debugLeave();
	return accum;
}

/**
 * ```text
 * <FnDeclParam> = <identifier> <TyLabel>?
 * ```
*/
function parseFnDeclParam(p: Parser): FnDeclParam {
	logger.debugEnter('[parse] parseFnDeclParam');

	const pos = p.getPos();
	p.expect(Token.Ident);
	const name = p.getIdentValue();
	p.next();

	let ty;
	if (p.getToken() == Token.Colon) {
		ty = parseTyLabel(p);
	}

	logger.debugLeave();
	return newFnDeclParam(pos, name, ty);
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
 * <IfStatement> = "if" <Expr> <Block> ("else" (<IfStatement> / <Block>))?
 * ```
*/
function parseIfStatement(p: Parser): IfStatement {
	logger.debugEnter('[parse] parseIfStatement');

	const pos = p.getPos();
	p.next();
	const cond = parseExpr(p);
	const thenBlock = parseBlock(p);
	let elseBlock: StatementNode[];
	if (p.getToken() == Token.Else) {
		p.next();
		if (p.getToken() == Token.If) {
			elseBlock = [parseIfStatement(p)];
		} else {
			elseBlock = parseBlock(p);
		}
	} else {
		elseBlock = [];
	}

	logger.debugLeave();
	return newIfStatement(pos, cond, thenBlock, elseBlock);
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
