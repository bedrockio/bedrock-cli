import path from 'path';
import { readFile } from 'fs/promises';

import { exit } from '../../util/flow.js';
import { getCurrentRoot } from '../../util/dir.js';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/bedrockio/bedrock-core';

export async function getExample(options) {
  const { reference, example: exampleFile } = options;

  let example;

  if (exampleFile) {
    example = await readLocalFile(exampleFile);
  }

  example ||= await readLocalFile(reference);
  example ||= await readRemoteFile(reference);

  return example;
}

export async function readLocalFile(...args) {
  try {
    return await readFile(path.resolve(...args), 'utf8');
  } catch {
    return null;
  }
}

export async function readRemoteFile(...args) {
  const file = path.join(getCurrentRoot(), ...args);
  const url = `${GITHUB_RAW_BASE}/master/${file}`;
  const response = await fetch(url);
  if (response.status === 404) {
    exit(`Could not fetch URL: ${url}`);
  }
  return await response.text();
}
