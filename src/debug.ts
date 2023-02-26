import { promises as fs } from 'fs';
import { Scanner, Parser, Runner } from './uguisu';

async function entry() {
	const filename = 'debug.ug';
	const str = await fs.readFile(filename, { encoding: 'utf8' });

	const scanner = new Scanner(str);
	const parser = new Parser(scanner);
	try {
		parser.setup();
		const ast = parser.parse(filename);
		console.log(JSON.stringify(ast, null, '  '));
		const runner = new Runner(ast);
		runner.run();
	}
	catch (e) {
		console.log(e);
	}
}

entry()
.catch(e => {
	console.error(e);
});
