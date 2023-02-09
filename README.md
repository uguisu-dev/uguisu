<img alt="uguisu logo" width="100px" align="right" src="https://raw.githubusercontent.com/uguisu-dev/uguisu/master/uguisu-logo.png" />

# Uguisu
The Uguisu is a statically typed scripting language.  
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
    var value = 10;
    printNum(calc(value));
}
```

## Syntaxes
See [syntaxes (日本語)](https://github.com/uguisu-dev/uguisu/tree/master/docs/syntaxes_ja.md)

## Usage
```
Usage: uguisu [options] [commands]

Examples:
    uguisu run <filename>
    uguisu <command> -h
    uguisu -v

Options:
    -h, --help          Print help message.
    -v, --version       Print Uguisu version.

Commands:
    run                 Run a script file.

```

## License
MIT License
