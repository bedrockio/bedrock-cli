import path from 'path';
import kleur from 'kleur';
import { homedir } from 'os';
import { exec, withDir } from '../util/shell';

export default async function update() {
  await withDir(path.resolve(homedir(), '.bedrock'), async () => {
    await exec(`git pull`);
  });
  console.log(kleur.yellow('Updated!'));
}
