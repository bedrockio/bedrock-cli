import path from 'path';
import { assertPath } from '../../util/file';
import { getInflections } from './inflections';
import { readLocalFile, writeLocalFile } from './source';

// App Entrypoint

const APP_ENTRYPOINT_PATH = 'services/web/src/App.js';

const ROUTE_REG = /^(\s*)(<(AuthSwitch|Protected|Route)[\s\S]+?\/>)/m;
const IMPORTS_REG = /^import.*from.*screens.*$/gm;

export async function patchAppEntrypoint(options) {
  const { pluralKebab, pluralUpper } = getInflections(options.name);
  const entrypointPath = await assertAppEntrypointPath();
  let source = await readLocalFile(entrypointPath);
  const jsx = `<Protected path="/${pluralKebab}/:id?" allowed={${pluralUpper}} />\n`;
  if (!source.includes(jsx)) {
    source = source.replace(ROUTE_REG, (match, space, rest) => {
      return space + jsx + space + rest;
    });
    source = replaceImports(source, options);
  }
  await writeLocalFile(source, entrypointPath);
}

export async function assertAppEntrypointPath() {
  return await assertPath(APP_ENTRYPOINT_PATH);
}

// Imports

function replaceImports(source, options) {
  const { pluralUpper } = getInflections(options.name);
  const index = getImportsLastIndex(source);
  if (index > 0) {
    let str = '';
    str += source.slice(0, index);
    str += '\n';
    str += `import ${pluralUpper} from 'screens/${pluralUpper}';`;
    str += source.slice(index);
    source = str;
  }
  return source;
}

function getImportsLastIndex(str) {
  IMPORTS_REG.lastIndex = 0;
  let index;
  while (IMPORTS_REG.test(str)) {
    index = IMPORTS_REG.lastIndex;
  }
  return index;
}

// Index Entrypoints

export async function patchIndex(dir, name, ext = '') {
  const file = path.join(dir, 'index.js');
  try {
    ext = ext ? `.${ext}` : '';
    const line = `export { default as ${name} } from './${name}${ext}';`;
    let source = await readLocalFile(file);
    if (!source.includes(line)) {
      if (source.slice(-1) !== '\n') {
        source += '\n';
      }
      source += line;
    }
    await writeLocalFile(source, dir, 'index.js');
  } catch (err) {
    throw new Error(`Could not patch ${file}`);
  }
}

// Entrypoint

const REQUIRE_REG = /^const \w+ = require\('.+'\);$/gm;
const ROUTES_REG = /^router.use\(.+\);$/gm;

function injectByReg(source, replace, reg) {
  if (!source.includes(replace)) {
    const match = source.match(reg);
    if (match) {
      const last = match[match.length - 1];
      const index = source.indexOf(last) + last.length;

      let src = '';
      src += source.slice(0, index);
      src += '\n';
      src += replace;
      src += source.slice(index);
      source = src;
    }
  }
  return source;
}

export async function patchRoutesEntrypoint(routesDir, options) {
  const { pluralLower, pluralKebab } = getInflections(options.name);
  let source = await readLocalFile(routesDir, 'index.js');

  const requires = `const ${pluralLower} = require('./${pluralKebab}');`;
  const routes = `router.use('/${pluralKebab}', ${pluralLower}.routes());`;

  source = injectByReg(source, requires, REQUIRE_REG);
  source = injectByReg(source, routes, ROUTES_REG);

  await writeLocalFile(source, routesDir, 'index.js');
}
