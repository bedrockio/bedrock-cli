import path from 'path';
import kleur from 'kleur';
import { kebabCase, snakeCase, startCase } from 'lodash';
import { cloneRepository, initializeRepository } from '../util/git';
import { removeFiles } from '../util/file';
import { replaceAll } from '../util/replace';
import { exec, withDir } from '../util/shell';
import Listr from 'listr';
import { randomBytes } from 'crypto';
import { getEnvironments, updateServiceYamlEnv } from '../cloud/utils';

const BEDROCK_REPO = 'bedrockio/bedrock-core';

const COMPLETE_MESSAGE = `
  Installation Completed!

  New Bedrock project has been created. To run the stack in Docker:

  docker-compose up
`;

export default async function create(options) {
  const { project, domain = '', repository = '', address = '', 'admin-password': adminPassword = '' } = options;

  if (!project) {
    throw new Error('Project name required');
  }

  // "project" will accept any casing
  const kebab = kebabCase(project);
  const under = snakeCase(project);

  const tasks = new Listr([
    {
      title: 'Clone Repository',
      task: async () => {
        await cloneRepository(kebab, BEDROCK_REPO);
        process.chdir(kebab);
      },
    },
    {
      title: 'Configure',
      task: async () => {
        const appName = startCase(project);
        const JWT_SECRET = await exec('openssl rand -base64 30');
        const ADMIN_PASSWORD = adminPassword || randomBytes(8).toString('hex');

        await replaceAll(`*.{js,md,yml,tf,conf,json}`, (str) => {
          str = str.replace(/APP_COMPANY_ADDRESS=(.+)/g, `APP_COMPANY_ADDRESS=${address}`);
          str = str.replace(/JWT_SECRET=(.+)/g, `JWT_SECRET=${JWT_SECRET}`);
          str = str.replace(/ADMIN_PASSWORD=(.+)/g, `ADMIN_PASSWORD=${ADMIN_PASSWORD}`);
          str = str.replace(/bedrockio\/bedrock-core/g, repository);
          str = str.replace(/bedrock-foundation/g, kebab);
          str = str.replace(/bedrock\.foundation/g, domain);
          str = str.replace(/bedrock-core-services/g, `${kebab}-services`);
          str = str.replace(/Bedrock (Staging|Production)/g, `${appName} $1`);
          str = str.replace(/bedrock_(dev|staging|production)/g, `${under}_$1`);
          str = str.replace(/bedrock-(web|api|dev|staging|production)/g, `${kebab}-$1`);
          str = str.replace(/\bBedrock\b/g, appName);
          str = str.replace(/\bbedrock\b/g, kebab);
          return str;
        });

        const environments = await getEnvironments();
        for (let environment of environments) {
          const secret = await exec('openssl rand -base64 30');
          const password = adminPassword || randomBytes(8).toString('hex');
          updateServiceYamlEnv(environment, 'api', 'JWT_SECRET', secret);
          updateServiceYamlEnv(environment, 'api', 'ADMIN_PASSWORD', password);
        }

        await removeFiles('CONTRIBUTING.md');
        await removeFiles('LICENSE');
        await removeFiles('.git');
      },
    },
    {
      title: 'Install Dependencies',
      task: async () => {
        await withDir(path.resolve('services', 'api'), async () => {
          await exec('yarn install');
        });

        await withDir(path.resolve('services', 'web'), async () => {
          await exec('yarn install');
        });
      },
    },
    {
      title: 'Finalizing',
      task: async () => {
        await initializeRepository(kebab, repository);
      },
    },
  ]);
  try {
    await tasks.run();
    console.log(kleur.yellow(COMPLETE_MESSAGE));
  } catch (err) {
    process.exit(1);
  }
}
