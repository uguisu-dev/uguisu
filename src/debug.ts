import { promises as fs } from 'fs';
import { scan, parse } from './index';
import { AstNodeKind } from './ast';

async function entry() {
	const str = await fs.readFile('debug.ug', { encoding: 'utf8' });

	const tokens = scan(0, str);
	try {
		const ast = parse(0, tokens);
		function replacer(k: string, v: any): any {
			if (k == 'kind') {
				return AstNodeKind[v];
			} else {
				return v;
			}
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
