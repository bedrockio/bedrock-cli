import { block } from './util/template';
import { queueTask } from '../util/tasks';
import { assertPath } from '../util/file';
import { patchRoutesEntrypoint } from './util/patch';
import { replaceSchema } from './util/joi';
import { generateTests } from './util/tests';
import {
  readSourceFile,
  writeLocalFile,
  replaceBlock,
  replacePrimary,
} from './util/source';

const ROUTES_DIR = 'services/api/src/routes';

export async function generateRoutes(options) {
  const { schema, pluralKebab } = options;

  const routesDir = await assertRoutesDir();

  const searchSchema = getSearchSchema(schema);

  let source = await readSourceFile(routesDir, 'shops.js');
  source = replacePrimary(source, options);
  source = replaceSchema(source, searchSchema, 'search');
  source = replaceSearchQuery(source, searchSchema);

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

function getSearchSchema(schema) {
  return schema.filter((field) => {
    const { type } = field;
    // Disallow private and text fields for search
    return !field.private && type !== 'Text';
  });
}

function replaceSearchQuery(source, schema) {
  const vars = block`
    const { ${schema.map((f) => f.name).join(', ')} } = ctx.request.body;
  `;

  const queries = schema
    .map((field) => {
      const { type, name } = field;
      // TODO: for now assume that only "name"
      // requires partial text search
      if (name === 'name') {
        return block`
        if (${name}) {
          query.${name} = {
            $regex: ${name},
            $options: 'i',
          };
        }
      `;
      } else if (type.match(/Array/)) {
        return block`
        if (${name} && ${name}.length) {
          query.${name} = { $in: ${name} };
        }
      `;
      } else {
        return block`
        if (${name}) {
          query.${name} = ${name};
        }
      `;
      }
    })
    .join('\n');
  source = replaceBlock(source, vars, 'vars');
  source = replaceBlock(source, queries, 'queries');
  return source;
}
