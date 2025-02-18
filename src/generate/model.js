import { assertPath } from '../utils/file.js';
import { assertBedrockApi } from '../utils/dir.js';
import { getExample } from './utils/files.js';
import { prompt } from '../utils/prompt.js';
import { kebabSingular } from './utils/inflections.js';
import { queueTask, runTasks } from '../utils/tasks.js';
import { createAiClient, generateLocalFiles, ejectTemplate } from './utils/ai.js';

const MODELS_DIR = 'src/models/definitions';

export async function model(options) {
  await assertBedrockApi();
  await createAiClient(options);

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
    console.info(`Template written to "${templateFile}". You can tweak this and pass it back in with --template.`);
  }
}
