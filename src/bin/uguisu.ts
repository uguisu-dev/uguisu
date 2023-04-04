#!/usr/bin/env node
import { command as root } from './uguisu/root.js';
import { command as init } from './uguisu/init.js';
import { command as run } from './uguisu/run.js';
import { command as check } from './uguisu/check.js';

const args = process.argv.slice(2);

let sub: 'init' | 'run' | 'check' | null;
if (args.length > 0) {
    switch (args[0]) {
        case 'init': {
            sub = 'init';
            break;
        }
        case 'run': {
            sub = 'run';
            break;
        }
        case 'check': {
            sub = 'check';
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
    case 'init': {
        init(args.slice(1));
        break;
    }
    case 'run': {
        run(args.slice(1));
        break;
    }
    case 'check': {
        check(args.slice(1));
        break;
    }
    default: {
        root(args);
        break;
    }
}
