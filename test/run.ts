import assert from 'assert';
import { parse } from '../src/lib/syntax/parse.js';
import { analyze } from '../src/lib/semantics/analyze.js';
import { AnalysisEnv } from '../src/lib/semantics/tools.js';
import { run } from '../src/lib/running/run.js';
import { RunningEnv } from '../src/lib/running/tools.js';
import { ProjectInfo } from '../src/lib/project-file.js';
import { UguisuOptions } from '../src/lib/misc/options.js';

class RunTestError extends Error {
    constructor(message: string, errors: string[], warnings: string[]) {
        for (const error of errors) {
            message += `\n- Error: ${error}`;
        }
        for (const warn of warnings) {
            message += `\n- Warn: ${warn}`;
        }
        super(message);
    }
}

function expectOk(sourceCode: string) {
    const options: UguisuOptions = {};
    const projectInfo: ProjectInfo = {
        filename: 'main.ug',
        langVersion: 'uguisu2023-1',
    };

    // parse
    const sourceFile = parse(sourceCode, projectInfo.filename, projectInfo);

    // static analysis
    const analysisEnv = new AnalysisEnv();
    const symbolTable = new Map();
    const result = analyze(sourceFile, analysisEnv, symbolTable, projectInfo);
    if (!result.success) {
        throw new RunTestError('Syntax error.', result.errors, result.warnings);
    }

    // run
    const runningEnv = new RunningEnv();
    run(sourceFile, runningEnv, options, projectInfo);
}

function expectErr(sourceCode: string) {
    try {
        expectOk(sourceCode);
    } catch (err) {
        if (err instanceof RunTestError) {
            return;
        }
        throw err;
    }
    assert.fail();
}

describe('variable', () => {
    test('variable arith 1', () => expectOk(`
    fn main() {
        var x = 1;
        number.assertEq(x, 1);
    }
    `));

    test('variable arith 2', () => expectOk(`
    fn main() {
        var x = 1 + 2;
        number.assertEq(x, 3);
    }
    `));

    test('delay defined variable', () => expectOk(`
    fn main() {
        var x: number;
        x = 1;
        console.writeNum(x);
    }
    `));

    test('delay defined variable (inference)', () => expectOk(`
    fn main() {
        var x;
        x = 1;
        console.writeNum(x);
    }
    `));

    test('not defined variable', () => expectErr(`
    fn main() {
        var x: number;
        console.writeNum(x);
    }
    `));

    test('not defined variable (inference)', () => expectErr(`
    fn main() {
        var x;
        console.writeNum(x);
    }
    `));
});

// function declaration

test('function empty', () => expectOk(`
fn main() {
}
`));

test('function calc', () => expectOk(`
fn add(x: number, y: number): number {
    return x + y;
}
fn main() {
    number.assertEq(add(1, 2), 3);
}
`));

test('subrutine', () => expectOk(`
fn subrutine(x: number) {
    var y = x + x;
    var z = y + 1;
    number.assertEq(z, 7);
}
fn main() {
    var x = 1;
    x += 2;
    subrutine(x);
}
`));

// function call

test('call function 1', () => expectOk(`
fn add(x: number, y: number): number {
    return x + y;
}
fn square(x: number): number {
    return x * x;
}
fn main() {
    number.assertEq(add(square(2), 3), 7);
}
`));

test('call function 2', () => expectOk(`
fn square(x: number): number {
    return x * x;
}
fn calc(x: number, y: number): number {
    return square(x) + y;
}
fn main() {
    number.assertEq(calc(2, 3), 7);
}
`));

test('function recursion', () => expectOk(`
fn calc(x: number): number {
    if x == 0 {
        return 1;
    } else {
        return calc(x - 1) * 2;
    }
}
fn main() {
    number.assertEq(calc(8), 256);
}
`));

// function params

test('calc with func param', () => expectOk(`
fn calc(x: number, y: number): number {
    var temp = x + y;
    return temp * temp;
}
fn main() {
    var a = 2;
    number.assertEq(calc(a, 3), 25);
}
`));

// return function

test('return function', () => expectOk(`
fn gen_result(x: number): number {
    if (x != 3) {
        return 0;
    }
    return 1;
}
fn main() {
    number.assertEq(gen_result(1), 0);
    number.assertEq(gen_result(2), 0);
    number.assertEq(gen_result(3), 1);
    number.assertEq(gen_result(4), 0);
}
`));

// if + if-else + if-elseif-else + bool literal

test('if empty', () => expectOk(`
fn main() {
    if true { }
    else if true { }
    else if true { }
    else { }
}
`));

test('if', () => expectOk(`
fn main() {
    var x = 0;
    if true {
        x = 1;
    }
    number.assertEq(x, 1);
    if false {
        x = 2;
    }
    number.assertEq(x, 1);
}
`));

test('if else', () => expectOk(`
fn main() {
    var x = 1;
    if true {
        x = 2;
    } else {
        x = 3;
    }
    number.assertEq(x, 2);
    if false {
        x = 4;
    } else {
        x = 5;
    }
    number.assertEq(x, 5);
}
`));

test('if elseif else', () => expectOk(`
fn main() {
    var x = 1;
    if true {
        x = 2;
    } else if false {
        x = 3;
    } else {
        x = 4;
    }
    number.assertEq(x, 2);
    if false {
        x = 2;
    } else if true {
        x = 3;
    } else {
        x = 4;
    }
    number.assertEq(x, 3);
    if false {
        x = 3;
    } else if false {
        x = 4;
    } else {
        x = 5;
    }
    number.assertEq(x, 5);
}
`));

// logical operation

test('logical op 1', () => expectOk(`
fn main() {
    var x = 1;
    if true && false {
        x = 2;
    }
    number.assertEq(x, 1);
    if true && true {
        x = 3;
    }
    number.assertEq(x, 3);
    if false || false {
        x = 4;
    }
    number.assertEq(x, 3);
    if false || true {
        x = 5;
    }
    number.assertEq(x, 5);
    if false && true || true && true {
        x = 6;
    }
    number.assertEq(x, 6);
}
`));

test('logical op 2', () => expectOk(`
fn main() {
    var x = 1;
    if false && true || true && true {
        x = 2;
    }
    number.assertEq(x, 2);
}
`));

test('logical op 3', () => expectOk(`
fn main() {
    var x = 1;
    if !false {
        x = 2;
    }
    number.assertEq(x, 2);
}
`));

// arithmetic comparison

test('arith comp 1', () => expectOk(`
fn main() {
    var x = 1;
    if x == 1 {
        x = 2;
    }
    number.assertEq(x, 2);
    if x == 1 {
        x = 3;
    }
    number.assertEq(x, 2);
}
`));

test('arith comp 2', () => expectOk(`
fn main() {
    var x = 1;
    if 1 + 2 == 3 {
        x = 2;
    }
    number.assertEq(x, 2);
    if 2 - 1 == 0 {
        x = 3;
    }
    number.assertEq(x, 2);
}
`));

// loop

test('loop statement', () => expectOk(`
fn main() {
    var i = 0;
    var x = 1;
    loop {
        if i == 10 { break; }
        x = x * 2;
        i = i + 1;
    }
    number.assertEq(x, 1024);
}
`));

// break

test('break no target', () => expectErr(`
fn main() {
    break;
}
`));

test('break no target nested', () => expectErr(`
fn main() {
    var x = true;
    if x {
        break;
    }
}
`));

// assignment

test('assignment', () => expectOk(`
fn main() {
    var x = 0;
    number.assertEq(x, 0);
    x = 1;
    number.assertEq(x, 1);
    x = 2;
    number.assertEq(x, 2);
}
`));

test('assignment_modes', () => expectOk(`
fn main() {
    var x = 0;
    number.assertEq(x, 0);
    x += 10;
    number.assertEq(x, 10);
    x -= 2;
    number.assertEq(x, 8);
    x *= 2;
    number.assertEq(x, 16);
    x /= 4;
    number.assertEq(x, 4);
}
`));

// struct

test('struct', () => expectOk(`
struct A {
    value: number,
}
fn main() {
    var x = new A {
        value: 1,
    };
    number.assertEq(x.value, 1);
    x.value = 2;
    number.assertEq(x.value, 2);
}
`));

// array

test('array', () => expectOk(`
fn main() {
    var x = [1, 2];
    number.assertEq(x[0], 1);
    number.assertEq(x[1], 2);
    x[0] = 3;
    number.assertEq(x[0], 3);
    x[1] = 4;
    number.assertEq(x[1], 4);

    // operations
    array.insert(x, 2, 5);
    number.assertEq(array.count(x), 3);
    number.assertEq(x[2], 5);
    array.removeAt(x, 2);
    number.assertEq(array.count(x), 2);
}
`));

// function

describe('function', () => {
    test('assign', () => expectOk(`
    fn main() {
        var x = main;
    }
    `));

    // test('return', () => runTest(`
    // fn f(): () => void {
    //     return f;
    // }
    // fn main() {
    //     f();
    // }
    // `));

    test('compare', () => expectOk(`
    fn main() {
        if main == main { }
    }
    `));

    test('expr statement', () => expectOk(`
    fn main() {
        main;
    }
    `));

    test('generate error 1', () => expectErr(`
    fn main() {
        main = 1;
    }
    `));

    test('generate error 2', () => expectErr(`
    fn main() {
        var x = 1;
        x = main;
    }
    `));

    test('generate error 3', () => expectErr(`
    fn main() {
        var x = !main;
    }
    `));

    test('generate error 4', () => expectErr(`
    fn main() {
        var x = main + main;
    }
    `));

    test('generate error 5', () => expectErr(`
    fn main() {
        var x = main && main;
    }
    `));

    test('generate error 6', () => expectErr(`
    fn f() {
    }
    fn main() {
        var x = f(main);
    }
    `));
});

// comments

test('comment', () => expectOk(`
// main function
//
// this function is entry point of program
fn main() {
    /*
     * write
     * your code
     * here
    */
}
`));

// char

test('char literal', () => expectOk(`
fn makeChar(): char {
    var lit: char = 'あ';
    return lit;
}
fn main() {
    var x: char = makeChar();
}
`));

// string

test('string literal', () => expectOk(`
fn make_message(): string {
    var message: string = \"hello\";
    return message;
}
fn main() {
    var x: string = make_message();
}
`));

test('special character', () => expectOk(`
fn main() {
    var n: string = \"abc\\n123\";
    var r: string = \"abc\\r123\";
    var t: string = \"abc\\t123\";
}
`));

// other examples

test('example', () => expectOk(`
fn calc(x: number): number {
    if x == 0 {
        return 1;
    } else {
        return calc(x - 1) * 2;
    }
}
fn main() {
    var value = 10;
    number.assertEq(calc(value), 1024);
}
`));
