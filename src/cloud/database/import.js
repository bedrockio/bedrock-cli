import { pick, kebabCase, snakeCase } from 'lodash-es';
import { gray, yellow } from 'kleur/colors';

import { getCliPodName } from '../utils.js';
import { assertBedrockRoot } from '../../utils/dir.js';
import { checkKubectlVersion, checkPlatformName } from '../utils.js';
import { checkConfig } from '../authorize.js';
import { execSyncInherit } from '../../utils/shell.js';

const PREPARE_SCRIPT = 'scripts/database/prepare-export.js';
const REMOTE_OPTIONS = ['createdAfter', 'createdBefore', 'limit', 'userId', 'email', 'exclude', 'raw', 'out'];

export default async function importDatabase(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();
  await checkConfig(options);
  await checkPlatformName(options);

  const { platformName, environment } = options;

  const db = snakeCase(`${platformName}_${environment}`);

  const cliPod = await getCliPodName();

  const rOptions = pick(options, REMOTE_OPTIONS);
  const flags = Object.entries(rOptions).map(([name, value]) => {
    name = `--${kebabCase(name)}`;
    return value === true ? name : `${name} ${value}`;
  });

  const rCommand = `"node ${PREPARE_SCRIPT} ${flags.join(' ')}"`;
  const kCommand = `kubectl exec -it ${cliPod} -- /bin/bash -c ${rCommand}`;

  await runCommand('Preparing export...', kCommand);
  await runCommand('Transfering export...', `kubectl cp ${cliPod}:/export ./export`);
  await runCommand(
    'Restoring export...',
    `mongorestore --drop --gzip --nsInclude="${db}.*" --nsFrom="*.*_sanitized" --nsTo="*.*" ./export`,
  );

  await runCommand('Run local cleanup...', 'rm -rf ./export');
}

async function runCommand(title, command) {
  console.info(yellow(title));
  console.info(gray(command));
  await execSyncInherit(command);
}
