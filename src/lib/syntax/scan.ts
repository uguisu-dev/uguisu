import { DebugLogger } from '../logger';
import { Token } from './token';

const logger = DebugLogger.getRootLogger().createChild();
logger.enabled = false;

export enum LiteralKind {
	None,
	Number,
	String,
	Bool,
}

export type LiteralValue = { kind: LiteralKind, value: string };

const space = [' ', '\t', '\r', '\n'];
const digit = /^[0-9]$/;
const wordChar = /^[A-Za-z0-9_]$/;

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
		this.literalKind = LiteralKind.None;
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
		logger.debug(`[scan] pos ${this.line+1},${this.column+1}`);

		this.index++;
		this.ch = this.sourceCode[this.index];
	}

	/**
	 * Read a token and move to the next position.
	*/
	next() {
		logger.debugEnter(`[scan] read`);
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
			logger.debug(`[scan] token pos ${this.tokenLine+1},${this.tokenColumn+1}`);

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
					throw new Error(`invalid character: "${this.ch}"`);
				}
			}
			break;
		}
		logger.debugLeave();
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
		this.literalKind = LiteralKind.Number;
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
				this.literalKind = LiteralKind.Bool;
				this.tokenValue = buf;
				break;
			}
			case 'false': {
				this.token = Token.Literal;
				this.literalKind = LiteralKind.Bool;
				this.tokenValue = buf;
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
				throw new Error('unexpected EOF');
			}
			if (this.ch == '"') {
				this.nextChar();
				break;
			}
			buf += this.ch;
			this.nextChar();
		}
		this.token = Token.Literal;
		this.tokenValue = buf;
		this.literalKind = LiteralKind.String;
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
