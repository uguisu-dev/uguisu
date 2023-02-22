import { FunctionDecl, SourceFile } from './ast';
import { Scanner } from './scan';
import { Token } from './token';

const debug = false;

export class Parser {
	s: Scanner;

	constructor(s: Scanner) {
		this.s = s;
	}

	setup() {
		this.s.setup();
	}

	debug(message: any, ...params: any[]) {
		if (debug) {
			console.log(message, ...params);
		}
	}

	read() {
		this.s.read();
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

	tryExpect(token: Token): boolean {
		if (this.getToken() != token) {
			return false;
		}
		this.read();
		return true;
	}

	expect(token: Token) {
		if (!this.tryExpect(token)) {
			throw new Error(`expected ${Token[token]}`);
		}
	}

	/**
	 * ```text
	 * <SourceFile> = (<FunctionDecl>)*
	 * ```
	*/
	parse(): SourceFile {
		let funcs: FunctionDecl[] = [];

		while (true) {
			this.read();
			this.debug(Token[this.getToken()]);
			if (this.getToken() == Token.EOF) {
				break;
			}
			switch (this.getToken()) {
				case Token.Fn: {
					this.read();
					parseFunctionDecl(this);
					break;
				}
				default: {
					throw new Error(`unexpected token: ${Token[this.getToken()]}`);
				}
			}
		}

		return new SourceFile(funcs);
	}
}

// export type Result<T> = Success<T> | Failure;

// export type Success<T> = {
// 	success: true,
// 	index: number,
// 	next: number,
// 	data: T,
// };

// export type Failure = {
// 	success: false,
// 	message: string,
// 	index: number,
// };

// export function success<T>(data: T, index: number, next: number): Success<T> {
// 	return {
// 		success: true,
// 		index,
// 		next,
// 		data,
// 	};
// }

// export function failure(message: string, index: number): Failure {
// 	return {
// 		success: false,
// 		message,
// 		index,
// 	};
// }

/**
 * ```text
 * <Statement> = <IfStatement>
 * ```
*/
export function parseStatement(p: Parser) {
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
export function parseExpr(p: Parser)/*: Result<AstNode>*/ {
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
export function parseBlock(p: Parser)/*: Result<AstNode[]>*/ {
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

	// return success(content, offset, result.next);
}

/**
 * ```text
 * <TyLabel> = ":" <Identifier>
 * ```
*/
export function parseTyLabel(p: Parser) {
	// TODO
}

/**
 * ```text
 * <FunctionDecl> = "fn" <Identifier> "(" <FnDeclParams>? ")" <TyLabel>? <Block>
 * ```
*/
export function parseFunctionDecl(p: Parser) {
	p.expect(Token.Ident);
	p.expect(Token.BeginParen);
	p.expect(Token.EndParen);
	p.expect(Token.BeginBrace);
	parseStatement(p);
	p.expect(Token.EndBrace);
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
export function parseIfStatement(p: Parser)/*: Result<AstNode>*/ {
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
