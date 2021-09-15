import { assertPath } from '../util/file';
import { writeLocalFile } from './util/source';
import { getInflections } from './util/inflections';

const DEFINITIONS_DIR = 'services/api/src/models/definitions';

export async function generateModel(options) {
  const definition = getDefinition(options);
  const dir = await assertModelsDir();
  const { kebab } = getInflections(options.name);
  await writeLocalFile(JSON.stringify(definition, null, 2), dir, `${kebab}.json`);
}

export async function assertModelsDir() {
  return await assertPath(DEFINITIONS_DIR);
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
  };
}
