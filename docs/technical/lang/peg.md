## PEG
```peg

// Global

Global
	= ImportStatement
	/ FuncDeclaration

ImportStatement
	= "import" ModulePath ";"

ModulePath
	= IDENTIFIER ("::" IDENTIFIER)*

FuncDeclaration
	= FuncAttr* "fn" IDENTIFIER "(" IDENTIFIER ":" IDENTIFIER ("," IDENTIFIER ":" IDENTIFIER)* ")" ":" IDENTIFIER ("{" Statement* "}" / ";")

FuncAttr
	= "export"
	/ "external"

// Statement

Statement
	= VarDeclaration
	/ Assign
	/ ReturnStatement

VarDeclaration
	= ("let" / "const") IDENTIFIER ":" IDENTIFIER "=" Expr ";"

Assign
	= IDENTIFIER "=" Expr ";"

ReturnStatement
	= "return" Expr? ";"

// Expr

Expr
	= Expr2 (("+" / "-") Expr2)+
	/ Expr2

Expr2
	= Expr3 (("*" / "/") Expr3)+
	/ Expr3

Expr3
	= Bool
	/ NUMBER_LITERAL
	/ STRING_LITERAL
	/ Call
	/ IDENTIFIER
	/ "(" Expr ")"

Bool
	= "true"
	/ "false"

Call
	= IDENTIFIER ("." IDENTIFIER)* "(" Expr ("," Expr)* ")"

```
