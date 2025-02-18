import path from 'path';
import { homedir } from 'os';

import { loadJson } from './file.js';
import { writeFile } from './file.js';

const CONFIG_FILE = path.join(homedir(), '.bedrock', 'config.json');

export async function loadConfig() {
  try {
    return await loadJson(CONFIG_FILE);
  } catch {
    return {};
  }
}

export async function writeConfig(config) {
  return await writeFile(CONFIG_FILE, JSON.stringify(config));
}
