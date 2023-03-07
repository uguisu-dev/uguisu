import fs from 'fs';
import { Uguisu } from '../lib/index.js';

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
		'Usage: uguisu run [options] [filename]',
		'',
		'Examples:',
		'    uguisu run <filename>',
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

	// load file
	const filename = match.free[0];
	let sourceCode;
	try {
		sourceCode = fs.readFileSync(filename, { encoding: 'utf8' });
	} catch (err) {
		console.log('Error: Failed to load the file.');
		return;
	}

	// run script
	const uguisu = new Uguisu();
	try {
		uguisu.load(sourceCode);
		uguisu.exec();
		//uguisu.genWasmText();
	}
	catch (e) {
		console.log(e);
	}
}
