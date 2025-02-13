import kleur from 'kleur';
import logger from '@bedrockio/logger';

import { prompt } from '../utils/prompt.js';

export async function warn(environment) {
  if (environment == 'production') {
    logger.info(kleur.yellow('---------------------------------------------------------\n'));
    logger.info(kleur.yellow('                 Deploying to production!                \n'));
    logger.info(kleur.yellow('---------------------------------------------------------\n'));
    const confirmed = await prompt({
      type: 'confirm',
      name: 'deploy',
      message: 'Are you sure?',
    });
    if (!confirmed) process.exit(0);
  }
}
