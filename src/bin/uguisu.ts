#!/usr/bin/env node
import { command as root } from './uguisu/root.js';
import { command as lint } from './uguisu/lint.js';
import { command as run } from './uguisu/run.js';

const args = process.argv.slice(2);

let sub: 'run' | 'lint' | null;
if (args.length > 0) {
    switch (args[0]) {
        case 'run': {
            sub = 'run';
            break;
        }
        case 'lint': {
            sub = 'lint';
            break;
        }
        default: {
            sub = null;
        }
    }
} else {
    sub = null;
}

switch (sub) {
    case 'run': {
        run(args.slice(1));
        break;
    }
    case 'lint': {
        lint(args.slice(1));
        break;
    }
    default: {
        root(args);
        break;
    }
}
