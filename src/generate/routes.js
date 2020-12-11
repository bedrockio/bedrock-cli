import { yellow } from 'kleur';
import { block } from './util/template';
import { assertPath } from '../util/file';
import { patchRoutesEntrypoint } from './util/patch';
import { replaceSchema } from './util/joi';
import { generateDocs } from './util/docs';
import { generateTests } from './util/tests';
import { generateOpenApi } from './util/openapi';
import {
  readSourceFile,
  writeLocalFile,
  replaceBlock,
  replacePrimary,
} from './util/source';

const ROUTES_DIR = 'services/api/src/routes';

export async function generateRoutes(options) {
  const { schema, pluralKebab } = options;

  const routesDir = await assertPath(ROUTES_DIR, options);

  const searchSchema = getSearchSchema(schema);

  let source = await readSourceFile(routesDir, 'shops.js');
  source = replacePrimary(source, options);
  source = replaceSchema(source, schema, 'create');
  source = replaceSchema(source, schema, 'update');
  source = replaceSchema(source, searchSchema, 'search');
  source = replaceSearchQuery(source, searchSchema);

  await writeLocalFile(source, routesDir, `${pluralKebab}.js`);

  await generateDocs(options);
  await generateTests(options);
  await generateOpenApi(options);
  await patchRoutesEntrypoint(routesDir, options);

  console.log(yellow('Routes generated!'));
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
