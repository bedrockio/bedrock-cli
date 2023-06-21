import { assertPath } from '../util/file';
import { getInflections } from './util/inflections';
import { patchRoutesEntrypoint } from './util/patch';
import { readSourceFile, writeLocalFile, replacePrimary } from './util/source';

const ROUTES_DIR = 'services/api/src/routes';

export async function generateRoutes(options) {
  const { pluralKebab } = getInflections(options.name);

  const routesDir = await assertRoutesDir();

  let source = await readSourceFile(routesDir, 'shops.js');
  source = replacePrimary(source, options);

  await writeLocalFile(source, routesDir, `${pluralKebab}.js`);
  await patchRoutesEntrypoint(routesDir, options);
}

export async function assertRoutesDir() {
  return await assertPath(ROUTES_DIR);
}
