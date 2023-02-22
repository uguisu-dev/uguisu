import { Token } from './token';

export enum LiteralKind {
	None,
	Number,
	String,
	Bool,
}

const space = [' ', '\t', '\r', '\n'];
const digit = /^[0-9]$/;
const wordChar = /^[A-Za-z0-9_]$/;

export class Scanner {
	private source: string;
	private index: number;
	private ch: string | null;
	private _token: Token;
	private tokenValue: string;
	private literalKind: LiteralKind;
	private line: number;
	private column: number;

	constructor(source: string) {
		this.source = source;
		this.index = 0;
		this.ch = null;
		this._token = Token.EOF;
		this.tokenValue = '';
		this.literalKind = LiteralKind.None;
		this.line = 0;
		this.column = 0;
	}

	setup() {
		this.index = 0;
		this.line = 0;
		this.column = 0;
		if (this.isEof()) {
			return;
		}
		this.ch = this.source[this.index];
	}

	getPos(): [number, number] {
		return [this.line + 1, this.column + 1];
	}

	getToken() {
		return this._token;
	}

	getLiteralValue(): { kind: LiteralKind, value: string } {
		return { kind: this.literalKind, value: this.tokenValue };
	}

	getIdentValue(): string {
		return this.tokenValue;
	}

	private isEof(): boolean {
		return this.index >= this.source.length;
	}

	/**
	 * Move next position and set the character.
	*/
	private nextChar() {
		if (this.isEof()) {
			this.ch = null;
			return;
		}

		this.index++;
		const ch = this.source[this.index];
		this.column++;
		if (ch == '\n') {
			this.line++;
			this.column = 0;
		}
		this.ch = ch;
	}

	/**
	 * Read a token from the current position, and move to the next position.
	*/
	read() {
		while (true) {
			if (this.ch == null) {
				this._token = Token.EOF;
				break;
			}
			if (space.includes(this.ch)) {
				this.nextChar();
				continue;
			}

			if (digit.test(this.ch)) {
				this.readDigits();
				break;
			}

			if (wordChar.test(this.ch)) {
				this.readWord();
				break;
			}

			switch (this.ch) {
				case '{': {
					this._token = Token.BeginBrace;
					this.nextChar();
					break;
				}
				case '}': {
					this._token = Token.EndBrace;
					this.nextChar();
					break;
				}
				case '(': {
					this._token = Token.BeginParen;
					this.nextChar();
					break;
				}
				case ')': {
					this._token = Token.EndParen;
					this.nextChar();
					break;
				}
				case ';': {
					this._token = Token.Semi;
					this.nextChar();
					break;
				}
				case '=': {
					this.nextChar();
					if (this.ch == '=') {
						this._token = Token.Eq;
						this.nextChar();
					} else {
						this._token = Token.Assign;
					}
					break;
				}
				case '>': {
					this.nextChar();
					// @ts-ignore
					if (this.ch == '=') {
						this._token = Token.GreaterThanEq;
						this.nextChar();
					} else {
						this._token = Token.GreaterThan;
					}
					break;
				}
				case '<': {
					this.nextChar();
					// @ts-ignore
					if (this.ch == '=') {
						this._token = Token.LessThanEq;
						this.nextChar();
					} else {
						this._token = Token.LessThan;
					}
					break;
				}
				case '!': {
					this.nextChar();
					// @ts-ignore
					if (this.ch == '=') {
						this._token = Token.NotEq;
						this.nextChar();
					} else {
						this._token = Token.Not;
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
		this._token = Token.Literal;
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
				this._token = Token.Var;
				break;
			}
			case 'fn': {
				this._token = Token.Fn;
				break;
			}
			case 'struct': {
				this._token = Token.Struct;
				break;
			}
			case 'return': {
				this._token = Token.Return;
				break;
			}
			case 'if': {
				this._token = Token.If;
				break;
			}
			case 'else': {
				this._token = Token.Else;
				break;
			}
			case 'loop': {
				this._token = Token.Loop;
				break;
			}
			default: {
				this._token = Token.Ident;
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
		this._token = Token.Literal;
		this.tokenValue = buf;
		this.literalKind = LiteralKind.String;
	}
}
