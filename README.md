<img alt="uguisu logo" width="100px" align="right" src="https://raw.githubusercontent.com/uguisu-dev/uguisu/v0.7.0/uguisu-logo.png" />

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
    var x = 10;
    var y = calc(x);
    writeLine(numToStr(y));
}
```

## Syntaxes
- English (Not translated yet.)
- [日本語](https://github.com/uguisu-dev/uguisu/blob/v0.7.0/docs/syntaxes_ja.md)

## Install
Node.js and npm installation is required.  
Local installation is also ok if only the JavaScript API is used.
```
$ npm i -g uguisu-js
```

## Command line
```
Usage: uguisu [options] [commands]

Examples:
    uguisu run <projectDir>
    uguisu check <projectDir>
    uguisu run --skip-check <projectDir>
    uguisu <command> -h
    uguisu -v

Options:
    -h, --help          Print help message.
    -v, --version       Print Uguisu version.

Commands:
    run                 Run a uguisu project.
    check               Perform the check for a project.

```

The following command runs a basic example. A code check is performed before running the code.
```
$ uguisu run ./examples/basic
```

## JavaScript API
Uguisu only supports the ES Modules (ESM).

```js
import { Uguisu } from 'uguisu-js';

const uguisu = new Uguisu({
    stdout(str) {
        console.log(str);
    }
});

const projectDir = './examples/basic';

// Check code and Run
uguisu.run(projectDir);
```

Code checking and running can also be separated:
```js
// Check code
uguisu.check(projectDir);

// Run
uguisu.run(projectDir, { skipCheck: true });
```

## License
MIT License
