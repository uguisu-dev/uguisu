export enum Token {
	EOF,
	Ident,
	Literal,

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
