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
- 宣言ノードとシンボルのマップを生成する。
- 構造体シンボルの中で、各フィールドは名前とシンボルのマップとして保持される。

## ResolveNames

in
- SyntaxTree
- DeclTable

out
- NameTable (ReferenceNode -> Symbol)

### 仕様
- 参照ノード(識別子やフィールドアクセス)と参照先シンボルのマップを生成する。
  - 参照先シンボルのマップを生成するために環境を生成する。

## TypeCheck

in
- SyntaxTree
- DeclTable
- NameTable
