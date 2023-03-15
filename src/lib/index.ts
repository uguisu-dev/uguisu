import fs from 'fs';
import path from 'path';
import { UguisuError } from './misc/errors.js';
import { UguisuOptions } from './misc/options.js';
import { generateDefaultProjectInfo, parseProjectFile, ProjectFile, ProjectInfo } from './project-file.js';
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
        let projectInfo: ProjectInfo;
        if (projectFile != null) {
            projectInfo = parseProjectFile(projectFile);
        } else {
            projectInfo = generateDefaultProjectInfo();
        }

        // parse
        const sourceFile = parse(sourceCode, projectInfo.filename, projectInfo);

        // lint
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
    lint(dirPath: string) {
        this._perform(dirPath, {
            lint: true,
            run: false,
        });
    }

    /**
     * @throws TypeError (Invalid arguments)
     * @throws UguisuError
    */
    run(dirPath: string) {
        this._perform(dirPath, {
            lint: false,
            run: true,
        });
    }

    private _perform(dirPath: string, tasks: { lint: boolean, run: boolean }) {
        if (typeof dirPath != 'string') {
            throw new TypeError('Invalid arguments.');
        }

        // project file
        const projectFilePath = path.resolve(dirPath, './uguisu.json');
        let existsProjectFile: boolean;
        try {
            fs.accessSync(projectFilePath, fs.constants.R_OK);
            existsProjectFile = true;
        } catch (err) {
            existsProjectFile = false;
        }
        let projectInfo: ProjectInfo;
        if (existsProjectFile) {
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
        const scriptFilePath = path.resolve(dirPath, projectInfo.filename);
        let sourceCode;
        try {
            sourceCode = fs.readFileSync(scriptFilePath, { encoding: 'utf8' });
        } catch (err) {
            throw new UguisuError('Failed to load the script file.');
        }

        // parse
        const sourceFile = parse(sourceCode, scriptFilePath, projectInfo);

        // lint
        if (tasks.lint) {
            const analysisEnv = new AnalysisEnv();
            const symbolTable = new Map();
            if (!analyze(sourceFile, analysisEnv, symbolTable, projectInfo)) {
                return;
            }
        }

        // run
        if (tasks.run) {
            const runningEnv = new RunningEnv();
            run(sourceFile, runningEnv, this._options, projectInfo);
        }
    }
}
