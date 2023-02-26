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
}
