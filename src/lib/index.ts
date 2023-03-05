import { Scanner } from './syntax/scan';
import { Parser } from './syntax/parse';
import { Runner, RunningEnv } from './run';
import { SourceFile } from './syntax/ast';
import { AnalysisEnv, typeCheck } from './semantics/type-check';
import { setDeclarations } from './builtins';

export {
	SourceFile,
};

export class Uguisu {
	private _parser: Parser;
	private _runner: Runner;

	constructor() {
		this._parser = new Parser(new Scanner());
		this._runner = new Runner();
	}

	exec(sourceCode: string) {
		this._parser.setup(sourceCode, 'main.ug');
		const ast = this._parser.parse();
		// analysis
		const analysisEnv = new AnalysisEnv();
		setDeclarations(analysisEnv);
		typeCheck(ast, analysisEnv);
		// running
		const runningEnv = new RunningEnv();
		this._runner.run(ast, runningEnv);
	}
}
