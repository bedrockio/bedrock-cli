import { camelCase } from 'lodash';
import { assertPath } from '../util/file';
import { block } from './util/template';
import { replaceInputs } from './util/inputs';
import { readSourceFile, writeLocalFile, replaceSecondary, replaceBlock } from './util/source';

const MODALS_DIR = 'services/web/src/modals';

export async function generateModal(options) {
  const { camelUpper } = options;

  const modalsDir = await assertModalsDir();

  let source = await readSourceFile(modalsDir, 'EditProduct.js');
  source = replaceSecondary(source, options);
  source = replaceRefs(source, options);
  source = replaceNameReference(source, options);
  source = replaceImports(source, options);

  source = replaceInputs(source, options);
  await writeLocalFile(source, modalsDir, `Edit${camelUpper}.js`);
}

export async function assertModalsDir() {
  return await assertPath(MODALS_DIR);
}

function replaceImports(source, options) {
  const { schema } = options;

  const imports = [];

  if (schema.some((field) => field.type === 'Date')) {
    imports.push("import DateField from 'components/form-fields/Date';");
  }

  if (schema.some((field) => field.type.match(/Upload/))) {
    imports.push("import UploadsField from 'components/form-fields/Uploads';");
  }

  if (schema.some((field) => field.currency)) {
    imports.push("import CurrencyField from 'components/form-fields/Currency';");
  }

  if (schema.some((field) => field.type.match(/ObjectId/))) {
    imports.push("import ReferenceField from 'components/form-fields/Reference';");
  }

  source = replaceBlock(source, imports.join('\n'), 'imports');

  return source;
}

function replaceRefs(source, options) {
  const { schema } = options;

  const refs = schema
    .filter((field) => {
      return field.type === 'ObjectId';
    })
    .map((field) => {
      const camelLower = camelCase(field.ref);
      return block`
        ${camelLower}: this.props.${camelLower}?.id || ${options.camelLower}.${camelLower}?.id,
      `;
    });

  source = replaceBlock(source, refs.join('\n'), 'refs');

  return source;
}

function replaceNameReference(source, options) {
  const { camelUpper } = options;
  const hasName = options.schema.some((field) => field.name === 'name');

  if (!hasName) {
    // If the schema has no "name" field then don't
    // rely on it for the modal title.
    source = source.replace(/Edit "\${.+?}"/, `Edit ${camelUpper}`);
  }

  return source;
}
