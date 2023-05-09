## Scan

in
- SourceCode

out
- Tokens

## Parse

in
- Tokens

out
- SyntaxTree (Tree of SyntaxNode)

## CollectDecls

in
- SyntaxTree

out
- DeclTable (DeclarationNode -> Symbol)

### 仕様
- 宣言ノードとシンボルのマップを保持する。
- 構造体シンボルの中で、各フィールドは名前とシンボルのマップとして保持される。

## ResolveNames

in
- SyntaxTree
- DeclTable

out
- NameTable (ReferenceNode -> Symbol)

## TypeCheck

in
- SyntaxTree
- DeclTable
- NameTable
