import path from 'path';
import { promises as fs, constants } from 'fs';

import { exit } from './flow.js';

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
        exit('Could not find Bedrock root directory!');
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
