type Match = {
	help: boolean,
	version: boolean,
	free: string[],
};

function getopts(args: string[]): Match {
	const match: Match = {
		help: false,
		version: false,
		free: [],
	};

	for (const arg of args) {
		if (arg === '-h' || arg === '--help') {
			match.help = true;
		}
		else if (arg === '-v' || arg === '--version') {
			match.version = true;
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
		'Usage: uguisu-js [options] [commands]',
		'',
		'Examples:',
		'    uguisu-js run <filename>',
		'    uguisu-js <command> -h',
		'    uguisu-js -v',
		'',
		'Options:',
		'    -h, --help          Print help message.',
		'    -v, --version       Print Uguisu version.',
		'',
		'Commands:',
		'    run                 Run a script file.',
	];
	console.log(lines.join('\n'));
}

function showVersion() {
	const info = require('../../package.json');
	console.log(`uguisu-js ${info.version}`);
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

	if (match.version) {
		showVersion();
		return;
	}

	showHelp();
}
