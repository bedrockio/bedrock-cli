import { snakeCase } from 'lodash-es';

import { checkConfig } from '../authorize.js';
import { assertBedrockRoot } from '../../utils/dir.js';
import { getCliPodName, getRemoteCommand, checkKubectlVersion, checkPlatformName, runCommand } from '../utils.js';
import { runDatabaseExport } from './utils.js';

export default async function importDatabase(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();
  await checkConfig(options);
  await checkPlatformName(options);

  const { platformName, environment } = options;

  const db = snakeCase(`${platformName}_${environment}`);

  const cliPod = await getCliPodName();

  await runDatabaseExport('Preparing export...', {
    ...options,
    cliPod,
  });

  await runCommand('Transfering export...', `kubectl cp ${cliPod}:/export ./export`);
  await runCommand('Restoring export...', `mongorestore --drop --gzip --nsInclude="${db}.*" ./export`);
  await runCommand('Run remote cleanup...', getRemoteCommand(cliPod, `rm -rf /export`));
  await runCommand('Run local cleanup...', 'rm -rf ./export');
}
