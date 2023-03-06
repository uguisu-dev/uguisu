import { Scanner } from './scan';
import { Parser } from './parse';
import { Runner, RunningEnv } from './run';
import { SourceFile } from './ast';
import { AnalysisEnv, analyze } from './analyze';
import { setDeclarations } from './builtins';

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
