import { plural } from 'pluralize';
import { validateCamelUpper } from '../../util/validation';
import { assertPath } from '../../util/file';
import { prompt } from '../../util/prompt';
import { getSchema } from './schema';
import { getInflections } from './inflections';
import { readLocalDirectory } from './source';

export async function setGenerateOptions(options) {

  if (!options.name) {
    options.name = await prompt({
      type: 'text',
      initial: options.name,
      message: 'Resource name (ex. User):',
      validate: validateCamelUpper,
    });
  }

  Object.assign(options, getInflections(options.name));

  options.schema = await getSchema(options.schema);

  if (options.components.includes('subscreens')) {
    if (!options.externalSubScreens) {
      options.externalSubScreens = await getExternalSubScreens(options);
    }
    if (!options.subScreens) {
      options.subScreens = await getSubScreens(options);
    }
  }

  if (options.menu == null) {
    options.menu = await prompt({
      type: 'confirm',
      initial: true,
      message: 'Generate menu link?',
    });
  }

}

async function getExternalSubScreens(options) {
  return (
    await Promise.all(
      options.schema
        .filter((field) => {
          return field.type === 'ObjectId';
        })
        .map(async (field) => {
          const { ref } = field;
          const yes = await prompt({
            type: 'confirm',
            message: `Generate ${field.ref}${options.pluralUpper} screen?`,
          });
          if (yes) {
            return getInflections(ref);
          }
        })
    )
  ).filter((ref) => ref);
}

async function getSubScreens(options) {
  const { camelUpper } = options;

  const references = [];

  const modelNames = await getModelNames(options);

  let selectedNames = await prompt({
    type: 'multiselect',
    instructions: false,
    message: 'Generate sub-screens for:',
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

const MODELS_DIR = 'services/api/src/models';
const MODEL_NAME_REG = /mongoose.(?:models.|model\(')(\w+)/;

async function getModelNames(options) {
  const { camelUpper } = options;

  const modelsDir = await assertPath(MODELS_DIR, options);

  return (await readLocalDirectory(modelsDir))
    .map((source) => {
      const match = source.match(MODEL_NAME_REG);
      return match && match[1];
    })
    .filter((name) => {
      return name && name !== camelUpper;
    });
}
