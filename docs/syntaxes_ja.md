# 言語バージョン
Uguisu2023-1

# 型 (type)
名前   | 説明
-------|------------------------
number | 数値を表します。
bool   | 真または偽の値を表します。
string | 文字列を表します。

# リテラル値
式ではリテラル値を使用できます。

名称     | 型     | 例
--------|---------|------
数値     | number | `123`
ブール値 | bool   | `true`, `false`
文字列   | string | `"abc"`

# 単項演算式
```
!expression
```
`!`の部分では、以下に示す論理演算子が使用できます。

## 論理演算子(単項)
論理演算を行ってbool値を返します。  
bool型の式を与える必要があります。

論理演算子の一覧:
- `!`

# 二項演算式
```
expression + expression
```
`+`の部分では、以下に示す算術演算子や比較演算子、論理演算子が使用できます。

## 算術演算子
算術演算を行って数値を返します。  
演算子の左右にはnumber型の式を与える必要があります。

算術演算子の一覧:
- `+`
- `-`
- `*`
- `/`
- `%`

## 比較演算子
比較演算を行ってbool値を返します。
演算子の左右には同じ型の式を与える必要があります。

比較演算子の一覧:
- `==`
- `!=`
- `<`
- `<=`
- `>`
- `>=`

※`<` `<=` `>` `>=`の場合、左右の式はnumber型である必要があります。

## 論理演算子(二項)
論理演算を行ってbool値を返します。  
演算子の左右にはbool型の式を与える必要があります。

論理演算子の一覧:
- `&&`
- `||`

# 式のグループ化
式では`()`を使ってグループ化ができます。グループ化するとその部分の評価が優先的に行われます。

# 変数

## 変数の宣言と初期化
```
var variableName: type;
```
型は省略することもできます。その場合はその変数に代入された式から変数の型が推論されます。  

```
var variableName: type = expression;
```
宣言時に初期値を与えることもできます。

## 変数の参照
```
variableName
```

## 変数への代入
```
variableName = expression;
```

代入演算子の種類:
- `=`
- `+=`
- `-=`
- `*=`
- `/=`
- `%=`

※`+=` `-=` `*=` `/=` `%=`の場合、変数と式はnumber型である必要があります。

# 関数
以下のようにして関数を宣言します。関数はトップレベルで宣言できます。
```
fn functionName(parameterName: type, parameterName: type): type {
    statement
    statement
}
```
パラメーターの型と戻り値の型を指定します。  
また、戻り値の型を指定しないことで戻り値が無い関数としても宣言できます。

## 関数の呼び出し
```
functionName(argumentName, argumentName)
```
値を返さない関数の呼び出しは式としては使用できません。

## return文
```
return;
```
or
```
return expression;
```

# if文
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

# loop文
```
loop {
    statement
    statement
}
```

## breakによる中断
```
break;
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

# 構造体
以下のようにして構造体を宣言します。構造体はトップレベルで宣言できます。
```
struct Human {
    name: string,
    age: number,
}
```
※宣言した構造体は型として使用できます。

## 構造体のインスタンス化
```
var x: Human = new Human { name: "alice", age: 22 };
```

## フィールドの参照
```
var name: string = x.name;
```

## フィールドへの代入
```
x.age = 20;
```

# スコープ規則
レキシカルスコープ(静的スコープ)を採用します。

# ビルトイン関数

## number.parse
```
fn number.parse(source: string): number;
```

## number.toString
```
fn number.toString(source: number): string;
```
数値を文字列に変換します。

## number.assertEq
```
fn number.assertEq(actual: number, expected: number);
```
与えられた数値と期待する数値を比較して、値が異なる場合にランタイムエラーを発生させます。

## string.concat
```
fn string.concat(x: string, y: string): string;
```
2つの文字列を連結して新しい文字列を生成します。

## string.fromArray
```
fn string.fromArray(x: array): string;
```
Unicode形式の文字配列を文字列に変換します。

## string.toArray
```
fn string.toArray(x: string): array;
```
文字列をUnicode形式の文字配列に変換します。

## string.assertEq
```
fn string.assertEq(actual: string, expected: string);
```
与えられた文字列と期待する文字列を比較して、値が異なる場合にランタイムエラーを発生させます。

## array.insert
```
fn array.insert(x: array, index: number, value: any);
```
配列に項目を挿入します。

## array.add
```
fn array.add(x: array, value: any);
```
配列の末尾に項目を追加します。

## array.removeAt
```
fn array.removeAt(x: array, index: number);
```
指定したインデックスの項目を配列から削除します。

## array.count
```
fn array.count(x: array): number;
```
配列の項目数を取得します。

## console.write
```
fn console.write(value: string);
```
文字列を標準出力に出力します。

## console.writeNum
```
fn console.writeNum(value: number);
```
数値を標準出力に出力します。

## console.read
```
fn console.read(): string;
```
標準入力から文字列を読み取り、その文字列を返します。

## getUnixtime
```
fn getUnixtime(): number;
```
現在の時刻をUnixtimeの形式で取得します(単位は秒)。
