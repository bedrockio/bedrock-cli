import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

import { glob } from 'glob';

import { prompt } from './prompt.js';

export async function readDirectory(...args) {
  const files = await glob(path.resolve(...args));
  files.sort();
  return files;
}

export async function loadJson(...dirs) {
  const source = await fs.readFile(path.resolve(...dirs), 'utf8');
  return JSON.parse(source);
}

export function getDirname(url) {
  return path.dirname(fileURLToPath(url));
}

export function getRelativeFile(meta, ...args) {
  return path.resolve(getDirname(meta.url), ...args);
}

export async function removeFiles(path) {
  await fs.rm(path);
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
  } catch {
    const newDir = await prompt({
      type: 'text',
      name: 'path',
      message: `Location of ${relDir}?`,
      initial: relDir,
    });
    await mkdirp(newDir);
    cache.set(relDir, newDir);
    return newDir;
  }
}

function getRelativePath(dir) {
  return path.relative(process.cwd(), dir);
}

export async function readFile(file) {
  if (file.match(/\.json$/)) {
    return await loadJson(file);
  } else {
    return await fs.readFile(file, 'utf8');
  }
}

export async function writeFile(file, data) {
  await mkdirp(path.dirname(file));
  await fs.writeFile(file, data, 'utf8');
}

async function mkdirp(dir) {
  await fs.mkdir(dir, {
    recursive: true,
  });
}
