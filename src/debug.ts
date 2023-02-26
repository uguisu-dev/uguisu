import { promises as fs } from 'fs';
import { Scanner } from './lib/syntax/scan';
import { Parser } from './lib/syntax/parse';
import { Runner } from './lib/run';

async function entry() {
	const filename = 'debug.ug';
	const sourceCode = await fs.readFile(filename, { encoding: 'utf8' });

	const scanner = new Scanner();
	const parser = new Parser(scanner);
	const runner = new Runner();
	try {
		parser.setup(sourceCode, filename);
		const ast = parser.parse();
		console.log(JSON.stringify(ast, null, '  '));
		runner.run(ast);
	}
	catch (e) {
		console.log(e);
	}
}

entry()
.catch(e => {
	console.error(e);
});
