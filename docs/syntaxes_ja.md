# 文法

## 関数

### 関数の宣言
`fn func_1(param_1: type, param_2: type): type { statement; }`  
※戻り値の型が指定されない場合は戻り値の無い関数として扱われます。

### 関数の呼び出し
`func_1(param_1, param_2)`

## 変数

### 変数の宣言
`const x: type = value;` or `let x = value;`  
※型を省略することもできます。その場合は与えられた式から型が推論されます。

### 変数の代入
`x = value;`

代入演算子の種類:
`=` `+=` `-=` `*=` `/=`

### 変数の参照
`x`

## 制御文

### if文
`if condition { statement; } else if condition { statement; } else { statement; }`

### loop文
`loop { statement; }`

### break文
`break;`

### return文
`return;` or `return value;`

## 二項演算式
- 演算子: `+` `-` `*` `/` `==` `!=` `<` `<=` `>` `>=`

## 型
- number型 `123`
- bool型 `true` `false`

## ビルトイン関数
- `fn print_num(value: number);`
- `fn assert_eq(actual: number, expected: number);`

## コメント構文
`// single-line comment` `/* multi-line comment */`
