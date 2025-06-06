import { basename } from 'path';

import { glob } from 'glob';

import { readFile, writeFile } from './file.js';

export async function replaceAll(pattern, fn) {
  const files = await glob(pattern, {
    dot: true,
    absolute: true,
    ignore: '**/node_modules/**/*',
  });
  return Promise.all(
    files.map(async (filename) => {
      const pre = await readFile(filename, false);
      const base = basename(filename);
      const post = fn(pre, base);
      if (pre !== post) {
        await writeFile(filename, post);
      }
    }),
  );
}
