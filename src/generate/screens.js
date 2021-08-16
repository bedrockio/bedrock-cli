import { startCase } from 'lodash';
import { assertPath } from '../util/file';
import { queueTask } from '../util/tasks';
import { block } from './util/template';
import { replaceFilters } from './util/filters';
import { patchAppEntrypoint } from './util/patch';
import { readSourceFile, writeLocalFile, replaceBlock, replacePrimary, replaceSecondary } from './util/source';

const FILES = ['index.js', 'List/index.js', 'Detail/index.js', 'Detail/Overview.js', 'Detail/Menu.js'];

const SCREENS_DIR = 'services/web/src/screens';

export async function generateScreens(options) {
  const { pluralUpper } = options;
  options.overviewImports = {};

  const screensDir = await assertScreensDir();

  // Do this sequentially to ensure order
  for (let file of FILES) {
    let source = await readSourceFile(screensDir, 'Shops', file);
    source = replacePrimary(source, options);
    source = replaceSubScreenRoutes(source, options);
    source = replaceSubScreenMenus(source, options);
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

export async function generateSubScreens(options) {
  const screensDir = await assertScreensDir();
  const source = await readSourceFile(screensDir, 'Shops/Detail/Products.js');
  await generateSubScreensFor(screensDir, source, [options], options.subScreens);
  await generateSubScreensFor(screensDir, source, options.externalSubScreens, [options]);
}

export async function assertScreensDir() {
  return await assertPath(SCREENS_DIR);
}

async function generateSubScreensFor(screensDir, source, primary, secondary) {
  if (primary.length && secondary.length) {
    await Promise.all(
      primary.map(async (primary) => {
        return Promise.all(
          secondary.map(async (secondary) => {
            queueTask(`${primary.camelUpper}${secondary.pluralUpper}`, async () => {
              let src = source;
              src = replacePrimary(src, primary);
              src = replaceSecondary(src, secondary);
              src = replaceListHeaderCells(src, secondary);
              src = replaceListBodyCells(src, secondary, primary);
              src = replaceListImports(src, primary);
              await writeLocalFile(src, screensDir, primary.pluralUpper, 'Detail', `${secondary.pluralUpper}.js`);
            });
          })
        );
      })
    );
  }
}

function replaceSubScreenRoutes(source, options) {
  const { subScreens = [] } = options;
  const imports = subScreens
    .map(({ pluralLower, pluralUpper }) => {
      return block`
      <Route
        exact
        path="/${options.pluralLower}/:id/${pluralLower}"
        render={(props) => (
          <${pluralUpper}
            {...props}
            {...this.state}
            onSave={this.fetch${options.camelUpper}}
          />
        )}
      />
    `;
    })
    .join('\n');
  return replaceBlock(source, imports, 'routes');
}

function replaceSubScreenMenus(source, options) {
  const { subScreens = [] } = options;
  const imports = subScreens
    .map(({ pluralLower, pluralUpper }) => {
      return block`
      <Menu.Item
        name="${pluralUpper}"
        to={\`/${options.pluralKebab}/\${${options.kebab}.id}/${pluralLower}\`}
        as={NavLink}
        exact
      />
    `;
    })
    .join('\n');
  return replaceBlock(source, imports, 'menus');
}

function replaceDetailImports(source, options) {
  const { subScreens = [] } = options;
  const imports = subScreens
    .map((resource) => {
      const { pluralUpper } = resource;
      return `import ${pluralUpper} from './${pluralUpper}';`;
    })
    .join('\n');

  return replaceBlock(source, imports, 'detail-imports');
}

function replaceOverviewFields(source, options) {
  const { camelLower } = options;
  const summaryFields = getSummaryFields(options);
  const jsx = summaryFields
    .filter((field) => field.name !== 'name')
    .map((field) => {
      const { name } = field;
      if (name === 'image') {
        options.overviewImports.image = true;
        return block`
        {${camelLower}.image && (
          <Image key={${camelLower}.image.id} src={urlForUpload(${camelLower}.image)} />
        )}
      `;
      } else if (name === 'images') {
        options.overviewImports.image = true;
        return block`
        <Image.Group size="small">
          {${camelLower}.images.map((image) => (
            <Image key={image.id} src={urlForUpload(image)} />
          ))}
        </Image.Group>
      `;
      } else {
        options.overviewImports.header = true;
        return block`
        <Header as="h3">{${camelLower}.${name}}</Header>
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
            {${getOverviewCellValue(`${options.camelLower}.${name}`, field, options)}}
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

  const dateMethods = ['formatDateTime'];

  if (options.overviewImports.date) {
    dateMethods.unshift('formatDate');
  }

  imports.push(`import { ${dateMethods.join(', ')} } from 'utils/date';`);

  if (options.overviewImports.image) {
    imports.push("import { urlForUpload } from 'utils/uploads';");
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

  const { camelLower, pluralKebab } = resource;

  const summaryFields = getSummaryFields(options);
  const jsx = summaryFields
    .map((field, i) => {
      const { name } = field;
      let inner;
      if (name === 'image' || name === 'images') {
        const idx = name === 'images' ? '[0]' : '';
        resource.listImports.image = true;
        inner = `
        {${camelLower}.${name}${idx} && (
          <Image size="tiny" src={urlForUpload(${camelLower}.${name}${idx}, true)} />
        )}
      `;
      } else {
        inner = `{${camelLower}.${name}}`;
      }

      if (i === 0 && !isSubscreen) {
        resource.listImports.link = true;
        inner = `
          <Link to={\`/${pluralKebab}/\${${camelLower}.id}\`}>
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
    imports.push("import { Image } from 'semantic-ui-react';");
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
