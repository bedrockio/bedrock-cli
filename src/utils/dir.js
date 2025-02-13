import path from 'path';
import { promises as fs, constants } from 'fs';

import kleur from 'kleur';

const ROOT_DIR = '/';
let currentRoot;

export const cwd = process.cwd();

export async function assertBedrockRoot() {
  let dir = cwd;

  while (dir !== ROOT_DIR) {
    try {
      await fs.access(path.resolve(dir, 'deployment', 'environments'), constants.W_OK);
      break;
    } catch {
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

  currentRoot = dir;

  return dir;
}

export async function assertBedrockApi() {
  await assertBedrockRoot();
  setCurrentRoot('services/api');
}

export async function assertBedrockWeb() {
  await assertBedrockRoot();
  setCurrentRoot('services/web');
}

export function getCurrentRoot() {
  return currentRoot;
}

function setCurrentRoot(dir) {
  process.chdir(dir);
  currentRoot = dir;
}

// TODO remove?
export async function assertBedrockServicesRoot() {
  let dir = cwd;

  while (dir !== ROOT_DIR) {
    try {
      await fs.access(path.resolve(dir, 'services'), constants.W_OK);
      break;
    } catch {
      dir = path.resolve(dir, '..');
      if (dir === '/') {
        console.info(kleur.red('Could not find Bedrock Services root directory!'));
        process.exit(1);
      }
    }
  }

  if (dir !== process.cwd()) {
    process.chdir(dir);
  }

  return dir;
}
