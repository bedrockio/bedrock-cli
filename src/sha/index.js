import path from 'path';
import { homedir } from 'os';

import kleur from 'kleur';
import logger from '@bedrockio/logger';

import { exec, withDir } from '../util/shell.js';

export default async function sha() {
  await withDir(path.resolve(homedir(), '.bedrock'), async () => {
    const gitSha = await exec(`git rev-parse --short HEAD`);
    logger.log(kleur.green(`Current git commit SHA: `) + kleur.yellow(gitSha));
  });
}
