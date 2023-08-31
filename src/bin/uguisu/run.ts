import { Uguisu } from '../../lib/index.js';

type Match = {
  help: boolean,
  skipCheck: boolean,
  free: string[],
};

function getopts(args: string[]): Match {
  const match: Match = {
    help: false,
    skipCheck: false,
    free: [],
  };

  for (const arg of args) {
    if (arg === '-h' || arg === '--help') {
      match.help = true;
    }
    if (arg === '--skip-check') {
      match.skipCheck = true;
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
    'Usage: uguisu run [options] [projectDir]',
    '',
    'Examples:',
    '    uguisu run <projectDir>',
    '    uguisu run --skip-check <projectDir>',
    '',
    'Options:',
    '        --skip-check    Skip the static checking phase.',
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

  // run script
  try {
    const uguisu = new Uguisu({
      stdout(str) {
        console.log(str);
      }
    });
    const result = uguisu.run(dirPath, { skipCheck: match.skipCheck });

    if (!result.success) {
      for (const message of result.errors) {
        console.log(`Syntax Error: ${message}`);
      }
      for (const warn of result.warnings) {
        console.log(`Warning: ${warn}`);
      }
      process.exitCode = -1;
      process.exit();
    }
  }
  catch (e) {
    console.log(e);
    process.exitCode = -1;
    process.exit();
  }
}
