import { UguisuError } from '../misc/errors.js';
import { Trace } from '../misc/trace.js';
import { ProjectInfo } from '../project-file.js';
import { LiteralValue, Scanner, Token } from './scan.js';
import {
    AssignMode,
    BinaryOperator,
    BreakStatement,
    createArrayNode,
    createAssignStatement,
    createBinaryOp,
    createBoolLiteral,
    createBreakStatement,
    createCall,
    createCharLiteral,
    createExprStatement,
    createFieldAccess,
    createFnDeclParam,
    createFunctionDecl,
    createIdentifier,
    createIfExpr,
    createIndexAccess,
    createLoopStatement,
    createNumberLiteral,
    createReturnStatement,
    createSourceFile,
    createStringLiteral,
    createStructDecl,
    createStructDeclField,
    createStructExpr,
    createStructExprField,
    createTyLabel,
    createUnaryOp,
    createVariableDecl,
    ExprNode,
    FileNode,
    FnDeclParam,
    FunctionDecl,
    IfExpr,
    LoopStatement,
    ReturnStatement,
    SourceFile,
    StatementNode,
    StructDecl,
    StructDeclField,
    StructExprField,
    TyLabel,
    VariableDecl
} from './tools.js';

const trace = Trace.getDefault().createChild(false);

export function parse(sourceCode: string, filename: string, projectInfo: ProjectInfo): SourceFile {
    const p = new ParseContext(new Scanner(), projectInfo);
    p.setup(sourceCode);
    return parseSourceFile(p, filename);
}

class ParseContext {
    s: Scanner;
    projectInfo: ProjectInfo;

    constructor(s: Scanner, projectInfo: ProjectInfo) {
        this.s = s;
        this.projectInfo = projectInfo;
    }

    setup(sourceCode: string) {
        this.s.setup(sourceCode);
        this.s.next();
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
        trace.log(`[parse] next`);
        this.s.next();
    }

    tokenIs(token: Token): boolean {
        trace.log(`[parse] tokenIs ${Token[token]} (${this.getToken() == token})`);
        return (this.getToken() == token);
    }

    /**
     * Expect the current token.
    */
    expect(token: Token) {
        if (!this.tokenIs(token)) {
            throw new UguisuError(`unexpected token: ${Token[this.getToken()]}`);
        }
    }

    /**
     * Expect the current token and move to the next token.
    */
    expectAndNext(token: Token) {
        this.expect(token);
        this.next();
    }
}

//#region General

/**
 * ```text
 * <Block> = "{" <Statement>* "}"
 * ```
*/
function parseBlock(p: ParseContext): StatementNode[] {
    trace.enter('[parse] parseBlock');

    p.expectAndNext(Token.BeginBrace);
    const statements: StatementNode[] = [];
    while (!p.tokenIs(Token.EndBrace)) {
        statements.push(parseStatement(p));
    }
    p.expectAndNext(Token.EndBrace);

    trace.leave();
    return statements;
}

/**
 * ```text
 * <TyLabel> = ":" <identifier>
 * ```
*/
function parseTyLabel(p: ParseContext): TyLabel {
    trace.enter('[parse] parseTyLabel');

    p.expectAndNext(Token.Colon);
    const pos = p.getPos();
    p.expect(Token.Ident);
    const name = p.getIdentValue();
    p.next();

    trace.leave();
    return createTyLabel(pos, name);
}

//#endregion General

//#region SourceFile

/**
 * ```text
 * <SourceFile> = (<FunctionDecl>)*
 * ```
*/
function parseSourceFile(p: ParseContext, filename: string): SourceFile {
    let decls: FileNode[] = [];
    trace.enter('[parse] parseSourceFile');

    while (true) {
        trace.enter('[parse] declaration item');
        if (p.tokenIs(Token.EOF)) {
            trace.leave();
            break;
        }
        let exported = false;
        if (p.getToken() == Token.Export) {
            p.next();
            exported = true;
        }
        switch (p.getToken()) {
            case Token.Fn: {
                decls.push(parseFunctionDecl(p, exported));
                break;
            }
            case Token.Struct: {
                decls.push(parseStructDecl(p, exported));
                break;
            }
            default: {
                throw new UguisuError(`unexpected token: ${Token[p.getToken()]}`);
            }
        }
        trace.leave();
    }

    trace.leave();
    return createSourceFile([1, 1], filename, decls);
}

/**
 * ```text
 * <FunctionDecl> = "fn" <identifier> "(" <FnDeclParams>? ")" <TyLabel>? <Block>
 * <FnDeclParams> = <FnDeclParam> ("," <FnDeclParam>)*
 * ```
*/
function parseFunctionDecl(p: ParseContext, exported: boolean): FunctionDecl {
    trace.enter('[parse] parseFunctionDecl');

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

    trace.leave();
    return createFunctionDecl(pos, name, params, body, returnTy, exported);
}

/**
 * ```text
 * <FnDeclParam> = <identifier> <TyLabel>?
 * ```
*/
function parseFnDeclParam(p: ParseContext): FnDeclParam {
    trace.enter('[parse] parseFnDeclParam');

    const pos = p.getPos();
    p.expect(Token.Ident);
    const name = p.getIdentValue();
    p.next();

    let ty;
    if (p.tokenIs(Token.Colon)) {
        ty = parseTyLabel(p);
    }

    trace.leave();
    return createFnDeclParam(pos, name, ty);
}

/**
 * <StructDecl> = "struct" <identifier> "{" <StructDeclFields>? "}"
 * <StructDeclFields> = <StructDeclField> ("," <StructDeclField>)*
*/
function parseStructDecl(p: ParseContext, exported: boolean): StructDecl {
    const pos = p.getPos();
    p.next();

    p.expect(Token.Ident);
    const name = p.getIdentValue();
    p.next();

    p.expectAndNext(Token.BeginBrace);
    let fields: StructDeclField[] = [];
    if (!p.tokenIs(Token.EndBrace)) {
        fields.push(parseStructDeclField(p));
        while (p.tokenIs(Token.Comma)) {
            p.next();
            if (p.tokenIs(Token.EndBrace)) {
                break;
            }
            fields.push(parseStructDeclField(p));
        }
    }
    p.expectAndNext(Token.EndBrace);

    return createStructDecl(pos, name, fields, exported);
}

/**
 * <StructDeclField> = <identifier> <TyLabel>
*/
function parseStructDeclField(p: ParseContext): StructDeclField {
    const pos = p.getPos();

    p.expect(Token.Ident);
    const name = p.getIdentValue();
    p.next();

    const ty = parseTyLabel(p);

    return createStructDeclField(pos, name, ty);
}

//#endregion SourceFile

//#region Statements

/**
 * ```text
 * <Statement> = <VariableDecl> / <AssignStatement> / <LoopStatement> / <ReturnStatement> / <BreakStatement> / <ExprStatement> / <ExprNode>
 * ```
*/
function parseStatement(p: ParseContext): StatementNode {
    switch (p.getToken()) {
        case Token.Var: {
            return parseVariableDecl(p);
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
 *   / <Expr>
 * ```
*/
function parseStatementStartWithExpr(p: ParseContext): StatementNode {
    trace.enter('[parse] parseStatementStartWithExpr');

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
                    mode = '=';
                    break;
                }
                case Token.AddAssign: {
                    mode = '+=';
                    break;
                }
                case Token.SubAssign: {
                    mode = '-=';
                    break;
                }
                case Token.MultAssign: {
                    mode = '*=';
                    break;
                }
                case Token.DivAssign: {
                    mode = '/=';
                    break;
                }
                case Token.ModAssign: {
                    mode = '%=';
                    break;
                }
                default: {
                    throw new UguisuError(`unexpected token: ${Token[p.getToken()]}`);
                }
            }
            const body = parseExpr(p);
            p.expectAndNext(Token.Semi);
            trace.leave();
            return createAssignStatement(expr.pos, expr, body, mode);
        }
        case Token.Semi: {
            p.next();
            trace.leave();
            return createExprStatement(expr.pos, expr);
        }
    }

    trace.leave();
    return expr;
}

/**
 * ```text
 * <VariableDecl> = "var" <identifier> <TyLabel>? ("=" <Expr>)? ";"
 * ```
*/
function parseVariableDecl(p: ParseContext): VariableDecl {
    trace.enter('[parse] parseVariableDecl');

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

    trace.leave();
    return createVariableDecl(pos, name, ty, body);
}

/**
 * ```text
 * <BreakStatement> = "break" ";"
 * ```
*/
function parseBreakStatement(p: ParseContext): BreakStatement {
    trace.enter('[parse] parseBreakStatement');

    const pos = p.getPos();
    p.expectAndNext(Token.Break);
    p.expectAndNext(Token.Semi);

    trace.leave();
    return createBreakStatement(pos);
}

/**
 * ```text
 * <ReturnStatement> = "return" <Expr>? ";"
 * ```
*/
function parseReturnStatement(p: ParseContext): ReturnStatement {
    trace.enter('[parse] parseReturnStatement');

    const pos = p.getPos();
    p.expectAndNext(Token.Return);
    let expr;
    if (!p.tokenIs(Token.Semi)) {
        expr = parseExpr(p);
    }
    p.expectAndNext(Token.Semi);

    trace.leave();
    return createReturnStatement(pos, expr);
}

/**
 * ```text
 * <LoopStatement> = "loop" <Block>
 * ```
*/
function parseLoopStatement(p: ParseContext): LoopStatement {
    trace.enter('[parse] parseLoopStatement');

    const pos = p.getPos();
    p.expectAndNext(Token.Loop);
    const block = parseBlock(p);

    trace.leave();
    return createLoopStatement(pos, block);
}

//#endregion Statements

//#region Expressions

function parseExpr(p: ParseContext): ExprNode {
    return parseInfix(p, 0);
}

type OpInfo = { prec: number, assoc: 'left' | 'right', op: BinaryOperator };

const opTable: Map<Token, OpInfo> = new Map([
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

function parseInfix(p: ParseContext, minPrec: number): ExprNode {
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
        expr = createBinaryOp(pos, info.op, expr, rightExpr);
    }
    return expr;
}

/**
 * ```text
 * <Atom> = <AtomInner> <SuffixChain>
 * ```
*/
function parseAtom(p: ParseContext): ExprNode {
    const expr = parseAtomInner(p);
    return parseSuffixChain(p, expr);
}

/**
 * Consumes a one suffix and the remaining of the chain is consumed in a recursive call.
 * If there is no suffix, the target is returned as is.
*/
function parseSuffixChain(p: ParseContext, target: ExprNode): ExprNode {
    switch (p.getToken()) {
        case Token.BeginParen: { // call
            const pos = p.getPos();
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
            return parseSuffixChain(p, createCall(pos, target, args));
        }
        case Token.Dot: { // field access
            p.next();
            const pos = p.getPos();
            p.expect(Token.Ident);
            const name = p.getIdentValue();
            p.next();
            return parseSuffixChain(p, createFieldAccess(pos, name, target));
        }
        case Token.BeginBracket: { // index access
            const pos = p.getPos();
            p.next();
            const index = parseExpr(p);
            p.expectAndNext(Token.EndBracket);
            return parseSuffixChain(p, createIndexAccess(pos, target, index));
        }
        default: {
            return target;
        }
    }
}

/**
 * ```text
 * <AtomInner> = <NumberLiteral> / <BoolLiteral> / <StringLiteral> / <StructExpr> / <Array> / <IfExpr> / <Identifier> / <Prefix> <Atom> / "(" <Expr> ")"
 * ```
*/
function parseAtomInner(p: ParseContext): ExprNode {
    const pos = p.getPos();
    switch (p.getToken()) {
        case Token.Literal: {
            const literal = p.getLiteralValue();
            p.next();
            if (literal.kind == 'number') {
                return createNumberLiteral(pos, parseInt(literal.value));
            }
            if (literal.kind == 'bool') {
                return createBoolLiteral(pos, (literal.value == 'true'));
            }
            if (literal.kind == 'char') {
                return createCharLiteral(pos, literal.value);
            }
            if (literal.kind == 'string') {
                return createStringLiteral(pos, literal.value);
            }
            throw new UguisuError('not implemented yet');
        }
        case Token.Ident: {
            const name = p.getIdentValue();
            p.next();
            return createIdentifier(pos, name);
        }
        case Token.New: {
            p.next();
            p.expect(Token.Ident);
            const name = p.getIdentValue();
            p.next();
            p.expectAndNext(Token.BeginBrace);
            const fields: StructExprField[] = [];
            if (!p.tokenIs(Token.EndBrace)) {
                fields.push(parseStructExprField(p));
                while (p.tokenIs(Token.Comma)) {
                    p.next();
                    if (p.tokenIs(Token.EndBrace)) {
                        break;
                    }
                    fields.push(parseStructExprField(p));
                }
            }
            p.expectAndNext(Token.EndBrace);
            return createStructExpr(pos, name, fields);
        }
        case Token.BeginBracket: {
            p.next();
            const items: ExprNode[] = [];
            while (!p.tokenIs(Token.EndBracket)) {
                items.push(parseExpr(p));
                if (p.tokenIs(Token.Comma)) {
                    p.next();
                } else {
                    break;
                }
            }
            p.expectAndNext(Token.EndBracket);
            return createArrayNode(pos, items);
        }
        case Token.If: {
            return parseIfExpr(p);
        }
        case Token.Not: {
            p.next();
            const expr = parseAtom(p);
            return createUnaryOp(pos, '!', expr);
        }
        case Token.BeginParen: {
            p.next();
            const expr = parseExpr(p);
            p.expectAndNext(Token.EndParen);
            return expr;
        }
        default: {
            throw new UguisuError(`unexpected token: ${Token[p.getToken()]}`);
        }
    }
}

/**
 * ```text
 * <StructExprField> = <identifier> ":" <Expr>
 * ```
*/
function parseStructExprField(p: ParseContext): StructExprField {
    const pos = p.getPos();
    p.expect(Token.Ident);
    const name = p.getIdentValue();
    p.next();
    p.expectAndNext(Token.Colon);
    const body = parseExpr(p);
    return createStructExprField(pos, name, body);
}

/**
 * ```text
 * <IfExpr> = "if" <Expr> <Block> ("else" (<IfExpr> / <Block>))?
 * ```
*/
function parseIfExpr(p: ParseContext): IfExpr {
    trace.enter('[parse] parseIfStatement');

    const pos = p.getPos();
    p.next();
    const cond = parseExpr(p);
    const thenBlock = parseBlock(p);
    let elseBlock: StatementNode[];
    if (p.tokenIs(Token.Else)) {
        p.next();
        if (p.tokenIs(Token.If)) {
            elseBlock = [parseIfExpr(p)];
        } else {
            elseBlock = parseBlock(p);
        }
    } else {
        elseBlock = [];
    }

    trace.leave();
    return createIfExpr(pos, cond, thenBlock, elseBlock);
}

//#endregion Expressions
