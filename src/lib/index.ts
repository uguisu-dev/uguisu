import fs from 'fs';
import path from 'path';
import { UguisuError } from './misc/errors.js';
import { UguisuOptions } from './misc/options.js';
import { generateDefaultProjectInfo, parseProjectFile, ProjectInfo } from './project-file.js';
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
    runCode(sourceCode: string, projectFile?: ProjectInfo) {
        if (typeof sourceCode != 'string') {
            throw new TypeError('Invalid arguments');
        }
        // project file
        let projectInfo;
        if (projectFile != null) {
            projectInfo = parseProjectFile(projectFile ?? {});
        } else {
            projectInfo = generateDefaultProjectInfo();
        }

        // parse
        const sourceFile = parse(sourceCode, 'main.ug', projectInfo);
        // static analysis
        const analysisEnv = new AnalysisEnv();
        const symbolTable = new Map();
        if (!analyze(sourceFile, analysisEnv, symbolTable, projectInfo)) {
            return;
        }
        // run
        const runningEnv = new RunningEnv();
        run(sourceFile, runningEnv, this._options, projectInfo);
    }

    /**
     * @throws TypeError (Invalid arguments)
     * @throws UguisuError
    */
    runFile(projectPath: string) {
        if (typeof projectPath != 'string') {
            throw new TypeError('Invalid arguments.');
        }
        // project file
        const projectFilePath = path.resolve(projectPath, './uguisu.json');
        let projectFileExists;
        try {
            fs.accessSync(projectFilePath, fs.constants.R_OK);
            projectFileExists = true;
        } catch (err) {
            projectFileExists = false;
        }
        let projectInfo;
        if (projectFileExists) {
            let projectFile: Record<string, any>;
            try {
                const json = fs.readFileSync(projectFilePath, { encoding: 'utf8' });
                projectFile = JSON.parse(json);
            } catch (err) {
                throw new UguisuError('Failed to load the project file.');
            }
            projectInfo = parseProjectFile(projectFile);
        } else {
            projectInfo = generateDefaultProjectInfo();
        }

        // load
        const scriptFilePath = path.resolve(projectPath, './main.ug');
        let sourceCode;
        try {
            sourceCode = fs.readFileSync(scriptFilePath, { encoding: 'utf8' });
        } catch (err) {
            throw new UguisuError('Failed to load the script file.');
        }
        // parse
        const sourceFile = parse(sourceCode, scriptFilePath, projectInfo);
        // static analysis
        const analysisEnv = new AnalysisEnv();
        const symbolTable = new Map();
        if (!analyze(sourceFile, analysisEnv, symbolTable, projectInfo)) {
            return;
        }
        // run
        const runningEnv = new RunningEnv();
        run(sourceFile, runningEnv, this._options, projectInfo);
    }
}
