import { promises as fs } from 'fs';
import { Scanner, Parser, Runner } from '.';

async function entry() {
	const filename = 'debug.ug';
	const str = await fs.readFile(filename, { encoding: 'utf8' });

	const scanner = new Scanner(str);
	const parser = new Parser(scanner);
	try {
		parser.setup();
		const ast = parser.parse(filename);
		function replacer(k: string, v: any): any {
			return v;
		}
		//console.log(JSON.stringify(ast, replacer, '  '));
		const runner = new Runner(ast);
		const value = runner.run();
		console.log(value);
	}
	catch (e) {
		console.log(e);
	}
}

entry()
.catch(e => {
	console.error(e);
});
