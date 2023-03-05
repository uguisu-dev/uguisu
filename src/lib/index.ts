import { Scanner } from './syntax/scan';
import { Parser } from './syntax/parse';
import { Runner, RunningEnv } from './run';
import { SourceFile } from './syntax/ast';
import { AnalysisEnv, typeCheck } from './semantics/type-check';
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
		typeCheck(ast, analysisEnv);

		const runningEnv = new RunningEnv();
		this._runner.run(ast, runningEnv, this._stdout);
	}
}
