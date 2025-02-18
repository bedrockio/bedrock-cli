import path from 'path';
import { homedir } from 'os';

import { green, yellow } from 'kleur/colors';

import { getRef } from '../utils/git.js';
import { error } from '../utils/flow.js';
import { exec, withDir } from '../utils/shell.js';

export default async function update() {
  await withDir(path.resolve(homedir(), '.bedrock'), async () => {
    const manager = await getPackageManager();
    await exec(`git pull`);
    await exec(`${manager} install`);
    const ref = await getRef();
    console.info(green(`Successfully updated to SHA: `) + yellow(ref));
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
  } catch (err) {
    error(`Could not resolve package manager for ${name}.`);
    error(err);
    return null;
  }
}
