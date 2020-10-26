import path from 'path';
import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import { runAsTask } from '../../util/tasks';
import { indent } from './template';

// Set to true to test locally
const USE_LOCAL = false;

// Until PR lands:
const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/bedrockio/bedrock-core/generator';
//const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/bedrockio/bedrock-core/master';

const GENERATOR_REG = /^([^\n]*)(\/\/|\{\/\*) --- Generator: BLOCK[\s\S]+?--- Generator: end(?: \*\/\})?$/gm;

export function replaceBlock(source, inject, block) {
  const src = GENERATOR_REG.source.replace(/BLOCK/, block);
  const reg = RegExp(src, 'gm');
  source = source.replace(reg, (match, tabs) => {
    return inject ? indent(inject, tabs) : '';
  });
  source = source.replace(/\n{3,}/gim, '\n\n');
  return source;
}

export function replacePrimary(source, resource) {
  const {
    kebab,
    camelLower,
    camelUpper,
    pluralLower,
    pluralUpper,
    pluralKebab,
  } = resource;
  source = replaceToken(
    source,
    /require\((.*)shops/g,
    `require($1${pluralKebab})`
  );
  source = replaceToken(source, /require\((.*?)shop\b/g, `require($1${kebab}`);
  source = replaceToken(source, /Shops/g, pluralUpper);
  source = replaceToken(source, /shops/g, pluralLower);
  source = replaceToken(source, /Shop/g, camelUpper);
  source = replaceToken(source, /shop/g, camelLower);
  return source;
}

export function replaceSecondary(source, resource) {
  const {
    kebab,
    camelLower,
    camelUpper,
    pluralLower,
    pluralUpper,
    pluralKebab,
  } = resource;
  source = replaceToken(
    source,
    /require\((.*)products/g,
    `require($1${pluralKebab})`
  );
  source = replaceToken(source, /require\((.*?)product\b/g, `require($1${kebab}`);
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
  return await fs.writeFile(path.resolve(...args), source, 'utf8');
}

export async function readRemoteFile(...args) {
  const file = args.join('/');
  return await runAsTask('Reading Source', async () => {
    const response = await fetch(`${GITHUB_RAW_BASE}/${file}`);
    return await response.text();
  });
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
