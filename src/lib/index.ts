import { Scanner } from './syntax/scan';
import { Parser } from './syntax/parse';
import { Runner } from './run';
import { SourceFile } from './syntax/ast';
import { Env as AnalysisEnv, typeCheck } from './semantics/type-check';
import { setDeclarations } from './builtins';

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

	exec(sourceCode: string) {
		this._parser.setup(sourceCode, 'main.ug');
		const ast = this._parser.parse();
		// analysis
		const env = new AnalysisEnv();
		setDeclarations(env);
		typeCheck(ast, env);
		// running
		this._runner.run(ast);
	}
}
