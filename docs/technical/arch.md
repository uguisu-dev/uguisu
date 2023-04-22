
```text

[Scan]

in
- SourceCode

out
- Tokens

----

[Parse]

in
- Tokens

out
- SyntaxTree (Tree of SyntaxNode)

----

[Collect]

in
- SyntaxTree

out
- SymbolTable (Declaration SyntaxNode -> Symbol)

----

[Resolve]

in
- SyntaxTree
- SymbolTable

out
- SemanticTree (Tree of SemanticNode)

----

[TypeCheck]

```
