import fs from 'fs';
import { UguisuError } from './misc/errors.js';
import { UguisuOptions } from './misc/options.js';
import { run } from './running/run.js';
import { RunningEnv } from './running/tools.js';
import { analyze } from './semantics/analyze.js';
import { AnalysisEnv } from './semantics/tools.js';
import { parse } from './syntax/parse.js';

export {
	UguisuError
};

export class Uguisu {
	private _options: UguisuOptions;

	constructor(options?: UguisuOptions) {
		this._options = options ?? {};
	}

	/**
	 * @throws UguisuError
	*/
	runCode(sourceCode: string, filename: string) {
		// parse
		const sourceFile = parse(sourceCode, filename);

		// static analysis
		const analysisEnv = new AnalysisEnv();
		const symbolTable = new Map();
		analyze(sourceFile, analysisEnv, symbolTable);

		// run
		const runningEnv = new RunningEnv();
		run(sourceFile, runningEnv, this._options);
	}

	/**
	 * @throws UguisuError
	*/
	runFile(filename: string) {
		// load file
		let sourceCode;
		try {
			sourceCode = fs.readFileSync(filename, { encoding: 'utf8' });
		} catch (err) {
			throw new UguisuError('Failed to load the file.');
		}

		this.runCode(sourceCode, filename);
	}
}
