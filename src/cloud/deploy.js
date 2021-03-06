import kleur from 'kleur';
import { prompt } from '../util/prompt';

export async function warn(environment) {
  if (environment == 'production') {
    console.info(kleur.yellow('---------------------------------------------------------\n'));
    console.info(kleur.yellow('                 Deploying to production!                \n'));
    console.info(kleur.yellow('---------------------------------------------------------\n'));
    const confirmed = await prompt({
      type: 'confirm',
      name: 'deploy',
      message: 'Are you sure?',
    });
    if (!confirmed) process.exit(0);
  }
}
