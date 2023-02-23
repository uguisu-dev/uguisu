import { DebugLogger } from '../logger';
import { FunctionDecl, newFunctionDecl, newSourceFile, newTyLabel, SourceFile, TyLabel } from './ast';
import { Scanner } from './scan';
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
 * <Statement> = <IfStatement>
 * ```
*/
function parseStatement(p: Parser) {
	// 	let result;
	
	// 	const token = getToken(offset, input);
	// 	if (token.kind == TokenKind.KEYWORD && token.value == 'if') {
	// 		return parseIfStatement(offset, input);
	// 	}
	
	// 	// expr
	// 	result = parseExpr(offset, input);
	// 	if (result.success) {
	// 		const expr = result.data;
	// 		// ";"
	// 		result = nextToken(result.next, input);
	// 		if (result.data.kind != TokenKind.PUNCTUATOR || result.data.value != ';') {
	// 			return failure(`unexpected token: ${TokenKind[result.data.kind]}`, result.index);
	// 		}
	// 		return success(expr, result.index, result.next);
	// 	}
	
	// 	return failure(`unexpected token: ${TokenKind[token.kind]}`, offset);
}

/**
 * ```text
 * <Expr> = <Number> / <Identifier>
 * ```
*/
function parseExpr(p: Parser)/*: Result<AstNode>*/ {
	// let token;
	// let index = offset;

	// token = getToken(index, input);

	// if (token.kind == TokenKind.NUMBER) {
	// 	const node = makeNumber(parseInt(token.value, 10), token.pos);
	// 	index++;
	// 	return success(node, offset, index);
	// }

	// if (token.kind == TokenKind.IDENTIFIER) {
	// 	const node = makeIdentifier(token.value, token.pos);
	// 	index++;
	// 	return success(node, offset, index);
	// }

	// return failure(`unexpected token: ${TokenKind[token.kind]}`, offset);
}

/**
 * ```text
 * <Block> = "{" <Statement>* "}"
 * ```
*/
function parseBlock(p: Parser)/*: Result<AstNode[]>*/ {
	logger.debugEnter('[parse] parseBlock');
	p.expectAndNext(Token.BeginBrace);
	// parseStatement(p);
	p.expectAndNext(Token.EndBrace);

	// let result;

	// // "{"
	// result = nextToken(offset, input);
	// if (result.data.kind != TokenKind.PUNCTUATOR || result.data.value != '{') {
	// 	return failure(`unexpected token: ${TokenKind[result.data.kind]}`, result.index);
	// }

	// let index = result.next;
	// const content: AstNode[] = [];
	// while (true) {
	// 	// statement
	// 	result = parseStatement(index, input);
	// 	if (!result.success) {
	// 		break;
	// 	}
	// 	content.push(result.data);
	// 	index = result.next;
	// }

	// // "}"
	// result = nextToken(index, input);
	// if (result.data.kind != TokenKind.PUNCTUATOR || result.data.value != '}') {
	// 	return failure(`unexpected token: ${TokenKind[result.data.kind]}`, result.index);
	// }

	logger.debugLeave();
	// return success(content, offset, result.next);
}

/**
 * ```text
 * <TyLabel> = ":" <Identifier>
 * ```
*/
function parseTyLabel(p: Parser): TyLabel {
	p.expectAndNext(Token.Colon);

	const pos = p.getPos();
	p.expect(Token.Ident);
	const name = p.getIdentValue();
	p.next();

	return newTyLabel(pos, name);
}

/**
 * ```text
 * <FunctionDecl> = "fn" <Identifier> "(" <FnDeclParams>? ")" <TyLabel>? <Block>
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
	// TODO
}

/**
 * ```text
 * <FnDeclParam> = <Identifier> <TyLabel>?
 * ```
*/
function parseFnDeclParam(p: Parser) {
	// TODO
}

/**
 * ```text
 * <VariableDecl> = "var" <Identifier> <TyLabel>? ("=" <Expr>)? ";"
 * ```
*/
function parseVariableDecl(p: Parser) {
	// TODO
}

/**
 * ```text
 * <BreakStatement> = "break" ";"
 * ```
*/
function parseBreakStatement(p: Parser) {
	// TODO
}

/**
 * ```text
 * <ReturnStatement> = "return" <Expr>? ";"
 * ```
*/
function parseReturnStatement(p: Parser) {
	// TODO
}

/**
 * ```text
 * <IfStatement> = <IfBlock> ("else" <IfBlock>)* ("else" <Block>)?
 * ```
*/
function parseIfStatement(p: Parser)/*: Result<AstNode>*/ {
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
function parseLoopStatement(p: Parser) {
	// TODO
}

/**
 * ```text
 * <AssignStatement> = <Identifier> ("=" / "+=" / "-=" / "*=" / "/=" / "%=") <Expr> ";"
 * ```
*/
function parseAssignStatement(p: Parser) {
	// TODO
}

//#endregion Statements
