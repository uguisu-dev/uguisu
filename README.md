# uguisu-lang
A Execution engine for the Uguisu lang.  
Not ready to use yet.

The syntax is like this:
```
external fn print_num(value: number);

fn calc(x: number): number {
    if x == 0 {
        return 1;
    } else {
        return calc(x - 1) * 2;
    }
}

fn main() {
    print_num(calc(10));
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
- `return`文
- 二項演算子: `+` `-` `*` `/` `==` `!=` `<` `<=` `>` `>=`
- ビルトイン関数
  - `external fn print_num(value: number);`
  - `external fn assert_eq(actual: number, expected: number);`
- 値
  - `number`型
  - `bool`型

## Run the example code
```
cargo run example.ug
```

## Test
```
cargo test
```

## License
MIT License
