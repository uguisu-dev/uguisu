import { UguisuError } from '../misc/errors.js';
import { Trace } from '../misc/trace.js';

const trace = Trace.getDefault().createChild(false);

const space = [' ', '\t', '\r', '\n'];
const digit = /^[0-9]$/;
const wordChar = /^[A-Za-z0-9_]$/;
const spCharTable = new Map([
    ['r', '\r'],
    ['n', '\n'],
    ['t', '\t'],
]);

export type LiteralValue = { kind: LiteralKind, value: string };

export type LiteralKind = 'none' | 'number' | 'string' | 'bool';

export enum Token {
    EOF,
    Ident,
    Literal,

    /** "+" */
    Plus,
    /** "-" */
    Minus,
    /** "*" */
    Asterisk,
    /** "/" */
    Slash,
    /** "%" */
    Percent,
    /** "{" */
    BeginBrace,
    /** "}" */
    EndBrace,
    /** "(" */
    BeginParen,
    /** ")" */
    EndParen,
    /** "." */
    Dot,
    /** "," */
    Comma,
    /** ":" */
    Colon,
    /** ";" */
    Semi,
    /** "=" */
    Assign,
    /** "+=" */
    AddAssign,
    /** "-=" */
    SubAssign,
    /** "*=" */
    MultAssign,
    /** "/=" */
    DivAssign,
    /** "%=" */
    ModAssign,
    /** "==" */
    Eq,
    /** ">" */
    GreaterThan,
    /** ">=" */
    GreaterThanEq,
    /** "<" */
    LessThan,
    /** "<=" */
    LessThanEq,
    /** "!" */
    Not,
    /** "!=" */
    NotEq,
    /** "|" */
    Or,
    /** "&" */
    And,
    /** "||" */
    Or2,
    /** "&&" */
    And2,

    /** "fn" */
    Fn,
    /** "var" */
    Var,
    /** "struct" */
    Struct,
    /** "new" */
    New,
    /** "return" */
    Return,
    /** "if" */
    If,
    /** "else" */
    Else,
    /** "loop" */
    Loop,
    /** "break" */
    Break,
    /** "import" */
    Import,
    /** "export" */
    Export,
}

export class Scanner {
    private sourceCode: string;
    private index: number;
    private line: number;
    private column: number;
    private tokenLine: number;
    private tokenColumn: number;
    private ch: string | null;
    private token: Token;
    private tokenValue: string;
    private literalKind: LiteralKind;

    constructor() {
        this.sourceCode = '';
        this.index = 0;
        this.line = 0;
        this.column = 0;
        this.tokenLine = 0;
        this.tokenColumn = 0;
        this.ch = null;
        this.token = Token.EOF;
        this.tokenValue = '';
        this.literalKind = 'none';
    }

    setup(sourceCode: string) {
        this.sourceCode = sourceCode;
        this.index = 0;
        this.line = 0;
        this.column = 0;
        this.tokenLine = 0;
        this.tokenColumn = 0;
        if (this.isEof()) {
            return;
        }
        this.ch = this.sourceCode[this.index];
    }

    getPos(): [number, number] {
        return [this.tokenLine + 1, this.tokenColumn + 1];
    }

    getToken() {
        return this.token;
    }

    getLiteralValue(): LiteralValue {
        return { kind: this.literalKind, value: this.tokenValue };
    }

    getIdentValue(): string {
        return this.tokenValue;
    }

    private isEof(): boolean {
        return this.index >= this.sourceCode.length;
    }

    /**
     * Move next position and set the character.
    */
    private nextChar() {
        if (this.isEof()) {
            this.ch = null;
            return;
        }

        // set the position according to the previous character
        switch (this.ch) {
            case '\n': {
                this.line++;
                this.column = 0;
                break;
            }
            case '\r': {
                break;
            }
            default: {
                this.column++;
            }
        }
        trace.log(`[scan] pos ${this.line+1},${this.column+1}`);

        this.index++;
        this.ch = this.sourceCode[this.index];
    }

    /**
     * Read a token and move to the next position.
    */
    next() {
        trace.enter(`[scan] read`);
        while (true) {
            if (this.ch == null) {
                this.token = Token.EOF;
                break;
            }
            if (space.includes(this.ch)) {
                this.nextChar();
                continue;
            }
            this.tokenLine = this.line;
            this.tokenColumn = this.column;
            trace.log(`[scan] token pos ${this.tokenLine+1},${this.tokenColumn+1}`);

            if (digit.test(this.ch)) {
                this.readDigits();
                break;
            }

            if (wordChar.test(this.ch)) {
                this.readWord();
                break;
            }

            switch (this.ch) {
                case '+': {
                    this.nextChar();
                    // @ts-ignore
                    if (this.ch == '=') {
                        this.nextChar();
                        this.token = Token.AddAssign;
                    } else {
                        this.token = Token.Plus;
                    }
                    break;
                }
                case '-': {
                    this.nextChar();
                    // @ts-ignore
                    if (this.ch == '=') {
                        this.nextChar();
                        this.token = Token.SubAssign;
                    } else {
                        this.token = Token.Minus;
                    }
                    break;
                }
                case '*': {
                    this.nextChar();
                    // @ts-ignore
                    if (this.ch == '=') {
                        this.nextChar();
                        this.token = Token.MultAssign;
                    } else {
                        this.token = Token.Asterisk;
                    }
                    break;
                }
                case '/': {
                    this.nextChar();
                    // @ts-ignore
                    if (this.ch == '=') {
                        this.nextChar();
                        this.token = Token.DivAssign;
                    } else if (this.ch == '/') {
                        this.nextChar();
                        this.skipCommentLine();
                        continue;
                    } else if (this.ch == '*') {
                        this.nextChar();
                        this.skipCommentRange();
                        continue;
                    } else {
                        this.token = Token.Slash;
                    }
                    break;
                }
                case '%': {
                    this.nextChar();
                    // @ts-ignore
                    if (this.ch == '=') {
                        this.nextChar();
                        this.token = Token.ModAssign;
                    } else {
                        this.token = Token.Percent;
                    }
                    break;
                }
                case '{': {
                    this.token = Token.BeginBrace;
                    this.nextChar();
                    break;
                }
                case '}': {
                    this.token = Token.EndBrace;
                    this.nextChar();
                    break;
                }
                case '(': {
                    this.token = Token.BeginParen;
                    this.nextChar();
                    break;
                }
                case ')': {
                    this.token = Token.EndParen;
                    this.nextChar();
                    break;
                }
                case '.': {
                    this.token = Token.Dot;
                    this.nextChar();
                    break;
                }
                case ',': {
                    this.token = Token.Comma;
                    this.nextChar();
                    break;
                }
                case ':': {
                    this.token = Token.Colon;
                    this.nextChar();
                    break;
                }
                case ';': {
                    this.token = Token.Semi;
                    this.nextChar();
                    break;
                }
                case '=': {
                    this.nextChar();
                    if (this.ch == '=') {
                        this.token = Token.Eq;
                        this.nextChar();
                    } else {
                        this.token = Token.Assign;
                    }
                    break;
                }
                case '>': {
                    this.nextChar();
                    // @ts-ignore
                    if (this.ch == '=') {
                        this.token = Token.GreaterThanEq;
                        this.nextChar();
                    } else {
                        this.token = Token.GreaterThan;
                    }
                    break;
                }
                case '<': {
                    this.nextChar();
                    // @ts-ignore
                    if (this.ch == '=') {
                        this.token = Token.LessThanEq;
                        this.nextChar();
                    } else {
                        this.token = Token.LessThan;
                    }
                    break;
                }
                case '!': {
                    this.nextChar();
                    // @ts-ignore
                    if (this.ch == '=') {
                        this.token = Token.NotEq;
                        this.nextChar();
                    } else {
                        this.token = Token.Not;
                    }
                    break;
                }
                case '&': {
                    this.nextChar();
                    if (this.ch == '&') {
                        this.token = Token.And2;
                        this.nextChar();
                    } else {
                        this.token = Token.And;
                    }
                    break;
                }
                case '|': {
                    this.nextChar();
                    if (this.ch == '|') {
                        this.token = Token.Or2;
                        this.nextChar();
                    } else {
                        this.token = Token.Or;
                    }
                    break;
                }
                case '"': {
                    this.readString();
                    break;
                }
                default: {
                    throw new UguisuError(`invalid character: "${this.ch}"`);
                }
            }
            break;
        }
        trace.leave();
    }

    private readDigits() {
        let buf = '';
        while (true) {
            if (this.ch == null || !digit.test(this.ch)) {
                break;
            }
            buf += this.ch;
            this.nextChar();
        }
        this.token = Token.Literal;
        this.tokenValue = buf;
        this.literalKind = 'number';
    }

    private readWord() {
        let buf = '';
        while (true) {
            if (this.ch == null || !wordChar.test(this.ch)) {
                break;
            }
            buf += this.ch;
            this.nextChar();
        }
        switch (buf) {
            case 'var': {
                this.token = Token.Var;
                break;
            }
            case 'fn': {
                this.token = Token.Fn;
                break;
            }
            case 'struct': {
                this.token = Token.Struct;
                break;
            }
            case 'new': {
                this.token = Token.New;
                break;
            }
            case 'return': {
                this.token = Token.Return;
                break;
            }
            case 'if': {
                this.token = Token.If;
                break;
            }
            case 'else': {
                this.token = Token.Else;
                break;
            }
            case 'loop': {
                this.token = Token.Loop;
                break;
            }
            case 'break': {
                this.token = Token.Break;
                break;
            }
            case 'true': {
                this.token = Token.Literal;
                this.literalKind = 'bool';
                this.tokenValue = buf;
                break;
            }
            case 'false': {
                this.token = Token.Literal;
                this.literalKind = 'bool';
                this.tokenValue = buf;
                break;
            }
            case 'import': {
                this.token = Token.Import;
                break;
            }
            case 'export': {
                this.token = Token.Export;
                break;
            }
            default: {
                this.token = Token.Ident;
                this.tokenValue = buf;
            }
        }
    }

    private readString() {
        this.nextChar();
        let buf = '';
        while (true) {
            if (this.ch == null) {
                throw new UguisuError('unexpected EOF');
            }
            if (this.ch == '"') {
                this.nextChar();
                break;
            } else if (this.ch == '\\') { // special character
                this.nextChar();
                const c = this.ch;
                if (c == null) {
                    throw new UguisuError('unexpected EOF');
                }
                this.nextChar();
                const sc = spCharTable.get(c);
                if (sc == null) {
                    throw new UguisuError('invalid special character');
                }
                buf += sc;
                continue;
            }
            buf += this.ch;
            this.nextChar();
        }
        this.token = Token.Literal;
        this.tokenValue = buf;
        this.literalKind = 'string';
    }

    private skipCommentLine() {
        while (true) {
            if (this.ch == null) {
                break;
            }
            if (this.ch == '\n') {
                this.nextChar();
                break;
            }
            this.nextChar();
        }
    }

    private skipCommentRange() {
        while (true) {
            if (this.ch == null) {
                break;
            }
            if (this.ch == '*') {
                this.nextChar();
                // @ts-ignore
                if (this.ch == '/') {
                    this.nextChar();
                    break;
                }
                continue;
            }
            this.nextChar();
        }
    }
}
