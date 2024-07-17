import path from 'path';
import kleur from 'kleur';
import { homedir } from 'os';
import { exec, withDir } from '../util/shell';

export default async function sha() {
  let gitSha; 
  await withDir(path.resolve(homedir(), '.bedrock'), async () => {
    gitSha = await exec(`git rev-parse --short HEAD`);
    console.log(kleur.green(`Current git commit SHA: `)+kleur.yellow(gitSha));
  });
  return gitSha;
}
