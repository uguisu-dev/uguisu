import { promises as fs } from 'fs';
import { Scanner, Parser } from '.';

async function entry() {
	const str = await fs.readFile('debug.ug', { encoding: 'utf8' });

	const scanner = new Scanner(str);
	const parser = new Parser(scanner);
	try {
		parser.setup();
		const ast = parser.parse();
		function replacer(k: string, v: any): any {
			return v;
		}
		console.log(JSON.stringify(ast, replacer, '  '));
	}
	catch (e) {
		console.log(e);
	}
}

entry()
.catch(e => {
	console.error(e);
});
