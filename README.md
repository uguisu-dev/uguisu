<img alt="uguisu logo" width="128px" src="https://raw.githubusercontent.com/uguisu-dev/uguisu/master/uguisu-logo.png" />

# Uguisu
The Uguisu programming language.  
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
- 変数
  - 定義文 `const x = value;` or `let x = value;`
  - 代入文 `x = value;` `x += value;` など
  - 参照 `x`
- 関数
  - 定義文 `fn func_1(param_1, param_2) { statement; }`
  - 呼び出し `func_1(param_1, param_2)`
- if文 `if condition { statement; } else if condition { statement; } else { statement; }`
- loop文 `loop { statement; }`
- break文 `break;`
- return文 `return;` or `return value;`
- 二項演算子: `+` `-` `*` `/` `==` `!=` `<` `<=` `>` `>=`
- 型
  - number型 `123`
  - bool型 `true` `false`
- ビルトイン関数
  - `fn print_num(value: number);`
  - `fn assert_eq(actual: number, expected: number);`

## Usage
```
Usage: uguisu [OPTIONS] INPUT

Options:
    -h, --help          Print this message.
    -v, --version       Print Uguisu version.
```

## License
MIT License
