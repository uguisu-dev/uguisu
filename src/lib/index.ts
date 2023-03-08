import { Scanner } from './scan.js';
import { Parser } from './parse.js';
import { Runner, RunningEnv } from './run.js';
import { AstNode, SourceFile } from './ast.js';
import { AnalysisEnv, analyze } from './analyze.js';
import { setDeclarations } from './builtins.js';
import { codegen } from './wasm/codegen.js';

export {
	SourceFile,
};

export type StdoutCallback = (buf: string) => void;

export class Uguisu {
	private _parser: Parser;
	private _runner: Runner;
	private _stdout: StdoutCallback;
	private _source?: {
		ast: SourceFile,
		symbolTable: Map<AstNode, Symbol>,
	};

	constructor() {
		this._parser = new Parser(new Scanner());
		this._runner = new Runner();
		this._stdout = (x) => { console.log(x); };
	}

	setStdout(callback: StdoutCallback) {
		this._stdout = callback;
	}

	load(sourceCode: string) {
		const ast = this._parser.parse(sourceCode, 'main.ug');

		const analysisEnv = new AnalysisEnv();
		setDeclarations(analysisEnv);
		const symbolTable = new Map();
		analyze({ env: analysisEnv, symbolTable }, ast);

		this._source = {
			ast,
			symbolTable,
		};
	}

	exec() {
		if (this._source == null) {
			throw new Error('source is not loaded');
		}
		const runningEnv = new RunningEnv();
		this._runner.run(this._source.ast, runningEnv, this._stdout);
	}

	/** very experimental */
	genWasmText() {
		if (this._source == null) {
			throw new Error('source is not loaded');
		}
		const code = codegen(this._source.ast);
		console.log(code);
	}

	run(sourceCode: string) {
		this.load(sourceCode);
		this.exec();
	}
}
