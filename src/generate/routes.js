import { loadModels } from './utils/model.js';
import { assertPath } from '../utils/file.js';
import { assertBedrockApi } from '../utils/dir.js';
import { queueTask, runTasks } from '../utils/tasks.js';
import { getExample, readLocalFile } from './utils/files.js';
import { generateLocalFiles } from './utils/ai.js';
import { kebabPlural } from './utils/inflections.js';

const ROUTES_DIR = 'src/routes';

export async function routes(options) {
  await assertBedrockApi();

  const routesDir = await assertPath(ROUTES_DIR);

  const routesExample = await getExample({
    ...options,
    reference: 'src/routes/shops.js',
  });

  const routesEntryFilename = `${routesDir}/index.js`;
  const routesEntry = await readLocalFile(routesEntryFilename);

  const models = await loadModels(options);

  queueTask('Generating Routes', async () => {
    for (let model of models) {
      const modelName = model.name;
      const modelDefinition = model.definition;
      const expectedRoutesFilename = `${routesDir}/${kebabPlural(model.name)}.js`;

      await generateLocalFiles({
        file: options.template || 'routes',
        eject: options.eject,
        platform: options.platform,
        params: {
          modelName,
          modelDefinition,
          expectedRoutesFilename,
          routesExample,
          routesEntry,
          routesEntryFilename,
        },
      });
    }
  });

  await runTasks();
}
