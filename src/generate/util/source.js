import path from 'path';
import mkdir from 'mkdirp';
import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import { indent } from './template';
import { getInflections } from './inflections';
import { exec } from '../../util/shell';

// Set to true to test locally
const USE_LOCAL = false;

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/bedrockio/bedrock-core';

let ref = 'master';

const GENERATOR_REG = /^([^\n]*)(\/\/|\{\/\*) --- Generator: BLOCK[\s\S]+?--- Generator: end(?: \*\/\})?$/gm;

export async function setRemoteBase(options) {
  if (options.ref) {
    ref = options.ref;
  } else {
    try {
      ref = await exec('git rev-list -1 bedrock-cut');
    } catch {
      // Fall back to master.
    }
  }
}

export function replaceBlock(source, inject, block) {
  const src = GENERATOR_REG.source.replace(/BLOCK/, block);
  const reg = RegExp(src, 'gm');
  source = source.replace(reg, (match, tabs) => {
    return inject ? indent(inject, tabs) : '';
  });
  source = source.replace(/^.+eslint-disable-next-line.+\n/gm, '');
  source = source.replace(/\n{3,}/gim, '\n\n');
  return source;
}

export function replacePrimary(source, options) {
  const inflections = getInflections(options.name);
  const { kebab, natural, camelLower, camelUpper, pluralLower, pluralUpper, pluralKebab, pluralNatural } = inflections;
  source = replaceToken(source, /require\((.*)shops/g, `require($1${pluralKebab})`);
  source = replaceToken(source, /require\((.*?)shop\b/g, `require($1${kebab}`);
  source = replaceToken(source, /\/shops/g, `/${pluralKebab}`);

  if (options.mode === 'screens') {
    // If generating screens, assume that a standalone
    // Shop should be replaced with the natural name
    // which would include spaces if multiple words.
    source = replaceToken(source, /([">])([\w\s]*)Shop([\w\s]*)(["<])/g, `$1$2${natural}$3$4`);
    source = replaceToken(source, /([">])([\w\s]*)Shops([\w\s]*)(["<])/g, `$1$2${pluralNatural}$3$4`);
  }

  source = replaceToken(source, /Shops/g, pluralUpper);
  source = replaceToken(source, /shops/g, pluralLower);
  source = replaceToken(source, /shop/g, camelLower);
  source = replaceToken(source, /Shop/g, camelUpper);

  return source;
}

export function replaceSecondary(source, resource) {
  const inflections = getInflections(resource.name);
  const { kebab, camelLower, camelUpper, pluralLower, pluralUpper, pluralKebab } = inflections;
  source = replaceToken(source, /require\((.*)products/g, `require($1${pluralKebab})`);
  source = replaceToken(source, /require\((.*?)product\b/g, `require($1${kebab}`);
  source = replaceToken(source, /\/products/g, `/${pluralKebab}`);
  source = replaceToken(source, /Products/g, pluralUpper);
  source = replaceToken(source, /products/g, pluralLower);
  source = replaceToken(source, /Product/g, camelUpper);
  source = replaceToken(source, /product/g, camelLower);
  return source;
}

export function readSourceFile(...args) {
  if (USE_LOCAL) {
    return readLocalFile(...args);
  } else {
    return readRemoteFile(...args);
  }
}

export async function writeLocalFile(source, ...args) {
  const file = path.resolve(...args);
  await mkdir(path.dirname(file));
  return await fs.writeFile(file, source, 'utf8');
}

export async function readRemoteFile(...args) {
  const file = args.join('/');
  const url = `${GITHUB_RAW_BASE}/${ref}/${file}`;
  const response = await fetch(url);
  if (response.status === 404) {
    throw new Error(`${url} was not found`);
  }
  return await response.text();
}

export async function readLocalDirectory(...args) {
  const dir = path.resolve(...args);
  const entries = await fs.readdir(dir);
  return Promise.all(
    entries
      .filter((file) => file.match(/\.js$/))
      .map((file) => {
        return readLocalFile(dir, file);
      })
  );
}

export function readLocalFile(...args) {
  return fs.readFile(path.resolve(...args), 'utf8');
}

function replaceToken(source, reg, token) {
  if (token) {
    source = source.replace(reg, token);
  }
  return source;
}
