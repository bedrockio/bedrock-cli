import path from 'path';
import { plural } from 'pluralize';
import { cwd } from '../../util/dir';
import { prompt, promptFill } from '../../util/prompt';
import { saveSnapshot } from '../../util/snapshot';
import { validateCamelUpper } from '../../util/validation';
import { getSchema, definitionToSchema } from './schema';
import { getInflections } from './inflections';
import { getModels } from './models';

export async function setResourceOptions(options, command) {
  let isNew = false;

  if (!options.models) {
    isNew = await prompt({
      type: 'confirm',
      initial: true,
      message: 'Generate new model?',
    });
  }

  if (isNew) {
    await promptComponents(options, command);
    const resource = await getResourceOptions(options);
    options.resources = [resource];

    const { kebab } = getInflections(resource.name);
    await setScreenOptions(resource, options);

    if (options.save) {
      await saveSnapshot(path.resolve(cwd, `${kebab}.json`), options);
    }
  } else {
    options.resources = await getExistingResources(options);
    await promptComponents(options, command);
    for (let resource of options.resources) {
      await setScreenOptions(resource, options);
    }
  }

  if (!isNew && options.components.includes('model')) {
    await Promise.all(
      options.resources.map(async ({ schema, ...rest }) => {
        return {
          schema: await getSchema(schema),
          ...rest,
        };
      })
    );
  }
}

async function promptComponents(options, command) {
  if (!options.components) {
    await promptFill(options, [
      {
        name: 'components',
        type: 'multiple',
        prompt: true,
        description: 'components',
        choices: command.commands.map((command) => {
          const { name, isLegacy } = command;
          const title = isLegacy ? `${name} (legacy)` : name;
          return {
            title,
            value: name,
            description: command.description,
            selected: false,
          };
        }),
      },
    ]);
  }
}

async function getResourceOptions(options) {
  const resource = {};
  resource.name = await prompt({
    type: 'text',
    initial: options.name,
    message: 'Model name (ex. User):',
    validate: validateCamelUpper,
  });
  resource.schema = await getSchema();
  return resource;
}

async function setScreenOptions(resource, options) {
  if (options.components.includes('subscreens')) {
    resource.subscreens = await getSubscreens(resource);
    resource.externalSubscreens = await getExternalSubscreens(resource);
  }
}

async function getExternalSubscreens(resource) {
  const { camelUpper, pluralUpper } = getInflections(resource.name);

  return await promptModelsWithOther(resource, {
    message: `Generate subscreens referencing ${camelUpper}:`,
    getDescription: (modelName) => {
      return `Generates ${modelName} -> ${pluralUpper} screen.`;
    },
  });
}

async function getSubscreens(resource) {
  const { camelUpper } = getInflections(resource.name);

  return await promptModelsWithOther(resource, {
    message: `Generate ${camelUpper} subscreens:`,
    getDescription: (modelName) => {
      return `Generates ${camelUpper} -> ${plural(modelName)} screen.`;
    },
  });
}

async function promptModelsWithOther(resource, options) {
  const { camelUpper } = getInflections(resource.name);
  const { message, getDescription } = options;

  const models = await getModels();
  const modelNames = models
    .map((model) => model.name)
    .filter((name) => {
      return name !== camelUpper;
    });

  let selectedNames = await prompt({
    type: 'multiselect',
    instructions: false,
    message,
    choices: modelNames
      .map((modelName) => {
        return {
          title: modelName,
          value: modelName,
          description: getDescription(modelName),
        };
      })
      .concat({
        title: 'Other',
        value: 'other',
        description: `Enter manually.`,
      }),
    hint: 'Space to select or Enter for none.',
  });

  if (selectedNames.includes('other')) {
    const otherNames = await prompt({
      type: 'list',
      message: 'Comma separated models (ex. Video, UserImage):',
      validate: (str) => {
        const arr = str.split(/,\s*/);
        for (let el of arr) {
          if (validateCamelUpper(el) !== true) {
            return 'Please enter names in upper camel case.';
          }
        }
        return true;
      },
    });

    selectedNames = selectedNames.filter((name) => name !== 'other');
    selectedNames = selectedNames.concat(otherNames);
  }

  return selectedNames.map((name) => {
    return { name };
  });
}

async function getExistingResources(options) {
  const { models: modelNames } = options;
  let selectedNames;

  const models = await getModels();

  if (modelNames) {
    selectedNames = modelNames.map((name) => {
      const lower = name.toLowerCase();
      const model = models.find((model) => {
        const { kebab, camelLower, pluralLower } = getInflections(model.name);
        return lower === kebab || lower === camelLower.toLowerCase() || lower === pluralLower.toLowerCase();
      });
      if (!model) {
        throw new Error(`Could not resolve model "${name}".`);
      }
      return model.name;
    });
  } else {
    selectedNames = await prompt({
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

  return models
    .filter((model) => {
      return selectedNames.includes(model.name);
    })
    .map((model) => {
      return {
        name: model.name,
        schema: definitionToSchema(model.definition),
        externalScreens: [],
        subscreens: [],
        ...getInflections(model.name),
      };
    });
}
