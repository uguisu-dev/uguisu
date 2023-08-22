import { UguisuError } from '../misc/errors.js';
import { Trace } from '../misc/trace.js';
import { ProjectInfo } from '../project-file.js';
import { LiteralValue, Scanner } from './scan.js';
import {
  AssignMode,
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
  isExprNode,
  LoopStatement,
  ReturnStatement,
  SourceFile,
  StepNode,
  StructDecl,
  StructDeclField,
  StructExprField,
  TyLabel,
  VariableDecl
} from './node.js';
import { Token } from './token.js';

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
function parseBlock(p: ParseContext): StepNode[] {
  trace.enter('[parse] parseBlock');

  p.expectAndNext(Token.BeginBrace);
  const steps: StepNode[] = [];
  while (!p.tokenIs(Token.EndBrace)) {
    const step = parseStatement(p);
    steps.push(step);

    // expr can only be used at the end of a block (IfExpr is ok)
    if (isExprNode(step) && step.kind != 'IfExpr') {
      break;
    }
  }
  p.expectAndNext(Token.EndBrace);

  trace.leave();
  return steps;
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
function parseStatement(p: ParseContext): StepNode {
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
function parseStatementStartWithExpr(p: ParseContext): StepNode {
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
  return parsePratt(p, 0);
}

type OpInfo = PrefixInfo | InfixInfo | PostfixInfo;

type PrefixInfo = { kind: 'prefix', token: PrefixToken, bp: number };
const prefixOp = (token: PrefixToken, bp: number): OpInfo => ({ kind: 'prefix', token, bp });

type PrefixToken =
  | Token.Not
  | Token.Plus
  | Token.Minus;

type InfixInfo = { kind: 'infix', token: InfixToken, lbp: number, rbp: number };
const infixOp = (token: InfixToken, lbp: number, rbp: number): OpInfo => ({ kind: 'infix', token, lbp, rbp });

type InfixToken =
  | Token.Dot
  | Token.Asterisk
  | Token.Slash
  | Token.Percent
  | Token.Plus
  | Token.Minus
  | Token.LessThan
  | Token.LessThanEq
  | Token.GreaterThan
  | Token.GreaterThanEq
  | Token.Eq2
  | Token.NotEq
  | Token.And2
  | Token.Or2;

type PostfixInfo = { kind: 'postfix', token: PostfixToken, bp: number };
const postfixOp = (token: PostfixToken, bp: number): OpInfo => ({ kind: 'postfix', token, bp });

type PostfixToken =
  | Token.BeginBracket
  | Token.BeginParen;

const operators: OpInfo[] = [
  postfixOp(Token.BeginParen, 90),
  postfixOp(Token.BeginBracket, 90),
  infixOp(Token.Dot, 90, 91),
  prefixOp(Token.Not, 80),
  prefixOp(Token.Plus, 80),
  prefixOp(Token.Minus, 80),
  infixOp(Token.Asterisk, 70, 71),
  infixOp(Token.Slash, 70, 71),
  infixOp(Token.Percent, 70, 71),
  infixOp(Token.Plus, 60, 61),
  infixOp(Token.Minus, 60, 61),
  infixOp(Token.LessThan, 50, 51),
  infixOp(Token.LessThanEq, 50, 51),
  infixOp(Token.GreaterThan, 50, 51),
  infixOp(Token.GreaterThanEq, 50, 51),
  infixOp(Token.Eq2, 40, 41),
  infixOp(Token.NotEq, 40, 41),
  infixOp(Token.And2, 30, 31),
  infixOp(Token.Or2, 20, 21),
];

function parsePratt(p: ParseContext, minBp: number): ExprNode {
  // pratt parsing
  // https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html
  const token = p.getToken();
  const prefix = operators.find((x): x is PrefixInfo => x.kind == 'prefix' && x.token == token);
  let left: ExprNode;
  if (prefix != null) {
    // prefix
    left = parsePrefix(p, prefix);
  } else {
    left = parseAtom(p);
  }
  while (true) {
    const token = p.getToken();
    const postfix = operators.find((x): x is PostfixInfo => x.kind == 'postfix' && x.token == token);
    if (postfix != null) {
      // postfix
      if (postfix.bp < minBp) {
        break;
      }
      left = parsePostfix(p, left, postfix);
      continue;
    }
    const infix = operators.find((x): x is InfixInfo => x.kind == 'infix' && x.token == token);
    if (infix != null) {
      // infix
      if (infix.lbp < minBp) {
        break;
      }
      left = parseInfix(p, left, infix);
      continue;
    }
    break;
  }
  return left;
}

function parsePrefix(p: ParseContext, info: PrefixInfo): ExprNode {
  const pos = p.getPos();
  p.next();
  const right = parsePratt(p, info.bp);
  return createUnaryOp(pos, info.token, right);
}

function parsePostfix(p: ParseContext, left: ExprNode, info: PostfixInfo): ExprNode {
  const pos = p.getPos();
  p.next();
  switch (info.token) {
    case Token.BeginBracket: {
      // index access
      const index = parseExpr(p);
      p.expectAndNext(Token.EndBracket);
      return createIndexAccess(pos, left, index);
    }
    case Token.BeginParen: {
      // call
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
      return createCall(pos, left, args);
    }
  }
}

function parseInfix(p: ParseContext, left: ExprNode, info: InfixInfo): ExprNode {
  const pos = p.getPos();
  p.next();
  const right = parsePratt(p, info.rbp);
  if (info.token == Token.Dot) {
    // field access
    if (right.kind !== 'Identifier') {
      throw new UguisuError(`Identifier is expected. ${right.pos[0] + 1}:${right.pos[1] + 1}`);
    }
    return createFieldAccess(pos, right.name, left);
  }
  return createBinaryOp(pos, info.token, left, right);
}

/**
 * ```text
 * <Atom> = <NumberLiteral> / <BoolLiteral> / <StringLiteral> / <StructExpr> / <Array> / <IfExpr> / <Identifier> / "(" <Expr> ")"
 * ```
*/
function parseAtom(p: ParseContext): ExprNode {
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
  let elseBlock: StepNode[];
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
