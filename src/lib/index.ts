import { Scanner } from './scan.js';
import { Parser } from './parse.js';
import { FunctionValue, Runner, RunningEnv } from './run.js';
import { AstNode, SourceFile } from './ast.js';
import { AnalysisEnv, analyze, Symbol } from './analyze.js';
import { setDeclarations } from './builtins.js';

export {
	SourceFile,
};

export type UguisuOptions = {
	stdin?: () => Promise<string>,
	stdout?: (buf: string) => void,
};

export class Uguisu {
	static createInstance(options?: UguisuOptions) {
		const instance = new UguisuInstance(options);
		instance.start();
		return instance;
	}
}

export class UguisuInstance {
	private _analysisEnv: AnalysisEnv;
	private _runningEnv: RunningEnv;
	private _runner: Runner;
	private _symbolTable: Map<AstNode, Symbol>;
	private _options: UguisuOptions;
	private _started: boolean;

	constructor(options?: UguisuOptions) {
		this._analysisEnv = new AnalysisEnv(),
		this._runningEnv = new RunningEnv(),
		this._runner = new Runner(),
		this._symbolTable = new Map(),
		this._options = options ?? {};
		this._started = false;
	}

	start() {
		if (this._started) {
			throw new Error('The instance is already started.');
		}
		setDeclarations(this._analysisEnv);
		this._runner.start(this._runningEnv, this._options);
		this._started = true;
	}

	/**
	 * load and validate a script file.
	*/
	load(sourceCode: string, filename: string) {
		// parse
		const parser = new Parser(new Scanner());
		const sourceFile = parser.parse(sourceCode, filename);
		// analysis
		analyze({ env: this._analysisEnv, symbolTable: this._symbolTable }, sourceFile);
		// run
		this._runner.evalSourceFile(sourceFile, this._runningEnv);
	}

	/**
	 * add a function dynamically.
	*/
	addFunction(name: string, func: FunctionValue) {
		this._runningEnv.define(name, func);
	}

	/**
	 * call a function.
	*/
	call(name: string) {
		this._runner.call(name, this._runningEnv, this._options);
	}
}
