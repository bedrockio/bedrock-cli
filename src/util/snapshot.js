import path from 'path';
import { yellow } from 'kleur';
import { promises as fs } from 'fs';

export async function saveSnapshot(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(yellow(`Captured snapshot: ${file}`));
}

export async function restoreSnapshot(file) {
  try {
    return require(path.resolve(file));
  } catch (err) {
    console.log(yellow(`Could not load snapshot file "${file}"`));
    throw err;
  }
}
