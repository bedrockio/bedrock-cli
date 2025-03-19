import { loadModels } from './utils/model.js';
import { assertPath } from '../utils/file.js';
import { assertBedrockApi } from '../utils/dir.js';
import { kebabPlural } from './utils/inflections.js';
import { queueTask, runTasks } from '../utils/tasks.js';
import { getExample, readLocalFile } from './utils/files.js';
import { createAiClient, generateLocalFiles } from './utils/ai.js';

const TESTS_DIR = 'src/routes/__tests__';
const ROUTES_DIR = 'src/routes';

export async function tests(options) {
  await assertBedrockApi();
  await createAiClient(options);

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
      const modelDefinition = model.definition;

      await generateLocalFiles({
        file: options.template || 'tests',
        eject: options.eject,
        platform: options.platform,
        params: {
          expectedFilename,
          modelDefinition,
          routesContent,
          testsExample,
        },
      });
    }
  });

  await runTasks();
}
