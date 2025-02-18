import { yellow } from 'kleur/colors';

import { prompt } from '../utils/prompt.js';

export async function confirmDeployment(environment) {
  if (environment == 'production') {
    console.info(
      yellow(
        `
------------------------------------------------------------

                  Deploying to production!                

------------------------------------------------------------
      `,
      ),
    );
    const confirmed = await prompt({
      type: 'confirm',
      name: 'deploy',
      message: 'Are you sure?',
    });
    if (!confirmed) {
      process.exit(0);
    }
  }
}
