#!/usr/bin/env node
import { command as root } from './uguisu/root.js';
import { command as run } from './uguisu/run.js';

const args = process.argv.slice(2);

let sub: 'run' | null;
if (args.length > 0) {
	switch (args[0]) {
		case 'run': {
			sub = 'run';
			break;
		}
		default: {
			sub = null;
		}
	}
} else {
	sub = null;
}

if (sub == null) {
	root(args);
} else {
	run(args.slice(1));
}
