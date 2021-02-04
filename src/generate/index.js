import path from 'path';
import { kebabCase } from 'lodash';
import {
  generateScreens,
  generateSubScreens,
} from './screens';

import { assertBedrockRoot } from '../util/dir';
import { setGenerateOptions } from './util/options';
import { saveSnapshot } from '../util/snapshot';

import { generateModel } from './model';
import { generateRoutes } from './routes';
import { generateModals } from './modals';
import { patchMainMenu } from './util/patch';

export default async function generate(options) {
  const { resources } = options;

  const dir = process.cwd();

  await assertBedrockRoot();

  await setGenerateOptions(options);

  if (resources.includes('model')) {
    await generateModel(options);
  }
  if (resources.includes('routes')) {
    await generateRoutes(options);
  }
  if (resources.includes('screens')) {
    await generateScreens(options);
  }
  if (resources.includes('subscreens')) {
    await generateSubScreens(options);
  }
  if (resources.includes('modals')) {
    await generateModals(options);
  }
  if (options.menu) {
    await patchMainMenu(options);
  }

  await saveSnapshot(path.resolve(dir, `${kebabCase(options.name)}.json`), options);
}
