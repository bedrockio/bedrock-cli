import { snakeCase } from 'lodash';
import { assertPath } from '../../util/file';
import { patchIndex } from './patch';
import {
  readSourceFile,
  writeLocalFile,
  replacePrimary,
} from './source';

const DOCS_DIR = 'services/web/src/docs';

export async function generateDocs(options) {
  const { pluralLower } = options;

  const isAn = pluralLower.match(/^[aeiou]|ho/);

  const docsDir = await assertPath(DOCS_DIR);
  let source = await readSourceFile(docsDir, 'SHOPS.md');
  source = replacePrimary(source, options);

  if (isAn) {
    source = source.replace(/about a/g, 'about an');
  }

  // Generator doesn't know this so just remove for now.
  source = source.replace(/\s*requires admin permissions\.?/gi, '');


  const filename = snakeCase(pluralLower).toUpperCase();
  await writeLocalFile(source, docsDir, `${filename}.md`);
  await patchIndex(docsDir, filename, 'md');
}
