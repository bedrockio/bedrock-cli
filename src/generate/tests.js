import { loadModels } from './utils/model.js';
import { assertPath } from '../util/file.js';
import { assertBedrockApi } from '../util/dir.js';
import { generateLocalFiles } from './utils/ai.js';
import { kebabPlural } from './utils/inflections.js';
import { queueTask, runTasks } from '../util/tasks.js';
import { getExample, readLocalFile } from './utils/files.js';

const TESTS_DIR = 'src/routes/__tests__';
const ROUTES_DIR = 'src/routes';

export async function tests(options) {
  await assertBedrockApi();

  const testsDir = await assertPath(TESTS_DIR);
  const routesDir = await assertPath(ROUTES_DIR);

  const testsExample = await getExample({
    ...options,
    reference: 'src/routes/__tests__/shops.js',
  });

  const models = await loadModels(options);

  queueTask('Generating Route Tests', async () => {
    for (let model of models) {
      const plural = kebabPlural(model.name);
      const expectedFilename = `${testsDir}/${plural}.js`;
      const routesContent = await readLocalFile(`${routesDir}/${plural}.js`);

      await generateLocalFiles({
        file: options.template || 'tests',
        eject: options.eject,
        platform: options.platform,
        params: {
          expectedFilename,
          routesContent,
          testsExample,
        },
      });
    }
  });

  await runTasks();
}
