
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

[CollectDecls]

in
- SyntaxTree

out
- DeclTable (DeclarationNode -> Symbol)

----

[ResolveNames]

in
- SyntaxTree
- DeclTable

out
- NameTable (ReferenceNode -> Symbol)

----

[TypeCheck]

in
- SyntaxTree
- DeclTable
- NameTable

```
