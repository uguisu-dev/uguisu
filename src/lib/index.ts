import { Scanner } from './syntax/scan';
import { Parser } from './syntax/parse';
import { Runner } from './run';
import { SourceFile } from './syntax/ast';

export {
	SourceFile,
};

export class Uguisu {
	private _parser: Parser;
	private _runner: Runner;

	constructor() {
		const scanner = new Scanner();
		this._parser = new Parser(scanner);
		this._runner = new Runner();
	}

	exec(sourceCode: string, filename: string) {
		this._parser.setup(sourceCode, filename);
		const ast = this._parser.parse();
		this._runner.run(ast);
	}
}
