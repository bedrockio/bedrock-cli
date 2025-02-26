import { snakeCase } from 'lodash-es';

import { checkConfig } from '../authorize.js';
import { getCliPodName, getRemoteCommand, checkKubectlVersion, checkPlatformName, runCommand } from '../utils.js';
import { assertBedrockRoot } from '../../utils/dir.js';
import { runDatabaseExport } from '../database/utils.js';
import { prompt } from '../../utils/prompt.js';

const DISALLOWED = ['production', 'staging'];

// TODO: this is a WIP
export default async function createEnvironment(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();

  const newEnv = await prompt({
    type: 'text',
    message: 'Environment name?',
    validate: (arg) => {
      if (DISALLOWED.includes(arg)) {
        return `"${arg}" not allowed.`;
      }
      return true;
    },
  });

  const prod = await useEnvironment('production');

  await checkPlatformName(options);

  const { platformName } = options;

  const prodDb = snakeCase(`${platformName}_production`);
  const newDb = snakeCase(`${platformName}_${newEnv}`);

  await runDatabaseExport('Preparing export...', {
    limit: 1000,
    raw: true,
    cliPod: prod.cliPod,
  });

  await runCommand('Transfering export...', `kubectl cp ${prod.cliPod}:/export ./export`);

  const staging = await useEnvironment('staging');

  await runCommand('Transfering export...', `kubectl cp ./export ${staging.cliPod}:/export ./export`);

  // Note: assuming mongo pod name and port here:
  const command = getRemoteCommand(
    `mongorestore --uri="mongodb://mongo:27017/${newDb}" --gzip --drop ./export/${prodDb}`,
  );
  await runCommand('Creating new DB...', command);

  await runCommand('Run remote cleanup...', getRemoteCommand(staging.cliPod, `rm -rf /export`));
  await runCommand('Run local cleanup...', 'rm -rf ./export');

  // TODO: duplicated and create new deployments
}

async function useEnvironment(environment) {
  const options = { environment };
  await checkConfig(options);
  const cliPod = await getCliPodName();
  return {
    cliPod,
    config: options.config,
  };
}
