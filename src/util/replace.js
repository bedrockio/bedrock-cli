import glob from 'glob';
import { promises as fs } from 'fs';

const OPTIONS = {
  dot: true,
  matchBase: true,
  ignore: '**/node_modules/**/*',
};

export function replaceAll(pattern, fn) {
  return new Promise((resolve, reject) => {
    glob(pattern, OPTIONS, async (err, files) => {
      if (err) {
        reject(err);
      } else {
        await Promise.all(
          files.map(async (file) => {
            const pre = await fs.readFile(file, 'utf8');
            const post = fn(pre);
            if (pre !== post) {
              await fs.writeFile(file, post, 'utf8');
            }
          })
        );
        resolve();
      }
    });
  });
}
