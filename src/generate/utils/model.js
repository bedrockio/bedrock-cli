import path from 'path';

import { kebabCase } from 'lodash-es';

import { exit } from '../../utils/flow.js';
import { camelUpper } from './inflections.js';
import { readLocalFile } from './files.js';
import { prompt } from '../../utils/prompt.js';
import { getCurrentRoot } from '../../utils/dir.js';
import { assertPath, loadJson, readDirectory } from '../../utils/file.js';

const MODELS_DIR = 'services/api/src/models/definitions';

export async function loadModels(options) {
  let { model: modelNames } = options;

  if (!modelNames) {
    modelNames = await promptModelNames();
  }

  const definitions = [];

  for (let name of modelNames) {
    const kebab = kebabCase(name);
    let definition = await readLocalFile(`${getModelsDir()}/${kebab}.json`);
    definition ||= await prompt({
      message: 'Path to model definition:',
      initial: 'services/api/src/models/definitions',
    });
    if (!definition) {
      exit(`Definition file not found for "${name}".`);
    }

    definitions.push({
      name,
      definition,
    });
  }

  return definitions;
}

async function promptModelNames() {
  const models = await getAllModels();
  return await prompt({
    type: 'autocompleteMultiselect',
    instructions: false,
    message: 'Select models:',
    choices: models.map(({ name }) => {
      return {
        title: name,
        value: name,
        description: `Generate resources for ${name} model.`,
      };
    }),
    hint: 'Space to select or Enter for none.',
  });
}

async function getAllModels() {
  const modelsDir = await assertPath(getModelsDir());
  const definitions = await readDirectory(modelsDir, '*.json');
  return await Promise.all(
    definitions.map(async (file) => {
      return {
        name: camelUpper(path.basename(file, '.json')),
        definition: await loadJson(file),
      };
    }),
  );
}

function getModelsDir() {
  return path.relative(getCurrentRoot(), MODELS_DIR);
}
