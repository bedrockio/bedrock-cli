import { yellow } from 'kleur/colors';
import logger from '@bedrockio/logger';

import { checkConfig } from './authorize.js';
import { assertBedrockRoot } from '../utils/dir.js';
import { exec, execSyncInherit } from '../utils/shell.js';

export default async function exportDocuments(options) {
  await assertBedrockRoot();
  await checkConfig(options);

  const { models = '', ids = '' } = options;

  if (!models) {
    logger.error(yellow('Model name is required.'));
    process.exit(1);
  }

  const cliPodName = await getCliPodName();
  let script = `/service/scripts/fixtures/export --stdout --models=${models}`;
  if (ids) {
    script += ` --ids=${ids}`;
  }
  try {
    execSyncInherit(`kubectl exec ${cliPodName} -- ${script}`);
  } catch (error) {
    logger.error(error.original);
    process.exit(1);
  }
}

async function getCliPodName() {
  const podsJSON = await exec(`kubectl get pods -o json --ignore-not-found`);
  if (!podsJSON) {
    logger.info(yellow(`No running pods`));
    process.exit(0);
  }
  const pods = JSON.parse(podsJSON).items;

  const pod = pods.find((pod) => pod.metadata.name.startsWith('api-cli-deployment'));

  if (!pod) {
    logger.info(yellow(`CLI pod is not running.`));
    process.exit(1);
  }
  return pod.metadata.name;
}
