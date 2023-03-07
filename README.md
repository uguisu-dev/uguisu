<img alt="uguisu logo" width="100px" align="right" src="https://raw.githubusercontent.com/uguisu-dev/uguisu/319732c2fd8784797a30ae8330ea5b79e3d36dc9/uguisu-logo.png" />

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
- English (Not translated yet.)
- [日本語](https://github.com/uguisu-dev/uguisu/blob/v0.6.0/docs/syntaxes_ja.md)

## Install
Node.js and npm installation is required.  
If used from the Command line, global installation is required.
```
$ npm i -g uguisu-js
```

## Command line
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

## JavaScript API
Uguisu only supports the ES Modules (ESM).

```js
import { Uguisu } from 'uguisu-js';

const sourceCode = `
fn main() {
    printStr("hello world");
}
`;

const uguisu = new Uguisu();

uguisu.setStdout((str) => {
    console.log(str);
});

uguisu.run(sourceCode);
```

## License
MIT License
