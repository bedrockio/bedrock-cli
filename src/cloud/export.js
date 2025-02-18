import { exit } from '../utils/flow.js';
import { checkConfig } from './authorize.js';
import { assertBedrockRoot } from '../utils/dir.js';
import { exec, execSyncInherit } from '../utils/shell.js';

export default async function exportDocuments(options) {
  await assertBedrockRoot();
  await checkConfig(options);

  const { models = '', ids = '' } = options;

  if (!models) {
    exit('Model name is required.');
  }

  const cliPodName = await getCliPodName();
  let script = `/service/scripts/fixtures/export --stdout --models=${models}`;
  if (ids) {
    script += ` --ids=${ids}`;
  }
  try {
    execSyncInherit(`kubectl exec ${cliPodName} -- ${script}`);
  } catch (error) {
    exit(error.original);
  }
}

async function getCliPodName() {
  const podsJSON = await exec(`kubectl get pods -o json --ignore-not-found`);
  if (!podsJSON) {
    exit(`No running pods`);
  }
  const pods = JSON.parse(podsJSON).items;

  const pod = pods.find((pod) => pod.metadata.name.startsWith('api-cli-deployment'));

  if (!pod) {
    exit(`CLI pod is not running.`);
  }
  return pod.metadata.name;
}
