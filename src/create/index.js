import { randomBytes } from 'crypto';

import { yellow } from 'kleur/colors';
import { kebabCase, snakeCase, startCase } from 'lodash-es';

import { cloneRepository, initializeRepository } from '../utils/git.js';
import { queueTask, runTasks } from '../utils/tasks.js';
import { removeFiles } from '../utils/file.js';
import { replaceAll } from '../utils/replace.js';
import { exec, withDir } from '../utils/shell.js';
import { exit } from '../utils/flow.js';
import { getEnvironments, updateServiceYamlEnv } from '../cloud/utils.js';

const BEDROCK_REPO = 'bedrockio/bedrock-core';

export default async function create(options) {
  let {
    project,
    domain,
    repository,
    address,
    staging: stagingId,
    production: productionId,
    password: adminPassword,
  } = options;

  if (!domain) {
    exit('Domain required.');
  }
  // "project" will accept any casing
  const kebab = kebabCase(project);
  const under = snakeCase(project);

  repository ||= kebab;
  stagingId ||= `${kebab}-staging`;
  productionId ||= `${kebab}-production`;

  queueTask('Clone Repository', async () => {
    await cloneRepository(kebab, BEDROCK_REPO);
    process.chdir(kebab);
  });

  queueTask('Configure', async () => {
    const appName = startCase(project);

    const JWT_SECRET = await exec('openssl rand -base64 30');
    const ADMIN_PASSWORD = adminPassword || randomBytes(8).toString('hex');

    await replaceAll('**/*.{js,md,yml,tf,conf,json,env}', (str, basename) => {
      if (basename !== '.env') {
        str = str.replace(/ADMIN_PASSWORD=(.+)/g, `ADMIN_PASSWORD=${ADMIN_PASSWORD}`);
      }

      str = str.replace(/APP_COMPANY_ADDRESS=(.+)/g, `APP_COMPANY_ADDRESS=${address}`);
      str = str.replace(/JWT_SECRET=(.+)/g, `JWT_SECRET=${JWT_SECRET}`);
      str = str.replace(/bedrock-foundation-production/g, productionId);
      str = str.replace(/bedrock-foundation-staging/g, stagingId);
      str = str.replace(/bedrockio\/bedrock-core/g, repository);
      str = str.replace(/bedrock-foundation/g, kebab);
      str = str.replace(/bedrock\.foundation/g, domain);
      str = str.replace(/bedrock-core-services/g, `${kebab}-services`);
      str = str.replace(/Bedrock (Staging|Production)/g, `${appName} $1`);
      str = str.replace(/bedrock_(dev|staging|production)/g, `${under}_$1`);
      str = str.replace(/bedrock-(web|api|dev|staging|production)/g, `${kebab}-$1`);
      str = str.replace(/\bBedrock\b/g, appName);
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
  });

  queueTask('Install Dependencies', async () => {
    queueTask('API', async () => {
      await withDir('services/api', async () => {
        await exec('volta run yarn install');
      });
    });

    queueTask('Web', async () => {
      await withDir('services/web', async () => {
        await exec('volta run yarn install');
      });
    });
  });

  queueTask('Finalizing', async () => {
    await initializeRepository(kebab, repository);
  });

  await runTasks();

  console.info(
    yellow(`
  Installation Completed!
  New Bedrock project has been created:

  cd ./${kebab}

  To run the stack with Docker:

  docker-compose up

  To prepare for deployment:

  - Create a new project in Google Cloud named ${kebab}
  - Install Terraform (https://developer.hashicorp.com/terraform/downloads)
  - Install Google Cloud SDK (https://cloud.google.com/sdk/docs/install)
  - Run \`bedrock cloud bootstrap\`
  `),
  );
}
