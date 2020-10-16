import path from 'path';
import fetch from 'node-fetch';
import { indent } from './template';
import { promises as fs } from 'fs';

// Set to true for testing.
const USE_LOCAL = true;

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/bedrockio/bedrock-core/master';

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
  source = replaceToken(source, /Shops/g, resource.pluralUpper);
  source = replaceToken(source, /shops/g, resource.pluralLower);
  source = replaceToken(source, /Shop/g, resource.camelUpper);
  source = replaceToken(source, /shop/g, resource.camelLower);
  return source;
}

export function replaceSecondary(source, resource) {
  source = replaceToken(source, /Products/g, resource.pluralUpper);
  source = replaceToken(source, /products/g, resource.pluralLower);
  source = replaceToken(source, /Product/g, resource.camelUpper);
  source = replaceToken(source, /product/g, resource.camelLower);
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
  const url = `${GITHUB_RAW_BASE}/${path.resolve(...args)}`;
  const response = await fetch(url);
  return response.text();
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

