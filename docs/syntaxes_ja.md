# 文法

## 式 (expression)
- 数値リテラル
- bool値リテラル
- 二項演算式
- 変数の参照
- 関数の呼び出し

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

## 二項演算式
```
expression + expression
```

演算子: `+` `-` `*` `/` `==` `!=` `<` `<=` `>` `>=`

## 変数

### 変数の宣言
```
const variable_name: type_name = expression;
```
or
```
let variable_name: type_name = expression;
```
※型は省略することもできます。その場合は与えられた式から変数の型が推論されます。

### 変数の代入
```
variable_name = expression;
```

代入演算子の種類:
`=` `+=` `-=` `*=` `/=`

### 変数の参照
`x`

## 関数

### 関数の宣言
```
fn function_name(parameter_name: type_name, parameter_name: type_name): type_name {
    statement
    statement
}
```
※戻り値の型が指定されない場合は戻り値の無い関数として扱われます。

### 関数の呼び出し
```
function_name(argument_name, argument_name)
```

## 制御文

### if文
```
if condition_expression {
    statement
    statement
} else if condition_expression {
    statement
    statement
} else {
    statement
    statement
}
```

### loop文
```
loop {
    statement
    statement
}
```

### break文
```
break;
```

### return文
```
return;
```
or
```
return expression;
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

## コメント構文
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
