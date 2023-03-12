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

    /**
     * @throws TypeError (Invalid arguments)
    */
    constructor(options?: UguisuOptions) {
        if (options?.stdout != null && typeof options.stdout != 'function') {
            throw new TypeError('Invalid arguments');
        }
        if (options?.stdin != null && typeof options.stdin != 'function') {
            throw new TypeError('Invalid arguments');
        }
        this._options = options ?? {};
    }

    /**
     * @throws TypeError (Invalid arguments)
     * @throws UguisuError
    */
    runCode(sourceCode: string) {
        if (typeof sourceCode != 'string') {
            throw new TypeError('Invalid arguments');
        }
        // parse
        const sourceFile = parse(sourceCode, 'main.ug');
        // static analysis
        const analysisEnv = new AnalysisEnv();
        const symbolTable = new Map();
        analyze(sourceFile, analysisEnv, symbolTable);
        // run
        const runningEnv = new RunningEnv();
        run(sourceFile, runningEnv, this._options);
    }

    /**
     * @throws TypeError (Invalid arguments)
     * @throws UguisuError
    */
    runFile(filename: string) {
        if (typeof filename != 'string') {
            throw new TypeError('Invalid arguments.');
        }
        // load
        let sourceCode;
        try {
            sourceCode = fs.readFileSync(filename, { encoding: 'utf8' });
        } catch (err) {
            throw new UguisuError('Failed to load the file.');
        }
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
}
