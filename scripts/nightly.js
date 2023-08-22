import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import fsExtra from 'fs-extra';

function main() {
  // backup
  console.log('backup package.json');
  fs.copyFileSync(path.resolve('./package.json'), path.resolve('./package.json.bak'));

  try {
    // get commit hash of HEAD
    const hash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

    // change package version
    let pkgJson = fs.readFileSync(path.resolve('./package.json'), { encoding: 'utf8' });
    const pkgObj = JSON.parse(pkgJson);
    pkgObj.version = `0.0.0-nightly.${hash}`;
    pkgJson = JSON.stringify(pkgObj, null, '  ');
    fs.writeFileSync(path.resolve('./package.json'), pkgJson, { encoding: 'utf8' });

    // build
    console.log('build ...');
    fsExtra.removeSync(path.resolve('./bin'));
    fsExtra.removeSync(path.resolve('./lib'));
    execSync('npm run build');

    // publish
    console.log('publish ...');
    execSync('npm publish --tag nightly');
  } catch (err) {
    console.log(err);
  }

  // restore
  console.log('restore package.json');
  fs.unlinkSync(path.resolve('./package.json'));
  fs.renameSync(path.resolve('./package.json.bak'), path.resolve('./package.json'));
}
main();
