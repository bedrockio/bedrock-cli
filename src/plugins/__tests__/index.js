import {
  fetchPluginList,
  installPackageJsonDependencies,
  installServiceEnv,
  installApiRoutes,
  getAllFiles,
  copyFiles,
  summarizePlugin,
} from '../index';
import tmp from 'tmp';
import fs from 'fs';

jest.unmock('node-fetch');

describe('plugins', () => {
  it('fetchPluginList', async () => {
    const result = await fetchPluginList();
    expect(result.length >= 1).toBe(true);
    expect(result[0].name).toBe('Bedrock Analytics');
  });

  it('installPackageJsonDependencies', async () => {
    const dir = tmp.dirSync().name;
    fs.writeFileSync(
      dir + '/package.json',
      JSON.stringify({ dependencies: {} })
    );
    await installPackageJsonDependencies(dir, '/package.json', {
      '@elastic/elasticsearch': '^7.5.0',
    });
    const result = JSON.parse(
      fs.readFileSync(dir + '/package.json').toString()
    );
    expect(result).toEqual({
      dependencies: {
        '@elastic/elasticsearch': '^7.5.0',
      },
    });
  });

  it('installServiceEnv', async () => {
    const dir = tmp.dirSync().name;
    fs.writeFileSync(
      dir + '/env.conf',
      `
# Core Config
NODE_ENV=dev\n\n`
    );
    await installServiceEnv(
      dir,
      '/env.conf',
      {
        ELASTICSEARCH_URI: 'http://localhost:9200',
      },
      { name: 'Analytics' }
    );
    const result = fs.readFileSync(dir + '/env.conf').toString();
    expect(result).toEqual(`
# Core Config
NODE_ENV=dev\n\n
# Analytics
ELASTICSEARCH_URI=http://localhost:9200
`);
  });

  it('installApiRoutes', async () => {
    const dir = tmp.dirSync().name;
    fs.writeFileSync(
      dir + '/routes.js',
      `

const status = require('./status');
router.use('/status', status.routes());

module.exports = router;

`
    );
    await installApiRoutes(dir, '/routes.js', [
      {
        name: 'analytics',
        path: '/services/api/src/v1/analytics.js',
      },
    ]);
    const result = fs.readFileSync(dir + '/routes.js').toString();
    expect(result).toEqual(`

const status = require('./status');
router.use('/status', status.routes());

const analytics = require('./analytics');
router.use('/analytics', analytics.routes());

module.exports = router;

`);
  });

  it('getAllFiles', async () => {
    const dir = tmp.dirSync().name;
    fs.writeFileSync(dir + '/routes.js', `test`);
    fs.mkdirSync(dir + '/scripts');
    fs.writeFileSync(dir + '/scripts/jobs.js', `test`);
    const result = await getAllFiles(dir);
    const expectedResult = [`${dir}/routes.js`, `${dir}/scripts/jobs.js`];
    expect(result).toEqual(expectedResult);
  });

  it('copyFiles', async () => {
    const dir = tmp.dirSync().name;
    fs.writeFileSync(dir + '/routes.js', `test`);
    fs.mkdirSync(dir + '/scripts');
    fs.writeFileSync(dir + '/scripts/jobs.js', `test`);
    const result = await getAllFiles(dir);
    const expectedResult = [`${dir}/routes.js`, `${dir}/scripts/jobs.js`];
    expect(result).toEqual(expectedResult);

    const dir2 = tmp.dirSync().name;
    await copyFiles(dir, dir2);

    const result2 = await getAllFiles(dir2);
    const expectedResult2 = [`${dir2}/routes.js`, `${dir2}/scripts/jobs.js`];
    expect(result2).toEqual(expectedResult2);
  });

  it('summarizePlugin', async () => {
    const lines = await summarizePlugin(
      __dirname + '/../__fixtures__/plugins/analytics'
    );
    expect(lines.length).toBe(11);
  });
});
