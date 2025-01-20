import { loadModels } from './utils/model.js';
import { assertPath } from '../util/file.js';
import { assertBedrockWeb } from '../util/dir.js';
import { queueTask, runTasks } from '../util/tasks.js';
import { getExample } from './utils/files.js';
import { generateLocalFiles } from './utils/ai.js';

const MODALS_DIR = 'src/modals';

export async function modal(options) {
  await assertBedrockWeb();

  const modalsDir = await assertPath(MODALS_DIR);

  const modalExample = await getExample({
    ...options,
    reference: 'src/modals/EditShop.js',
  });

  const models = await loadModels(options);

  queueTask('Generating Modals', async () => {
    for (let model of models) {
      const modelDefinition = model.definition;
      const expectedFilename = `${modalsDir}/Edit${model.name}.js`;

      await generateLocalFiles({
        file: options.template || 'modals',
        eject: options.eject,
        platform: options.platform,

        params: {
          expectedFilename,
          modelDefinition,
          modalExample,
        },
      });
    }
  });

  await runTasks();
}
