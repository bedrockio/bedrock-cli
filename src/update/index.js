import { homedir } from 'os';

import path from 'path';

import kleur from 'kleur';
import logger from '@bedrockio/logger';

import { getRef } from '../util/git.js';
import { exec, withDir } from '../util/shell.js';

export default async function update() {
  await withDir(path.resolve(homedir(), '.bedrock'), async () => {
    const manager = await getPackageManager();
    await exec(`git pull`);
    await exec(`${manager} install`);
    const ref = await getRef();
    logger.info(kleur.green(`Successfully updated to SHA: `) + kleur.yellow(ref));
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
    logger.info(kleur.red(`Try package manager failed for ${name}`));
    logger.error(error);
    return null;
  }
}
