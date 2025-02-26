import { exit } from '../utils/flow.js';
import { checkConfig } from './authorize.js';
import { assertBedrockRoot } from '../utils/dir.js';
import { execSyncInherit } from '../utils/shell.js';
import { getCliPodName } from './utils.js';

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
