import fs from 'fs';
import { Parser } from './parse.js';
import { Runner } from './run.js';
import { SourceFile } from './ast.js';
import { Analyzer } from './analyze.js';

export {
	SourceFile,
};

export class UguisuError extends Error {
	constructor(message: string) {
		super(message);
	}
}

export type UguisuOptions = {
	stdin?: () => Promise<string>,
	stdout?: (buf: string) => void,
};

export class Uguisu {
	private _options: UguisuOptions;

	constructor(options?: UguisuOptions) {
		this._options = options ?? {};
	}

	runFile(filename: string) {
		// load file
		let sourceCode;
		try {
			sourceCode = fs.readFileSync(filename, { encoding: 'utf8' });
		} catch (err) {
			throw new UguisuError('Failed to load the file.');
		}

		// parse
		const parser = new Parser();
		const sourceFile = parser.parse(sourceCode, filename);

		// static analysis
		const analyzer = new Analyzer();
		analyzer.analyze(sourceFile);

		// run
		const runner = new Runner(this._options);
		runner.run(sourceFile);
	}
}
