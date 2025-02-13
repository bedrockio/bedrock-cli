import logger from '@bedrockio/logger';

import { assertPath } from '../util/file.js';
import { assertBedrockApi } from '../util/dir.js';
import { generateLocalFiles, ejectTemplate } from './utils/ai.js';
import { kebabSingular } from './utils/inflections.js';
import { queueTask, runTasks } from '../util/tasks.js';
import { getExample } from './utils/files.js';
import { prompt } from '../util/prompt.js';

const MODELS_DIR = 'src/models/definitions';

export async function model(options) {
  await assertBedrockApi();

  const modelsDir = await assertPath(MODELS_DIR);

  const name = await prompt({
    type: 'text',
    name: 'name',
    message: 'Name your model:',
  });

  let modelDescription;
  if (!options.template) {
    modelDescription = await prompt({
      type: 'text',
      name: 'description',
      message: 'Describe your model:',
    });
  }

  const exampleDefinition = await getExample({
    ...options,
    reference: 'src/models/definitions/shop.json',
  });

  const expectedFilename = `${modelsDir}/${kebabSingular(name)}.json`;

  let templateFile;

  const params = {
    expectedFilename,
    modelDescription,
    exampleDefinition,
  };

  queueTask('Generating Model', async () => {
    await generateLocalFiles({
      file: options.template || 'model',
      eject: options.eject,
      platform: options.platform,
      params,
    });
  });

  if (!options.template) {
    queueTask('Exporting Template', async () => {
      templateFile = await ejectTemplate({
        file: 'model',
        params,
      });
    });
  }

  await runTasks();

  if (templateFile) {
    logger.info(
      `Template written to "${templateFile}". You can tweak this and pass it back in with --template.`,
    );
  }
}
