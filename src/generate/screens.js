import { startCase } from 'lodash';
import { queueTask } from '../util/tasks';
import { assertPath } from '../util/file';
import { block } from './util/template';
import { replaceFilters } from './util/filters';
import { patchAppEntrypoint } from './util/patch';
import { getInflections } from './util/inflections';
import { readSourceFile, writeLocalFile, replaceBlock, replacePrimary, replaceSecondary } from './util/source';
import { prompt } from '../util/prompt';

const FILES = [
  'index.js',
  'Actions.js',
  'List/index.js',
  'Detail/index.js',
  'Detail/Context.js',
  'Detail/Overview.js',
  'Detail/Menu.js',
];

const SCREENS_DIR = 'services/web/src/screens';

export async function generateScreens(options, globalOptions) {
  const { screensDir } = globalOptions;
  const { pluralUpper } = getInflections(options.name);
  options.overviewImports = {};

  // Do this sequentially to ensure order
  for (let file of FILES) {
    let source = await readSourceFile(SCREENS_DIR, 'Shops', file);
    source = replaceExcluded(source, options);
    source = replacePrimary(source, options);
    source = replaceSubscreenRoutes(source, options);
    source = replaceSubscreenMenus(source, options);
    source = replaceDetailImports(source, options);
    source = replaceOverviewFields(source, options);
    source = replaceOverviewRows(source, options);
    source = replaceOverviewImports(source, options);
    source = replaceListHeaderCells(source, options);
    source = replaceListBodyCells(source, options);
    source = replaceListImports(source, options);
    source = replaceFilters(source, options);
    await writeLocalFile(source, screensDir, pluralUpper, file);
  }

  // Attempt to patch app entrypoint
  await patchAppEntrypoint(options);
}

export async function generateSubscreens(options, globalOptions) {
  const { screensDir } = globalOptions;
  const source = await readSourceFile(SCREENS_DIR, 'Shops/Detail/Products.js');
  await generateSubscreensFor(screensDir, source, [options], options.subscreens || []);
  await generateSubscreensFor(screensDir, source, options.externalSubscreens || [], [options]);
}

export async function promptScreensDir(options) {
  const dir = await prompt({
    type: 'text',
    message: `Path to screens:`,
    initial: SCREENS_DIR,
  });
  options.screensDir = await assertPath(dir);
}

async function generateSubscreensFor(screensDir, source, primary, secondary) {
  if (primary.length && secondary.length) {
    await Promise.all(
      primary.map(async (primary) => {
        const pInflections = getInflections(primary.name);
        return Promise.all(
          secondary.map(async (secondary) => {
            const sInflections = getInflections(secondary.name);
            queueTask(`${pInflections.camelUpper}${sInflections.pluralUpper}`, async () => {
              let src = source;
              src = replacePrimary(src, primary);
              src = replaceSecondary(src, secondary);
              src = replaceListHeaderCells(src, secondary);
              src = replaceListBodyCells(src, secondary, primary);
              src = replaceListImports(src, primary);
              await writeLocalFile(
                src,
                screensDir,
                pInflections.pluralUpper,
                'Detail',
                `${sInflections.pluralUpper}.js`
              );
            });
          })
        );
      })
    );
  }
}

function replaceExcluded(source) {
  return replaceBlock(source, '', 'exclude');
}

function replaceSubscreenRoutes(source, options) {
  const { pluralLower } = getInflections(options.name);
  const { subscreens = [] } = options;
  const imports = subscreens
    .map((screen) => {
      const sInflections = getInflections(screen.name);
      return block`
      <Protected
        exact
        path="/${pluralLower}/:id/${sInflections.pluralLower}"
        allowed={${sInflections.pluralUpper}}
      />
    `;
    })
    .join('\n');
  return replaceBlock(source, imports, 'routes');
}

function replaceSubscreenMenus(source, options) {
  const { pluralKebab } = getInflections(options.name);
  const { subscreens = [] } = options;
  const imports = subscreens
    .map((screen) => {
      const sInflections = getInflections(screen.name);
      return block`
      <Menu.Item
        name="${sInflections.pluralUpper}"
        to={\`/${pluralKebab}/\${item.id}/${sInflections.pluralLower}\`}
        as={NavLink}
        exact
      />
    `;
    })
    .join('\n');
  return replaceBlock(source, imports, 'menus');
}

function replaceDetailImports(source, options) {
  const { subscreens = [] } = options;
  const imports = subscreens
    .map((resource) => {
      const { pluralUpper } = getInflections(resource.name);
      return `import ${pluralUpper} from './${pluralUpper}';`;
    })
    .join('\n');

  return replaceBlock(source, imports, 'detail-imports');
}

function replaceOverviewFields(source, options) {
  const summaryFields = getSummaryFields(options);
  const jsx = summaryFields
    .filter((field) => field.name !== 'name')
    .map((field) => {
      const { name } = field;
      if (name === 'image') {
        options.overviewImports.image = true;
        return block`
        {item.image && (
          <Image key={item.image.id} src={urlForUpload(item.image)} />
        )}
      `;
      } else if (name === 'images') {
        options.overviewImports.image = true;
        return block`
        <Image.Group size="small">
          {item.images.map((image) => (
            <Image key={image.id} src={urlForUpload(image)} />
          ))}
        </Image.Group>
      `;
      } else {
        return block`
        <Header as="h3">{item.${name}}</Header>
      `;
      }
    })
    .join('\n');

  return replaceBlock(source, jsx, 'overview-fields');
}

function replaceOverviewRows(source, options) {
  const summaryFields = getSummaryFields(options);
  const otherFields = options.schema.filter((field) => {
    return !summaryFields.includes(field);
  });

  const rows = otherFields
    .map((field) => {
      const { name, type } = field;
      if (!type.match(/ObjectId/)) {
        return block`
        <Table.Row>
          <Table.Cell>${startCase(name)}</Table.Cell>
          <Table.Cell>
            {${getOverviewCellValue(`item.${name}`, field, options)}}
          </Table.Cell>
        </Table.Row>
      `;
      }
    })
    .filter((r) => r);

  source = replaceBlock(source, rows.join('\n'), 'overview-rows');

  return source;
}

function getOverviewCellValue(token, field, options) {
  switch (field.type) {
    case 'UploadArray':
    case 'StringArray':
    case 'ObjectIdArray':
      return `${token}.join(', ') || 'None'`;
    case 'Boolean':
      return `${token} ? 'Yes' : 'No'`;
    case 'Date':
      if (field.time) {
        options.overviewImports.time = true;
        return `${token} ? formatDateTime(${token}) : 'None'`;
      } else {
        options.overviewImports.date = true;
        return `${token} ? formatDate(${token}) : 'None'`;
      }
    default:
      return `${token} || 'None'`;
  }
}

function replaceOverviewImports(source, options) {
  const imports = [];
  const semantic = [];

  const dateMethods = ['formatDateTime'];

  if (options.overviewImports.date) {
    dateMethods.unshift('formatDate');
  }

  imports.push(`import { ${dateMethods.join(', ')} } from 'utils/date';`);

  if (options.overviewImports.image) {
    semantic.push('Image');
    imports.push("import { urlForUpload } from 'utils/uploads';");
  }

  if (semantic.length) {
    imports.unshift(`import { ${semantic.join(', ')} } from 'semantic';`);
  }

  source = replaceBlock(source, imports.join('\n'), 'overview-imports');

  return source;
}

function replaceListHeaderCells(source, options) {
  const summaryFields = getSummaryFields(options);
  const jsx = summaryFields
    .map((field) => {
      const { name, type } = field;
      if (type === 'String') {
        return block`
        <Table.HeaderCell
          sorted={getSorted('${name}')}
          onClick={() => setSort('${name}')}>
          ${startCase(name)}
        </Table.HeaderCell>
      `;
      } else {
        return block`
        <Table.HeaderCell>
         ${name === 'id' ? 'ID' : startCase(name)}
        </Table.HeaderCell>
      `;
      }
    })
    .join('\n');

  return replaceBlock(source, jsx, 'list-header-cells');
}

function replaceListBodyCells(source, options, resource) {
  let isSubscreen = !!resource;
  if (!isSubscreen) {
    resource = options;
  }
  resource.listImports = {
    type: isSubscreen ? 'subscreen-imports' : 'list-imports',
  };

  const { pluralKebab } = getInflections(resource.name);

  const summaryFields = getSummaryFields(options);
  const jsx = summaryFields
    .map((field, i) => {
      const { name } = field;
      let inner;
      if (name === 'image' || name === 'images') {
        const idx = name === 'images' ? '[0]' : '';
        resource.listImports.image = true;
        inner = `
        {item.${name}${idx} && (
          <Image size="tiny" src={urlForUpload(item.${name}${idx}, true)} />
        )}
      `;
      } else {
        inner = `{item.${name}}`;
      }

      if (i === 0 && !isSubscreen) {
        resource.listImports.link = true;
        inner = `
          <Link to={\`/${pluralKebab}/\${item.id}\`}>
            ${inner}
          </Link>
      `;
      }
      return block`
        <Table.Cell>
          ${inner}
        </Table.Cell>
    `;
    })
    .join('\n');

  return replaceBlock(source, jsx, 'list-body-cells');
}

function replaceListImports(source, options) {
  const imports = [];
  const { listImports } = options;

  if (listImports.image) {
    imports.push("import { urlForUpload } from 'utils/uploads';");
    imports.push("import { Image } from 'semantic';");
  }

  if (listImports.link) {
    imports.push("import { Link } from 'react-router-dom';");
  }

  source = replaceBlock(source, imports.join('\n'), listImports.type);

  return source;
}

function getSummaryFields(options) {
  // Try to take the "name" and "image" fields if they exist.
  const summaryFields = (options.schema || []).filter((field) => {
    const { name } = field;
    return name === 'name' || name === 'image' || name === 'images';
  });
  if (!summaryFields.length) {
    summaryFields.push({
      name: 'id',
      type: 'id',
    });
  }
  return summaryFields;
}
