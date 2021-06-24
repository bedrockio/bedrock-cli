import path from 'path';
import kleur from 'kleur';
import { promises as fs, constants } from 'fs';

const ROOT_DIR = '/';

export const cwd = process.cwd();

export async function assertBedrockRoot() {
  let dir = cwd;

  while (dir !== ROOT_DIR) {
    try {
      await fs.access(path.resolve(dir, 'deployment', 'environments'), constants.W_OK);
      break;
    } catch (err) {
      dir = path.resolve(dir, '..');
      if (dir === '/') {
        console.info(kleur.red('Could not find Bedrock root directory!'));
        process.exit(1);
      }
    }
  }

  if (dir !== process.cwd()) {
    process.chdir(dir);
  }

  return dir;
}
