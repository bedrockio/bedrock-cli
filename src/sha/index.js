import { homedir } from 'os';

import path from 'path';
import kleur from 'kleur';
import { exec, withDir } from '../util/shell.js';

export default async function sha() {
  await withDir(path.resolve(homedir(), '.bedrock'), async () => {
    const gitSha = await exec(`git rev-parse --short HEAD`);
    console.log(kleur.green(`Current git commit SHA: `) + kleur.yellow(gitSha));
  });
}
