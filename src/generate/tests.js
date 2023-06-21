import path from 'path';
import { indent } from './util/template';
import { promises as fs } from 'fs';

// Generate tests from a Koa router.
export async function generateTests(options) {
  const { routerPath } = options;
  const { name: routerName, dir: routerDir, base: apiBase } = parseRouterPath(routerPath);
  const router = require(path.join(process.cwd(), routerPath));

  const describes = [];

  for (let layer of router.stack) {
    const method = layer.methods[layer.methods.length - 1];
    if (method) {
      const { path: urlPath } = layer;
      const url = `${apiBase}${urlPath === '/' ? '' : urlPath}`;

      let test;
      if (method === 'GET' || method === 'DELETE') {
        test = `
it('should be able to ...', async () => {
  const response = await request('${method}', \`${url}\`, {}, {});
  expect(response.status).toBe(200);
});
        `.trim();
      } else if (method === 'POST' || method === 'PATCH') {
        test = `
it('should be able to ...', async () => {
  const response = await request('${method}', \`${url}\`, {
    // ...fields
  }, {});
  expect(response.status).toBe(200);
});
  `.trim();
      }
      if (test) {
        const block = `
describe('${method} ${url}', () => {
  ${indent(test, 2)}
});
        `.trimEnd();
        describes.push(indent(block, 1));
      }
    }
  }
  const source = `
const { request } = require('../../utils/testing');

describe('/1/${routerName}', () => {
  ${describes.join('\n')}
});
  `;
  await fs.writeFile(getOutputFile(routerDir, routerName), source, 'utf8');
}

function parseRouterPath(str) {
  const parsed = path.parse(str);
  if (parsed.name === 'index') {
    return parseRouterPath(path.dirname(str));
  }
  return {
    ...parsed,
    base: getApiBase(parsed),
  };
}

function getApiBase(parsed) {
  const match = parsed.dir.match(/routes\/(.+)$/);
  if (match) {
    return `/1/${match[1]}/${parsed.name}`;
  } else {
    return `/1/${parsed.name}`;
  }
}

function getOutputFile(dir, name) {
  return path.join(process.cwd(), dir, '__tests__', `${name}.js`);
}
