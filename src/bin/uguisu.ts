#!/usr/bin/env node
import { command as root } from './uguisu/root.js';
import { command as check } from './uguisu/check.js';
import { command as run } from './uguisu/run.js';

const args = process.argv.slice(2);

let sub: 'run' | 'check' | null;
if (args.length > 0) {
    switch (args[0]) {
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
