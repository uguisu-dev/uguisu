言語仕様を考える

## 演算子の優先度

(高)

| expr  | associativity
|-------|---------------
| + e   | right
| - e   | right
|-------|---------------
| e * e | left
| e / e | left
|-------|---------------
| e + e | left
| e - e | left

(低)

## 変数宣言
変数の宣言と定義
```
let a = 123;
```

再代入不可な変数の宣言と定義
```
const b = 123;
```

### リテラル値
数値リテラル
```
123
```

文字列リテラル
```
"abc"
```

ブール値
```
true
false
```

## 代入文
```
b = 123;
```

## 関数
### 関数の宣言および定義
関数は以下のように宣言および定義する。
```
fn add(a: number, b: number): number {
  return a + b;
}
```
推論されないため、引数や戻り値の型は省略できない。

関数はローカル空間には定義できない。

### 外部関数の宣言
外部関数としてコンパイラに指示するには、externalを指定する。
外部関数は関数の宣言だけで良いため、後ろには中括弧ではなくセミコロンをつける。

ビルトイン関数は外部関数として宣言される。

```
external fn add(a: number, b: number): number;
```

### プロジェクトのエントリポイント
プログラムが実行されるとmain関数が最初に呼び出される。
```
fn main(): void {
  print("hello");
}
```

## 四則演算
```
fn calc(a: number, b: number, c: number): number {
  return (a + b) * c / 10;
}
```

## モジュール
1つのファイルを1つのモジュールとする。

### モジュールの公開
関数宣言にexportを付けることで、メンバを公開できる。

関数の公開
```
export fn add(a: number, b: number): number {
  return a + b;
}
```

### 他のモジュールへのアクセス
import文を使って、他のモジュールの公開メンバにアクセスできる。

```
import MathUtil;

fn main(): void {
  let num = MathUtil.add(1, 2);
}
```

### ネームスペース
モジュールがあるフォルダの階層がそのモジュールが公開されるパスになる。
これをネームスペースと呼ぶ。

モジュールのファイルパス(srcディレクトリからの相対パス)が`Hoge/Piyo/ExampleModule.**`の場合、
このモジュールのネームスペースは「Hoge::Piyo」となる。

他のモジュールからインポートするには以下のように書く。
```
import Hoge::Piyo::ExampleModule;

fn main(): void {
  ExampleModule.hoge();
}
```
