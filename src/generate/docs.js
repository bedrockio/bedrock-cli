import path from 'path';
import { snakeCase } from 'lodash';
import { queueTask } from '../util/tasks';
import { patchIndex } from './util/patch';
import { assertPath } from '../util/file';
import { getInflections } from './util/inflections';
import { readSourceFile, writeLocalFile, replacePrimary } from './util/source';
import { routerToOpenApi } from './util/openapi';
import { assertRoutesDir } from './routes';
import { withDirSync } from '../util/shell';

const API_DOCS_DIR = 'services/api/src/routes/__openapi__';
const WEB_DOCS_DIR = 'services/web/src/docs';

export async function generateDocs(options) {
  queueTask('OpenAPI Schema', async () => {
    await generateOpenApiDocs(options);
  });
  queueTask('Markdown', async () => {
    await generateMarkdown(options);
  });
}

export async function assertApiDocsDir() {
  return await assertPath(API_DOCS_DIR);
}

export async function assertWebDocsDir() {
  return await assertPath(WEB_DOCS_DIR);
}

async function generateOpenApiDocs(options) {
  const { pluralKebab } = getInflections(options.name);
  const routesFile = path.resolve(await assertRoutesDir(), `${pluralKebab}.js`);
  const apiDocsFile = path.resolve(
    await assertApiDocsDir(),
    `${pluralKebab}.json`
  );
  let router;
  withDirSync('services/api', () => {
    router = require(routesFile);
  });
  let data = loadExistingDocs(apiDocsFile);
  data = routerToOpenApi(router, data || {});
  await writeLocalFile(JSON.stringify(data, null, 2), apiDocsFile);
}

function loadExistingDocs(file) {
  try {
    return require(file);
  } catch (err) {
    return null;
  }
}

export async function generateMarkdown(options) {
  const { pluralLower } = getInflections(options.name);

  const isAn = pluralLower.match(/^[aeiou]|ho/);

  const webDocsDir = await assertWebDocsDir();
  let source = await readSourceFile(webDocsDir, 'SHOPS.md');
  source = replacePrimary(source, options);

  if (isAn) {
    source = source.replace(/about a/g, 'about an');
  }

  // Generator doesn't know this so just remove for now.
  source = source.replace(/\s*requires admin permissions\.?/gi, '');

  const filename = snakeCase(pluralLower).toUpperCase();
  await writeLocalFile(source, webDocsDir, `${filename}.md`);
  await patchIndex(webDocsDir, filename, 'md');
}
