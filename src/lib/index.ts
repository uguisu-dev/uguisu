import fs from 'fs';
import path from 'path';
import { UguisuError } from './misc/errors.js';
import { UguisuOptions } from './misc/options.js';
import { generateDefaultProjectFile, parseProjectFile, ProjectFile } from './project-file.js';
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
    runCode(sourceCode: string, projectFile?: ProjectFile) {
        if (typeof sourceCode != 'string') {
            throw new TypeError('Invalid arguments');
        }
        // project file
        let projectFileNorm;
        if (projectFile != null) {
            projectFileNorm = parseProjectFile(projectFile ?? {});
        } else {
            projectFileNorm = generateDefaultProjectFile();
        }

        // parse
        const sourceFile = parse(sourceCode, 'main.ug', projectFileNorm);
        // static analysis
        const analysisEnv = new AnalysisEnv();
        const symbolTable = new Map();
        if (!analyze(sourceFile, analysisEnv, symbolTable, projectFileNorm)) {
            return;
        }
        // run
        const runningEnv = new RunningEnv();
        run(sourceFile, runningEnv, this._options, projectFileNorm);
    }

    /**
     * @throws TypeError (Invalid arguments)
     * @throws UguisuError
    */
    runFile(filename: string) {
        if (typeof filename != 'string') {
            throw new TypeError('Invalid arguments.');
        }
        // project file
        let projectFile: Record<string, any>;
        const projectFilePath = path.resolve(path.dirname(filename), './uguisu.json');
        let projectFileExists;
        try {
            fs.accessSync(projectFilePath, fs.constants.R_OK);
            projectFileExists = true;
        } catch (err) {
            projectFileExists = false;
        }
        let projectFileNorm;
        if (projectFileExists) {
            try {
                const json = fs.readFileSync(projectFilePath, { encoding: 'utf8' });
                projectFile = JSON.parse(json);
            } catch (err) {
                throw new UguisuError('Failed to load the project file.');
            }
            projectFileNorm = parseProjectFile(projectFile);
        } else {
            projectFileNorm = generateDefaultProjectFile();
        }

        // load
        let sourceCode;
        try {
            sourceCode = fs.readFileSync(filename, { encoding: 'utf8' });
        } catch (err) {
            throw new UguisuError('Failed to load the script file.');
        }
        // parse
        const sourceFile = parse(sourceCode, filename, projectFileNorm);
        // static analysis
        const analysisEnv = new AnalysisEnv();
        const symbolTable = new Map();
        if (!analyze(sourceFile, analysisEnv, symbolTable, projectFileNorm)) {
            return;
        }
        // run
        const runningEnv = new RunningEnv();
        run(sourceFile, runningEnv, this._options, projectFileNorm);
    }
}
