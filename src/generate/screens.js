import { loadModels } from './utils/model.js';
import { assertBedrockWeb } from '../utils/dir.js';
import { queueTask, runTasks } from '../utils/tasks.js';
import { readLocalFile } from './utils/files.js';
import { generateLocalFiles } from './utils/ai.js';
import { readDirectory } from '../utils/file.js';

export async function screens(options) {
  await assertBedrockWeb();

  const { dir } = options;
  const filenames = await readDirectory(dir, '**/*.js');

  const files = await Promise.all(
    filenames.map(async (filename, i) => {
      return {
        filename,
        content: await readLocalFile(filename),
        number: i + 1,
      };
    }),
  );

  const models = await loadModels(options);

  queueTask('Generating Screens', async () => {
    for (let model of models) {
      const modelName = model.name;
      const modelDefinition = model.definition;

      await generateLocalFiles({
        file: options.template || 'screens',
        eject: options.eject,
        platform: options.platform,
        params: {
          files,
          modelName,
          modelDefinition,
        },
      });
    }
  });

  await runTasks();
}
