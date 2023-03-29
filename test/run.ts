import assert from 'assert';
import { parse } from '../src/lib/syntax/parse.js';
import { analyze } from '../src/lib/semantics/analyze.js';
import { AnalysisEnv } from '../src/lib/semantics/tools.js';
import { run } from '../src/lib/running/run.js';
import { RunningEnv } from '../src/lib/running/tools.js';
import { ProjectInfo } from '../src/lib/project-file.js';
import { UguisuOptions } from '../src/lib/misc/options.js';

function runTest(sourceCode: string) {
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
        throw new Error('syntax error');
    }

    // run
    const runningEnv = new RunningEnv();
    run(sourceFile, runningEnv, options, projectInfo);
}

// variable + number literal

test('variable arith 1', () => runTest(`
fn main() {
    var x = 1;
    assertEqNum(x, 1);
}
`));

test('variable arith 2', () => runTest(`
fn main() {
    var x = 1 + 2;
    assertEqNum(x, 3);
}
`));

// function declaration

test('function empty', () => runTest(`
fn main() {
}
`));

test('function calc', () => runTest(`
fn add(x: number, y: number): number {
    return x + y;
}
fn main() {
    assertEqNum(add(1, 2), 3);
}
`));

test('subrutine', () => runTest(`
fn subrutine(x: number) {
    var y = x + x;
    var z = y + 1;
    assertEqNum(z, 7);
}
fn main() {
    var x = 1;
    x += 2;
    subrutine(x);
}
`));

// function call

test('call function 1', () => runTest(`
fn add(x: number, y: number): number {
    return x + y;
}
fn square(x: number): number {
    return x * x;
}
fn main() {
    assertEqNum(add(square(2), 3), 7);
}
`));

test('call function 2', () => runTest(`
fn square(x: number): number {
    return x * x;
}
fn calc(x: number, y: number): number {
    return square(x) + y;
}
fn main() {
    assertEqNum(calc(2, 3), 7);
}
`));

test('function recursion', () => runTest(`
fn calc(x: number): number {
    if x == 0 {
        return 1;
    } else {
        return calc(x - 1) * 2;
    }
}
fn main() {
    assertEqNum(calc(8), 256);
}
`));

// function params

test('calc with func param', () => runTest(`
fn calc(x: number, y: number): number {
    var temp = x + y;
    return temp * temp;
}
fn main() {
    var a = 2;
    assertEqNum(calc(a, 3), 25);
}
`));

// return function

test('return function', () => runTest(`
fn gen_result(x: number): number {
    if (x != 3) {
        return 0;
    }
    return 1;
}
fn main() {
    assertEqNum(gen_result(1), 0);
    assertEqNum(gen_result(2), 0);
    assertEqNum(gen_result(3), 1);
    assertEqNum(gen_result(4), 0);
}
`));

// if + if-else + if-elseif-else + bool literal

test('if empty', () => runTest(`
fn main() {
    if true { }
    else if true { }
    else if true { }
    else { }
}
`));

test('if', () => runTest(`
fn main() {
    var x = 0;
    if true {
        x = 1;
    }
    assertEqNum(x, 1);
    if false {
        x = 2;
    }
    assertEqNum(x, 1);
}
`));

test('if else', () => runTest(`
fn main() {
    var x = 1;
    if true {
        x = 2;
    } else {
        x = 3;
    }
    assertEqNum(x, 2);
    if false {
        x = 4;
    } else {
        x = 5;
    }
    assertEqNum(x, 5);
}
`));

test('if elseif else', () => runTest(`
fn main() {
    var x = 1;
    if true {
        x = 2;
    } else if false {
        x = 3;
    } else {
        x = 4;
    }
    assertEqNum(x, 2);
    if false {
        x = 2;
    } else if true {
        x = 3;
    } else {
        x = 4;
    }
    assertEqNum(x, 3);
    if false {
        x = 3;
    } else if false {
        x = 4;
    } else {
        x = 5;
    }
    assertEqNum(x, 5);
}
`));

// logical operation

test('logical op 1', () => runTest(`
fn main() {
    var x = 1;
    if true && false {
        x = 2;
    }
    assertEqNum(x, 1);
    if true && true {
        x = 3;
    }
    assertEqNum(x, 3);
    if false || false {
        x = 4;
    }
    assertEqNum(x, 3);
    if false || true {
        x = 5;
    }
    assertEqNum(x, 5);
    if false && true || true && true {
        x = 6;
    }
    assertEqNum(x, 6);
}
`));

test('logical op 2', () => runTest(`
fn main() {
    var x = 1;
    if false && true || true && true {
        x = 2;
    }
    assertEqNum(x, 2);
}
`));

test('logical op 3', () => runTest(`
fn main() {
    var x = 1;
    if !false {
        x = 2;
    }
    assertEqNum(x, 2);
}
`));

// arithmetic comparison

test('arith comp 1', () => runTest(`
fn main() {
    var x = 1;
    if x == 1 {
        x = 2;
    }
    assertEqNum(x, 2);
    if x == 1 {
        x = 3;
    }
    assertEqNum(x, 2);
}
`));

test('arith comp 2', () => runTest(`
fn main() {
    var x = 1;
    if 1 + 2 == 3 {
        x = 2;
    }
    assertEqNum(x, 2);
    if 2 - 1 == 0 {
        x = 3;
    }
    assertEqNum(x, 2);
}
`));

// loop

test('loop statement', () => runTest(`
fn main() {
    var i = 0;
    var x = 1;
    loop {
        if i == 10 { break; }
        x = x * 2;
        i = i + 1;
    }
    assertEqNum(x, 1024);
}
`));

// break

test('break no target', () => {
    const input = `
    fn main() {
        break;
    }
    `;
    try {
        runTest(input);
    } catch (err) {
        return;
    }
    assert.fail();
});

test('break no target nested', () => {
    const input = `
    fn main() {
        var x = true;
        if x {
            break;
        }
    }
    `;
    try {
        runTest(input);
    } catch (err) {
        return;
    }
    assert.fail();
});

// assignment

test('assignment', () => runTest(`
fn main() {
    var x = 0;
    assertEqNum(x, 0);
    x = 1;
    assertEqNum(x, 1);
    x = 2;
    assertEqNum(x, 2);
}
`));

test('assignment_modes', () => runTest(`
fn main() {
    var x = 0;
    assertEqNum(x, 0);
    x += 10;
    assertEqNum(x, 10);
    x -= 2;
    assertEqNum(x, 8);
    x *= 2;
    assertEqNum(x, 16);
    x /= 4;
    assertEqNum(x, 4);
}
`));

// struct

test('struct', () => runTest(`
struct A {
    value: number,
}
fn main() {
    var x = new A {
        value: 1,
    };
    assertEqNum(x.value, 1);
    x.value = 2;
    assertEqNum(x.value, 2);
}
`));

// array

test('array', () => runTest(`
fn main() {
    var x = [1, 2];
    assertEqNum(x[0], 1);
    assertEqNum(x[1], 2);
    x[0] = 3;
    assertEqNum(x[0], 3);
    x[1] = 4;
    assertEqNum(x[1], 4);
}
`));

// function

describe('function', () => {
    test('assign', () => runTest(`
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

    test('compare', () => runTest(`
    fn main() {
        if main == main { }
    }
    `));

    test('expr statement', () => runTest(`
    fn main() {
        main;
    }
    `));

    test('generate error 1', () => {
        const input = `
        fn main() {
            main = 1;
        }
        `;
        try {
            runTest(input);
        } catch (err) {
            return;
        }
        assert.fail();
    });

    test('generate error 2', () => {
        const input = `
        fn main() {
            var x = 1;
            x = main;
        }
        `;
        try {
            runTest(input);
        } catch (err) {
            return;
        }
        assert.fail();
    });

    test('generate error 3', () => {
        const input = `
        fn main() {
            var x = !main;
        }
        `;
        try {
            runTest(input);
        } catch (err) {
            return;
        }
        assert.fail();
    });

    test('generate error 4', () => {
        const input = `
        fn main() {
            var x = main + main;
        }
        `;
        try {
            runTest(input);
        } catch (err) {
            return;
        }
        assert.fail();
    });

    test('generate error 5', () => {
        const input = `
        fn main() {
            var x = main && main;
        }
        `;
        try {
            runTest(input);
        } catch (err) {
            return;
        }
        assert.fail();
    });

    test('generate error 6', () => {
        const input = `
        fn f() {
        }
        fn main() {
            var x = f(main);
        }
        `;
        try {
            runTest(input);
        } catch (err) {
            return;
        }
        assert.fail();
    });
});

// comments

test('comment', () => runTest(`
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

// string

test('string literal', () => runTest(`
fn make_message(): string {
    var message: string = \"hello\";
    return message;
}
fn main() {
    var x: string = make_message();
}
`));

test('special character', () => runTest(`
fn main() {
    var n: string = \"abc\\n123\";
    var r: string = \"abc\\r123\";
    var t: string = \"abc\\t123\";
}
`));

// other examples

test('example', () => runTest(`
fn calc(x: number): number {
    if x == 0 {
        return 1;
    } else {
        return calc(x - 1) * 2;
    }
}
fn main() {
    var value = 10;
    assertEqNum(calc(value), 1024);
}
`));
