import { yellow } from 'kleur/colors';

import { exit } from '../utils/flow.js';
import { prompt } from '../utils/prompt.js';
import { getBranch } from '../utils/git.js';

export async function confirmDeployment(environment) {
  if (environment == 'production') {
    const branch = await getBranch();
    if (branch === 'staging') {
      exit('Cowardly refusing to deploy production from staging branch.');
    }
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
