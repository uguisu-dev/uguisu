# Uguisu
A Execution engine for the Uguisu language.  
Not ready to use yet.

The syntax is like this:
```
fn calc(x: number): number {
    if x == 0 {
        return 1;
    } else {
        return calc(x - 1) * 2;
    }
}

fn main() {
    const value = 10;
    print_num(calc(value));
}
```

## Supported features
- 変数(`const`, `let`)
  - 定義
  - 代入
  - 参照
- 関数(`fn`)
  - 定義
  - 呼び出し
- `if`文
- `loop`文
- `break`文
- `return`文
- 二項演算子: `+` `-` `*` `/` `==` `!=` `<` `<=` `>` `>=`
- 値
  - `number`型
  - `bool`型
- ビルトイン関数
  - `fn print_num(value: number);`
  - `fn assert_eq(actual: number, expected: number);`

## License
MIT License
