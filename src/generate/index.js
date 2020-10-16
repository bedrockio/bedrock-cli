import { kebabCase } from 'lodash';
import {
  generateScreens,
  generateSubScreens,
} from './screens';
import { generateModel } from './model';
import { generateRoutes } from './routes';
import { generateModals } from './modals';
import { patchMainMenu } from './util/patch';

import { setGenerateOptions } from './util/options';
import { saveSnapshot } from '../util/snapshot';

export default async function generate(options) {
  const { components } = options;

  await setGenerateOptions(options);

  if (components.includes('model')) {
    await generateModel(options);
  }
  if (components.includes('routes')) {
    await generateRoutes(options);
  }
  if (components.includes('screens')) {
    await generateScreens(options);
  }
  if (components.includes('subscreens')) {
    await generateSubScreens(options);
  }
  if (components.includes('modals')) {
    await generateModals(options);
  }
  if (options.menu) {
    await patchMainMenu(options);
  }

  await saveSnapshot(`${kebabCase(options.name)}.json`, options);

}
