import { readDirectory, assertPath } from '../../util/file';
import { getInflections } from './inflections';
import path from 'path';

const MODELS_DIR = 'services/api/src/models/definitions';

export async function getModels() {
  const modelsDir = await assertPath(MODELS_DIR);
  const definitions = await readDirectory(path.resolve(modelsDir, '*.json'));
  return definitions.map((file) => {
    return {
      name: getInflections(path.basename(file, '.json')).camelUpper,
      definition: require(file),
    };
  });
}
