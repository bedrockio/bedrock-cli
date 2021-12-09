import { yellow } from 'kleur';
import { assertBedrockRoot } from '../util/dir';
import { checkConfig } from './authorize';
import { readConfig } from './utils';
import { exec } from '../util/shell';

export default async function exportDocuments(options) {
  const { environment, model = '', id = '' } = options;
  if (!environment) {
    console.error(yellow('Environment required'));
    process.exit(1);
  } else if (!model) {
    console.error(yellow('Model name is required.'));
    process.exit(1);
  }

  await assertBedrockRoot();
  const config = readConfig(environment);
  await checkConfig(environment, config, true);

  const cliPodName = await getCliPodName();
  let script = `/services/scripts/fixtures/export --stdout --model=${model}`;
  if (id) {
    script += ` --id=${id}`;
  }
  try {
    await exec(`kubectl exec ${cliPodName} -- ${script}`);
  } catch (error) {
    console.error(error.original);
    process.exit(1);
  }
}

async function getCliPodName() {
  const podsJSON = await exec(`kubectl get pods -o json --ignore-not-found`);
  if (!podsJSON) {
    console.info(yellow(`No running pods`));
    process.exit(0);
  }
  const pods = JSON.parse(podsJSON).items;

  const pod = pods.find((pod) => pod.metadata.name.startsWith('api-cli-deployment'));

  if (!pod) {
    console.info(yellow(`CLI pod is not running.`));
    process.exit(1);
  }
  return pod.metadata.name;
}
