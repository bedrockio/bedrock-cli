import { yellow } from 'kleur';
import { assertPath } from '../util/file';
import { writeLocalFile } from './util/source';

const DEFINITIONS_DIR = 'services/api/src/models/definitions';

export async function generateModel(options) {
  const { kebab } = options;
  const dir = await assertPath(DEFINITIONS_DIR);
  const definition = getDefinition(options);
  await writeLocalFile(JSON.stringify(definition, null, 2), dir, `${kebab}.json`);

  console.log(yellow('Model generated!'));
}

function getDefinition(options) {
  const { schema } = options;
  const attributes = {};

  for (let field of schema) {
    const { name, type, schemaType, ...rest } = field;

    let obj = {
      type: schemaType,
      ...rest,
    };

    if (type.match(/Array/)) {
      obj = [obj];
    }

    attributes[name] = obj;
  }

  return {
    attributes,
  }
}
