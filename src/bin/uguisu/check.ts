import { Uguisu } from '../../lib/index.js';

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
        'Usage: uguisu check [options] [projectDir]',
        '',
        'Examples:',
        '    uguisu check <projectDir>',
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

    // lint
    try {
        const uguisu = new Uguisu();
        uguisu.check(dirPath);
    }
    catch (e) {
        console.log(e);
        process.exitCode = -1;
        process.exit();
    }
}
