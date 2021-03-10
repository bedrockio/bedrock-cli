import path from 'path';
import { plural } from 'pluralize';
import { cwd } from '../../util/dir';
import { prompt } from '../../util/prompt';
import { saveSnapshot } from '../../util/snapshot';
import { validateCamelUpper } from '../../util/validation';
import { getSchema, definitionToSchema } from './schema';
import { getInflections } from './inflections';
import { getModels } from './models';

export async function setResourceOptions(options) {
  const { components = [] } = options;

  if (components.includes('model')) {
    const resource = await getResourceOptions(options);
    options.resources = [resource];
    await saveSnapshot(path.resolve(cwd, `${resource.kebab}.json`), options);
  } else {
    options.resources = await getExistingResources(options);
  }
}

async function getResourceOptions(options) {
  const resource = {};
  resource.name = await prompt({
    type: 'text',
    initial: options.name,
    message: 'Resource name (ex. User):',
    validate: validateCamelUpper,
  });

  Object.assign(resource, getInflections(resource.name));

  resource.schema = await getSchema();

  if (options.components.includes('subscreens')) {
    resource.externalSubScreens = await getExternalSubScreens(resource);
    resource.subScreens = await getSubScreens(resource);
  }

  resource.menu = await prompt({
    type: 'confirm',
    initial: true,
    message: 'Generate menu link?',
  });

  return resource;
}

async function getExternalSubScreens(resource) {
  const { pluralUpper } = resource;
  const selectedNames = await prompt({
    type: 'multiselect',
    instructions: false,
    message: 'Generate external screens:',
    choices: resource.schema
      .filter(({ type, schemaType }) => {
        return schemaType === 'ObjectId' && type !== 'Upload';
      })
      .map(({ ref }) => {
        const name = ref + pluralUpper;
        return {
          title: name,
          value: ref,
          description: `Generates ${name} screen.`,
        };
      }),
    hint: 'Space to select or Enter for none.',
  });

  return selectedNames.map((val) => {
    return getInflections(val);
  });
}

async function getSubScreens(resource) {
  const { camelUpper } = resource;

  const references = [];
  const models = await getModels();
  const modelNames = models
    .map((model) => model.name)
    .filter((name) => {
      return name !== camelUpper;
    });

  let selectedNames = await prompt({
    type: 'multiselect',
    instructions: false,
    message: 'Generate other screens:',
    choices: modelNames
      .map((name) => {
        return {
          title: name,
          value: name,
          description: `Generates ${camelUpper}${plural(name)} screen.`,
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

  for (let name of selectedNames) {
    references.push(getInflections(name));
  }

  return references;
}

async function getExistingResources() {
  const models = await getModels();
  const selectedNames = await prompt({
    type: 'multiselect',
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
  return models
    .filter((model) => {
      return selectedNames.includes(model.name);
    })
    .map((model) => {
      return {
        name: model.name,
        schema: definitionToSchema(model.definition),
        externalSubScreens: [],
        subScreens: [],
        ...getInflections(model.name),
      };
    });
}
