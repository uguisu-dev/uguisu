## PEG
```peg

Expr
	= Expr2 (("+" / "-") Expr2)+
	/ Expr2

Expr2
	= Expr3 (("*" / "/") Expr3)+
	/ Expr3

Expr3
	= NUMBER
	/ STRING_LITERAL
	/ Call
	/ IDENTIFIER
	/ "(" Expr ")"

Call
	= IDENTIFIER "(" Expr ("," Expr)* ")"

Statement
	= VarDeclaration
	/ FuncDeclaration

VarDeclaration
	= ("let" / "const") IDENTIFIER ":" IDENTIFIER "=" Expr ";"

FuncAttr
	= "export"
	/ "external"

FuncDeclaration
	= FuncAttr* "fn" IDENTIFIER "(" IDENTIFIER ":" IDENTIFIER ("," IDENTIFIER ":" IDENTIFIER)* ")" ":" IDENTIFIER ("{" Statement* "}" / ";")

```
