import { queueTask } from '../util/tasks';
import { assertPath } from '../util/file';
import { getInflections } from './util/inflections';
import { patchRoutesEntrypoint } from './util/patch';
import { readSourceFile, writeLocalFile, replacePrimary } from './util/source';

const ROUTES_DIR = 'services/api/src/routes';
const TESTS_DIR = 'services/api/src/routes/__tests__';

export async function generateRoutes(options) {
  const { pluralKebab } = getInflections(options.name);

  const routesDir = await assertRoutesDir();

  let source = await readSourceFile(routesDir, 'shops.js');
  source = replacePrimary(source, options);

  queueTask('API', async () => {
    await writeLocalFile(source, routesDir, `${pluralKebab}.js`);
    await patchRoutesEntrypoint(routesDir, options);
  });

  queueTask('Tests', async () => {
    await generateTests(options);
  });
}

export async function assertRoutesDir() {
  return await assertPath(ROUTES_DIR);
}

async function generateTests(options) {
  const { pluralKebab } = getInflections(options.name);
  const testsDir = await assertPath(TESTS_DIR);
  let source = await readSourceFile(testsDir, 'shops.js');
  source = replacePrimary(source, options);
  await writeLocalFile(source, testsDir, `${pluralKebab}.js`);
}
