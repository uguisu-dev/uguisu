import assert from 'assert';
import { Parser } from '../src/lib/parse.js';
import { Runner } from '../src/lib/run.js';
import { Analyzer } from '../src/lib/analyze.js';
import { SourceFile } from '../src/lib/ast.js';

function runTest(sourceCode: string) {
	const parser = new Parser();

	let ast: SourceFile;
	try {
		ast = parser.parse(sourceCode, 'test.ug');
	} catch (err) {
		if (err instanceof Error) {
			throw new Error(`Parsing Error: ${err.message}`);
		}
		throw err;
	}

	const analyzer = new Analyzer();
	try {
		analyzer.analyze(ast);
	} catch (err) {
		if (err instanceof Error) {
			throw new Error(`Syntax Error: ${err.message}`);
		}
		throw err;
	}

	const runner = new Runner({});
	try {
		runner.run(ast);
	} catch (err) {
		if (err instanceof Error) {
			throw new Error(`Runtime Error: ${err.message}`);
		}
		throw err;
	}
}

// variable + number literal

test('variable arith 1', () => runTest(`
fn main() {
	var x = 1;
	assertEq(x, 1);
}
`));

test('variable arith 2', () => runTest(`
fn main() {
	var x = 1 + 2;
	assertEq(x, 3);
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
	assertEq(add(1, 2), 3);
}
`));

test('subrutine', () => runTest(`
fn subrutine(x: number) {
	var y = x + x;
	var z = y + 1;
	assertEq(z, 7);
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
	assertEq(add(square(2), 3), 7);
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
	assertEq(calc(2, 3), 7);
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
	assertEq(calc(8), 256);
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
	assertEq(calc(a, 3), 25);
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
	assertEq(gen_result(1), 0);
	assertEq(gen_result(2), 0);
	assertEq(gen_result(3), 1);
	assertEq(gen_result(4), 0);
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
	assertEq(x, 1);
	if false {
		x = 2;
	}
	assertEq(x, 1);
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
	assertEq(x, 2);
	if false {
		x = 4;
	} else {
		x = 5;
	}
	assertEq(x, 5);
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
	assertEq(x, 2);
	if false {
		x = 2;
	} else if true {
		x = 3;
	} else {
		x = 4;
	}
	assertEq(x, 3);
	if false {
		x = 3;
	} else if false {
		x = 4;
	} else {
		x = 5;
	}
	assertEq(x, 5);
}
`));

// logical operation

test('logical op 1', () => runTest(`
fn main() {
	var x = 1;
	if true && false {
		x = 2;
	}
	assertEq(x, 1);
	if true && true {
		x = 3;
	}
	assertEq(x, 3);
	if false || false {
		x = 4;
	}
	assertEq(x, 3);
	if false || true {
		x = 5;
	}
	assertEq(x, 5);
	if false && true || true && true {
		x = 6;
	}
	assertEq(x, 6);
}
`));

test('logical op 2', () => runTest(`
fn main() {
	var x = 1;
	if false && true || true && true {
		x = 2;
	}
	assertEq(x, 2);
}
`));

test('logical op 3', () => runTest(`
fn main() {
	var x = 1;
	if !false {
		x = 2;
	}
	assertEq(x, 2);
}
`));

// arithmetic comparison

test('arith comp 1', () => runTest(`
fn main() {
	var x = 1;
	if x == 1 {
		x = 2;
	}
	assertEq(x, 2);
	if x == 1 {
		x = 3;
	}
	assertEq(x, 2);
}
`));

test('arith comp 2', () => runTest(`
fn main() {
	var x = 1;
	if 1 + 2 == 3 {
		x = 2;
	}
	assertEq(x, 2);
	if 2 - 1 == 0 {
		x = 3;
	}
	assertEq(x, 2);
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
	assertEq(x, 1024);
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
	assertEq(x, 0);
	x = 1;
	assertEq(x, 1);
	x = 2;
	assertEq(x, 2);
}
`));

test('assignment_modes', () => runTest(`
fn main() {
	var x = 0;
	assertEq(x, 0);
	x += 10;
	assertEq(x, 10);
	x -= 2;
	assertEq(x, 8);
	x *= 2;
	assertEq(x, 16);
	x /= 4;
	assertEq(x, 4);
}
`));

// function identifier

test('should generate error with function name 1', () => {
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

test('should generate error with function name 2', () => {
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

test('should generate error with function name 3', () => {
	const input = `
	fn main() {
		var x = main;
	}
	`;
	try {
		runTest(input);
	} catch (err) {
		return;
	}
	assert.fail();
});

test('should generate error with function name 4', () => {
	const input = `
	fn f(): number {
		return f;
	}
	fn main() {
		f();
	}
	`;
	try {
		runTest(input);
	} catch (err) {
		return;
	}
	assert.fail();
});

test('should generate error with function name 5', () => {
	const input = `
	fn main() {
		if main == main { }
	}
	`;
	try {
		runTest(input);
	} catch (err) {
		return;
	}
	assert.fail();
});

test('should generate error with function name 6', () => {
	const input = `
	fn main() {
		main;
	}
	`;
	try {
		runTest(input);
	} catch (err) {
		return;
	}
	assert.fail();
});

test('should generate error with function name 7', () => {
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

test('should generate error with function name 8', () => {
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

test('should generate error with function name 9', () => {
	const input = `
	fn main() {
		var x = main == main;
	}
	`;
	try {
		runTest(input);
	} catch (err) {
		return;
	}
	assert.fail();
});

test('should generate error with function name 10', () => {
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

test('should generate error with function name 11', () => {
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
	assertEq(calc(value), 1024);
}
`));
