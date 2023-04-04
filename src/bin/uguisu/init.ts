import fs from 'fs';
import path from 'path';
import { Uguisu, UguisuError } from '../../lib/index.js';
import { getDefaultProjectInfo } from '../../lib/project-file.js';

type Match = {
    help: boolean,
    free: string[],
};

function getopts(args: string[]): Match {
    const match: Match = {
        help: false,
        free: [],
    };

    for (const arg of args) {
        if (arg === '-h' || arg === '--help') {
            match.help = true;
        }
        else if (arg.startsWith('-')) {
            throw `unknown option: ${arg}`;
        }
        else {
            match.free.push(arg);
        }
    }

    return match;
}

function showHelp() {
    const lines = [
        'Usage: uguisu init [options] [projectDir]',
        '',
        'Examples:',
        '    uguisu init <projectDir>',
        '',
        'Options:',
        '    -h, --help          Print help message.',
    ];
    console.log(lines.join('\n'));
}

export function command(args: string[]) {
    let match;
    try {
        match = getopts(args);
    } catch (err) {
        console.log(err);
        return;
    }

    if (match.help) {
        showHelp();
        return;
    }

    if (match.free.length == 0) {
        showHelp();
        return;
    }

    const dirPath = match.free[0];

    // init project
    try {
        const projectFilePath = path.resolve(dirPath, './uguisu.json');

        // check file
        try {
            fs.accessSync(projectFilePath, fs.constants.R_OK);
            throw new UguisuError('project file is already exists.');
        } catch (err) { }

        // create a default project info
        const info = getDefaultProjectInfo();

        // write file
        try {
            fs.writeFileSync(projectFilePath, JSON.stringify(info, null, '  '), { encoding: 'utf8' });
        } catch (err) {
            throw new UguisuError('Failed to write the project file.');
        }
    }
    catch (e) {
        console.log(e);
        process.exitCode = -1;
        process.exit();
    }
}
