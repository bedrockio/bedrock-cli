import path from 'path';
import kleur from 'kleur';
import { homedir } from 'os';
import { exec, withDir } from '../util/shell';

export default async function update() {
  await withDir(path.resolve(homedir(), '.bedrock'), async () => {
    const manager = await getPackageManager();
    await exec(`git pull`);
    await exec(`${manager} install`);
    const gitSha = await exec(`git rev-parse --short HEAD`);
    console.log(kleur.green(`Updated to SHA: ${gitSha}`));
  });
}

async function getPackageManager() {

  let manager = await tryPackageManager('yarn');
  if (!manager) {
    manager = await tryPackageManager('npm');
  }
  if (!manager) {
    throw new Error('Either yarn or npm must be installed!');
  }
  return manager;
}

async function tryPackageManager(name) {
  try {
    await exec(`which ${name}`);
    return name;
  } catch (error) {
    console.log(kleur.red(`Try package manager failed for ${name}`));
    console.error(error);
    return null;
  }
}
