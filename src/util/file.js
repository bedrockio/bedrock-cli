import path from 'path';
import glob from 'glob';
import rimraf from 'rimraf';
import mkdir from 'mkdirp';
import { promises as fs } from 'fs';
import { prompt } from './prompt';
import { promisify } from 'util';

export const readDirectory = promisify(glob);

export function removeFiles(path) {
  return new Promise((resolve, reject) => {
    try {
      rimraf(path, resolve);
    } catch(err) {
      reject(err);
    }
  });
}

// Path resolution with caching. If a directory doesn't
// exist will prompt the user for the updated directory
// and cache the result to be used later.

const cache = new Map();

export async function assertPath(dir) {
  let relDir = getRelativePath(dir);
  if (cache.has(relDir)) {
    return cache.get(relDir);
  }
  try {
    await fs.stat(relDir);
    return relDir;
  } catch(err) {
    const newDir = await prompt({
      type: 'text',
      name: 'path',
      message: `${path.basename(relDir)} dir`,
      initial: relDir,
    });
    await mkdir(newDir);
    cache.set(relDir, newDir);
    return newDir;
  }
}

function getRelativePath(...args) {
  return path.relative(process.cwd(), ...args);
}

export async function readFile(file) {
  if (file.match(/\.json$/)) {
    return require(file);
  } else {
    await fs.readFile(file, 'utf8');
  }
}

export async function writeFile(file, data) {
  await fs.writeFile(file, data, 'utf8');
}
