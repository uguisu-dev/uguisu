import { Scanner } from './scan.js';
import { Parser } from './parse.js';
import { Runner, RunningEnv } from './run.js';
import { SourceFile } from './ast.js';
import { AnalysisEnv, analyze } from './analyze.js';
import { setDeclarations } from './builtins.js';

export {
	SourceFile,
};

export type StdoutCallback = (buf: string) => void;

export class Uguisu {
	private _parser: Parser;
	private _runner: Runner;
	private _stdout: StdoutCallback;

	constructor() {
		this._parser = new Parser(new Scanner());
		this._runner = new Runner();
		this._stdout = (x) => { console.log(x); };
	}

	setStdout(callback: StdoutCallback) {
		this._stdout = callback;
	}

	exec(sourceCode: string) {
		this._parser.setup(sourceCode, 'main.ug');
		const ast = this._parser.parse();

		const analysisEnv = new AnalysisEnv();
		setDeclarations(analysisEnv);
		analyze(ast, analysisEnv);

		const runningEnv = new RunningEnv();
		this._runner.run(ast, runningEnv, this._stdout);
	}
}
