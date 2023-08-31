import fs from 'fs';
import path from 'path';
import { UguisuError } from './misc/errors.js';
import { UguisuOptions } from './misc/options.js';
import { getDefaultProjectInfo, parseProjectFile, ProjectInfo } from './project-file.js';
import { RunningEnv } from './running/common.js';
import { run } from './running/run.js';
import { analyze } from './semantics/analyze.js';
import { AnalysisEnv } from './semantics/common.js';
import { parse } from './syntax/parse.js';

export {
  UguisuError
};

export class UguisuResult {
  constructor(
    public success: boolean,
    public warnings: string[],
    public errors: string[],
  ) { }
}

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
  check(dirPath: string): UguisuResult {
    return this._perform(dirPath, {
      check: true,
      run: false,
    });
  }

  /**
   * @throws TypeError (Invalid arguments)
   * @throws UguisuError
  */
  run(dirPath: string, opts?: { skipCheck?: boolean }): UguisuResult {
    opts = opts ?? {};
    const skipCheck = opts.skipCheck ?? false;
    return this._perform(dirPath, {
      check: !skipCheck,
      run: true,
    });
  }

  private _perform(dirPath: string, tasks: { check: boolean, run: boolean }): UguisuResult {
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
      projectInfo = getDefaultProjectInfo();
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

    let checkResult = new UguisuResult(true, [], []);

    // static analysis
    if (tasks.check) {
      const analysisEnv = new AnalysisEnv();
      const symbolTable = new Map();
      const result = analyze(sourceFile, analysisEnv, symbolTable, projectInfo);
      checkResult.success = result.success;
      checkResult.errors = result.errors;
      checkResult.warnings = result.warnings;
      if (!result.success) {
        return checkResult;
      }
    }

    // run
    if (tasks.run) {
      const runningEnv = new RunningEnv();
      run(sourceFile, runningEnv, this._options, projectInfo);
    }

    return checkResult;
  }
}
