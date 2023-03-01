import { DebugLogger } from '../logger';
import {
	AssignMode,
	BinaryOperator,
	BreakStatement,
	ExprNode,
	FnDeclParam,
	FunctionDecl,
	IfStatement,
	LoopStatement,
	newAssignStatement,
	newBinaryOp,
	newBoolLiteral,
	newBreakStatement,
	newCall,
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
	newUnaryOp,
	newVariableDecl,
	ReturnStatement,
	SourceFile,
	StatementNode,
	TyLabel,
	VariableDecl,
} from './ast';
import { LiteralKind, LiteralValue, Scanner } from './scan';
import { Token } from './scan';

const logger = DebugLogger.getRootLogger().createChild();
logger.enabled = false;

export class Parser {
	s: Scanner;
	filename: string;

	constructor(s: Scanner) {
		this.s = s;
		this.filename = '';
	}

	setup(sourceCode: string, filename: string) {
		this.filename = filename;
		this.s.setup(sourceCode);
	}

	getPos(): [number, number] {
		return this.s.getPos();
	}

	getToken(): Token {
		return this.s.getToken();
	}

	getIdentValue(): string {
		return this.s.getIdentValue();
	}

	getLiteralValue(): LiteralValue {
		return this.s.getLiteralValue();
	}

	/**
	 * Move to the next token.
	*/
	next() {
		logger.debug(`[parse] next`);
		this.s.next();
	}

	tokenIs(token: Token): boolean {
		logger.debug(`[parse] tokenIs ${Token[token]} (${this.getToken() == token})`);
		return (this.getToken() == token);
	}

	/**
	 * Expect the current token.
	*/
	expect(token: Token) {
		if (!this.tokenIs(token)) {
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

	parse(): SourceFile {
		this.next();
		return parseSourceFile(this, this.filename);
	}
}

//#region General

/**
 * ```text
 * <Block> = "{" <Statement>* "}"
 * ```
*/
function parseBlock(p: Parser): StatementNode[] {
	logger.debugEnter('[parse] parseBlock');

	p.expectAndNext(Token.BeginBrace);
	const statements: StatementNode[] = [];
	while (!p.tokenIs(Token.EndBrace)) {
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

//#endregion General

//#region SourceFile

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
		if (p.tokenIs(Token.EOF)) {
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
 * <FunctionDecl> = "fn" <identifier> "(" <FnDeclParams>? ")" <TyLabel>? <Block>
 * <FnDeclParams> = <FnDeclParam> ("," <FnDeclParam>)*
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
	let params: FnDeclParam[] = [];
	if (!p.tokenIs(Token.EndParen)) {
		params.push(parseFnDeclParam(p));
		while (p.tokenIs(Token.Comma)) {
			p.next();
			if (p.tokenIs(Token.EndParen)) {
				break;
			}
			params.push(parseFnDeclParam(p));
		}
	}
	p.expectAndNext(Token.EndParen);
	let returnTy;
	if (p.tokenIs(Token.Colon)) {
		returnTy = parseTyLabel(p);
	}
	const body = parseBlock(p);

	logger.debugLeave();
	return newFunctionDecl(pos, name, params, body, returnTy);
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
	if (p.tokenIs(Token.Colon)) {
		ty = parseTyLabel(p);
	}

	logger.debugLeave();
	return newFnDeclParam(pos, name, ty);
}

//#endregion SourceFile

//#region Statements

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
 * <StatementStartWithExpr>
 *   = <Expr> ("=" / "+=" / "-=" / "*=" / "/=" / "%=") <Expr> ";"
 *   / <Expr> ";"
 * ```
*/
function parseStatementStartWithExpr(p: Parser): StatementNode {
	logger.debugEnter('[parse] parseStatementStartWithExpr');

	const expr = parseExpr(p);
	switch (p.getToken()) {
		case Token.Assign:
		case Token.AddAssign:
		case Token.SubAssign:
		case Token.MultAssign:
		case Token.DivAssign:
		case Token.ModAssign: {
			const modeToken = p.getToken();
			p.next();
			let mode: AssignMode;
			switch (modeToken) {
				case Token.Assign: {
					mode = AssignMode.Assign;
					break;
				}
				case Token.AddAssign: {
					mode = AssignMode.AddAssign;
					break;
				}
				case Token.SubAssign: {
					mode = AssignMode.SubAssign;
					break;
				}
				case Token.MultAssign: {
					mode = AssignMode.MultAssign;
					break;
				}
				case Token.DivAssign: {
					mode = AssignMode.DivAssign;
					break;
				}
				case Token.ModAssign: {
					mode = AssignMode.ModAssign;
					break;
				}
				default: {
					throw new Error(`unexpected token: ${Token[p.getToken()]}`);
				}
			}
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
	if (p.tokenIs(Token.Colon)) {
		ty = parseTyLabel(p);
	}

	let body;
	if (p.tokenIs(Token.Assign)) {
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
	if (!p.tokenIs(Token.Semi)) {
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
	if (p.tokenIs(Token.Else)) {
		p.next();
		if (p.tokenIs(Token.If)) {
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

//#region Expressions

export function parseExpr(p: Parser): ExprNode {
	return parseInfix(p, 0);
}

type OpInfo = { prec: number, assoc: 'left' | 'right', op: BinaryOperator };

const opTable: Map<number, OpInfo> = new Map([
	// 1
	[Token.Or2, { prec: 1, assoc: 'left', op: '||' }],
	// 2
	[Token.And2, { prec: 2, assoc: 'left', op: '&&' }],
	// 3
	[Token.Eq, { prec: 3, assoc: 'left', op: '==' }],
	[Token.NotEq, { prec: 3, assoc: 'left', op: '!=' }],
	// 4
	[Token.LessThan, { prec: 4, assoc: 'left', op: '<' }],
	[Token.LessThanEq, { prec: 4, assoc: 'left', op: '<=' }],
	[Token.GreaterThan, { prec: 4, assoc: 'left', op: '>' }],
	[Token.GreaterThanEq, { prec: 4, assoc: 'left', op: '>=' }],
	// 5
	[Token.Plus, { prec: 5, assoc: 'left', op: '+' }],
	[Token.Minus, { prec: 5, assoc: 'left', op: '-' }],
	// 6
	[Token.Asterisk, { prec: 6, assoc: 'left', op: '*' }],
	[Token.Slash, { prec: 6, assoc: 'left', op: '/' }],
	[Token.Percent, { prec: 6, assoc: 'left', op: '%' }],
]);

function parseInfix(p: Parser, minPrec: number): ExprNode {
	// precedence climbing
	// https://eli.thegreenplace.net/2012/08/02/parsing-expressions-by-precedence-climbing
	let expr = parseAtom(p);
	while (true) {
		const pos = p.getPos();
		const op = p.getToken();
		const info = opTable.get(op);
		if (info == null || info.prec < minPrec) {
			break;
		}
		let nextMinPrec;
		if (info.assoc == 'left') {
			nextMinPrec = info.prec + 1;
		} else {
			nextMinPrec = info.prec;
		}
		p.next();
		const rightExpr = parseInfix(p, nextMinPrec);
		expr = newBinaryOp(pos, info.op, expr, rightExpr);
	}
	return expr;
}

/**
 * ```text
 * <Atom> = <AtomInner> <SuffixChain>
 * ```
*/
function parseAtom(p: Parser): ExprNode {
	const expr = parseAtomInner(p);
	return parseSuffixChain(p, expr);
}

/**
 * Consumes a one suffix and the remaining of the chain is consumed in a recursive call.
 * If there is no suffix, the target is returned as is.
*/
function parseSuffixChain(p: Parser, target: ExprNode): ExprNode {
	switch (p.getToken()) {
		case Token.BeginParen: {
			break;
		}
		default: {
			return target;
		}
	}

	const pos = p.getPos();
	switch (p.getToken()) {
		case Token.BeginParen: { // call
			p.next();
			const args: ExprNode[] = [];
			if (!p.tokenIs(Token.EndParen)) {
				args.push(parseExpr(p));
				while (p.tokenIs(Token.Comma)) {
					p.next();
					if (p.tokenIs(Token.EndParen)) {
						break;
					}
					args.push(parseExpr(p));
				}
			}
			p.expectAndNext(Token.EndParen);
			target = newCall(pos, target, args);
		}
	}

	return parseSuffixChain(p, target);
}

/**
 * ```text
 * <AtomInner> = <NumberLiteral> / <BoolLiteral> / <StringLiteral> / <Identifier> / <Prefix> <Atom> / "(" <Expr> ")"
 * ```
*/
function parseAtomInner(p: Parser): ExprNode {
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
		case Token.Not: {
			p.next();
			const expr = parseAtom(p);
			return newUnaryOp(pos, '!', expr);
		}
		case Token.BeginParen: {
			p.next();
			const expr = parseExpr(p);
			p.expectAndNext(Token.EndParen);
			return expr;
		}
		default: {
			throw new Error(`unexpected token: ${Token[p.getToken()]}`);
		}
	}
}

//#endregion Expressions
