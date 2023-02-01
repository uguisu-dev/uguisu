# 文法
対象バージョン: Uguisu 0.5

## 式 (expression)
- 数値リテラル
- bool値リテラル
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
const variable_name: type = expression;
```
or
```
let variable_name: type = expression;
```
型は省略することもできます。その場合は与えられた式から変数の型が推論されます。

### 変数の代入
```
variable_name = expression;
```

代入演算子の種類:
`=` `+=` `-=` `*=` `/=` `%=`

※`+=` `-=` `*=` `/=` `%=`の場合、変数と式はnumber型である必要があります。

### 変数の参照
```
variable_name
```

## 関数

### 関数の宣言
```
fn function_name(parameter_name: type, parameter_name: type): type {
    statement
    statement
}
```
パラメーターの型と戻り値の型を指定します。  
また、戻り値の型を指定しないことで戻り値が無い関数としても宣言できます。

### 関数の呼び出し
```
function_name(argument_name, argument_name)
```

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

## ビルトイン関数

### print_num
関数シグネチャ:
```
fn print_num(value: number);
```
数値を標準出力に出力します。  
改行されません。

### print_lf
関数シグネチャ:
```
fn print_lf();
```
改行コード(LF)を標準出力に出力します。

### assert_eq
関数シグネチャ:
```
fn assert_eq(actual: number, expected: number);
```
与えられた数値と期待する数値を比較して、値が異なる場合にランタイムエラーを発生させます。
