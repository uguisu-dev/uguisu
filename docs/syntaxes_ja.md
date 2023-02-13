# 文法
対象バージョン: Uguisu 0.6

## 式 (expression)
- 数値リテラル
- bool値リテラル
- 文字列リテラル
- 単項演算式
- 二項演算式
- 変数の参照
- 関数の呼び出し

この他に、式では`()`を使ってグループ化ができます。グループ化するとその部分の評価が優先的に行われます。

## 文 (statement)
- 変数宣言
- 関数宣言
- break文
- return文
- 代入文
- if文
- loop文

## 型 (type)

### number
数値を表します。

### bool
真または偽の値を表します。

### string
文字列を表します。

## 数値リテラル
```
123
```

## bool値リテラル
```
true
```
or
```
false
```

## 文字列リテラル
```
"hello"
```

## 単項演算式
```
!expression
```
`!`の部分では、以下に示す論理演算子が使用できます。

### 論理演算子(単項)
論理演算を行ってbool値を返します。  
bool型の式を与える必要があります。

`!`

## 二項演算式
```
expression + expression
```
`+`の部分では、以下に示す算術演算子や比較演算子、論理演算子が使用できます。

### 算術演算子
算術演算を行って数値を返します。  
演算子の左右にはnumber型の式を与える必要があります。

`+` `-` `*` `/` `%`

### 比較演算子
比較演算を行ってbool値を返します。
演算子の左右には同じ型の式を与える必要があります。

`==` `!=` `<` `<=` `>` `>=`

### 論理演算子
論理演算を行ってbool値を返します。  
演算子の左右にはbool型の式を与える必要があります。

`&&` `||`

## 変数

### 変数の宣言
```
var variableName: type;
```
型は省略することもできます。その場合はその変数に代入された式から変数の型が推論されます。  

```
var variableName: type = expression;
```
宣言時に初期値を与えることもできます。

### 変数の代入
```
variableName = expression;
```

代入演算子の種類:
`=` `+=` `-=` `*=` `/=` `%=`

※`+=` `-=` `*=` `/=` `%=`の場合、変数と式はnumber型である必要があります。

### 変数の参照
```
variableName
```

## 関数

### 関数の宣言
```
fn functionName(parameterName: type, parameterName: type): type {
    statement
    statement
}
```
パラメーターの型と戻り値の型を指定します。  
また、戻り値の型を指定しないことで戻り値が無い関数としても宣言できます。

### 関数の呼び出し
```
functionName(argumentName, argumentName)
```
値を返さない関数の呼び出しは式としては使用できません。

## if文
```
if expression {
    statement
    statement
} else if expression {
    statement
    statement
} else {
    statement
    statement
}
```
条件式ではbool値を返す必要があります。

## loop文
```
loop {
    statement
    statement
}
```

## break文
```
break;
```

## return文
```
return;
```
or
```
return expression;
```

## コメント
```
// single-line comment
```
or
```
/*
multi-line
comment
*/
```

## スコープ規則
静的スコープを採用します。

## ビルトイン関数

### printStr
関数シグネチャ:
```
fn printStr(value: string);
```
文字列を標準出力に出力します。  
改行されません。

### printNum
関数シグネチャ:
```
fn printNum(value: number);
```
数値を標準出力に出力します。  
改行されません。

### printLF
関数シグネチャ:
```
fn printLF();
```
改行コード(LF)を標準出力に出力します。

### assertEq
関数シグネチャ:
```
fn assertEq(actual: number, expected: number);
```
与えられた数値と期待する数値を比較して、値が異なる場合にランタイムエラーを発生させます。

### getUnixtime
関数シグネチャ:
```
fn getUnixtime(): number;
```
現在の時刻をUnixtimeの形式で取得します(単位は秒)。

### concatStr
関数シグネチャ:
```
fn concatStr(x: string, y: string);
```
2つの文字列を連結して新しい文字列を生成します。
