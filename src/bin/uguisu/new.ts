import fs from 'fs';
import path from 'path';
import { UguisuError } from '../../lib/index.js';
import { getDefaultProjectInfo } from '../../lib/project-file.js';

const codeTemplate = `\
fn main() {
    console.write("hello world");
}
`;

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
    'Usage: uguisu new [options] [projectDir]',
    '',
    'Examples:',
    '    uguisu new <projectDir>',
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
    // check dir
    let dirFound = false;
    try {
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        throw new UguisuError('specify a directory path');
      }
      dirFound = true;
    } catch (err) {
      // not found
    }

    if (dirFound) {
      // check if the dir is empty
      const files = fs.readdirSync(dirPath);
      if (files.length != 0) {
        throw new UguisuError('project directory is not empty.');
      }
    } else {
      // create dir
      fs.mkdirSync(dirPath);
    }

    // create a default project info
    const info = getDefaultProjectInfo();

    const projectFilePath = path.resolve(dirPath, './uguisu.json');
    const mainFilePath = path.resolve(dirPath, './main.ug');

    // write files
    try {
      fs.writeFileSync(projectFilePath, JSON.stringify(info, null, '  ') + '\n', { encoding: 'utf8' });
      fs.writeFileSync(mainFilePath, codeTemplate, { encoding: 'utf8' });
    } catch (err) {
      throw new UguisuError('Failed to write project files.');
    }

    console.log('project generated.');
  }
  catch (e) {
    console.log(e);
    process.exitCode = -1;
    process.exit();
  }
}
