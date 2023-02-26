import assert from 'assert';
import { Scanner } from '../src/syntax/scan';
import { Parser } from '../src/syntax/parse';
import { asNumberValue, Runner } from '../src/syntax/run';

function runTest(input: string) {
	const scanner = new Scanner(input);
	const parser = new Parser(scanner);
	parser.setup();
	const ast = parser.parse('test.ug');
	const runner = new Runner(ast);
	const result = runner.run();
	return result;
}

test('empty function', () => {
	const input = `
	fn main() { }
	`;
	const value = runTest(input);
	assert.ok(value.kind == 'NoneValue');
});

test('number', () => {
	const input = `
	fn main() {
		return 1;
	}
	`;
	const value = runTest(input);
	assert.ok(value != null);
	asNumberValue(value);
	assert.strictEqual(value.value, 1);
});
