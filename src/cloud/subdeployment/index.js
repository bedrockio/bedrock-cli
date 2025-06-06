import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';
import { get } from 'lodash-es';
import { green, gray, yellow } from 'kleur/colors';

import { exit } from '../../utils/flow.js';
import { prompt } from '../../utils/prompt.js';
import { assertBedrockRoot } from '../../utils/dir.js';
import { validateSimpleName } from '../../utils/validation.js';
import { readServiceYaml, writeServiceYaml, getServiceFilePath, getDeployment, checkService } from '../utils.js';
import { execSyncInherit } from '../../utils/shell.js';
import { getBranch } from '../../utils/git.js';
import { checkConfig } from '../authorize.js';

const TAG_REG = /(:\w+)?$/;
const DOMAIN_REG = /^https?:\/\/([^/]+)/;
const INGRESS_REQUIRED_VERSION = 'networking.k8s.io/v1';

export async function create(options) {
  await assertBedrockRoot();
  await checkConfig(options);
  await checkService(options);

  if (options.name) {
    const err = validateSimpleName(options.name);
    if (typeof err === 'string') {
      exit(err);
    }
  } else {
    options.name = await prompt({
      type: 'text',
      message: 'Subdeployment simple name (one word or hyphenated):',
      validate: validateSimpleName,
    });
  }

  options.subdeployment = options.name;

  const { name, environment, service, subservice } = options;

  const deployFile = `${service}-deployment.yml`;
  const deployment = readServiceYaml(environment, deployFile);
  updateDeployment(deployment, options);

  if (!options.domain) {
    exit(`Could not derive the domain from ${deployFile}.`);
  }
  if (!options.port) {
    exit(`Could not derive the service port from ${deployFile}.`);
  }

  const newDeployment = getDeployment(options);
  writeServiceYaml(environment, `${newDeployment}.yml`, deployment);

  if (!subservice) {
    await patchIngress(options);
  }

  console.info(`
  ${green(`Subdeployment "${name}" created successfully.`)}

  This subdeployment can now be deployed with the command:

  ${gray(`bedrock cloud deploy ${environment} ${service} --subdeployment=${name}`)}

  Deploying from a branch of the same name will also optionally allow
  you to run this command.
  ${yellow(`
  Note that the patched ingress will not apply until the deployment
  first completes successfully.

  The patched ingress may also take some time to apply (~10m). During
  this time you may see 404 errors.
 `)}
  `);
}

function updateDeployment(deployment, options) {
  const { name, service, subservice } = options;
  const containers = get(deployment, 'spec.template.spec.containers') || [];

  for (let container of containers) {
    // Set up image tag pull
    container.image = container.image.replace(TAG_REG, `:${name}`);

    // Derive the target service port
    for (let p of container.ports) {
      if (p.name === 'http-server') {
        options.port = p.containerPort;
      }
    }

    // Derive domain from APP_URL
    for (let env of container.env) {
      if (env.name === 'APP_URL') {
        if (!options.domain) {
          try {
            const split = env.value.match(DOMAIN_REG)[1].split('.');
            if (service === 'web' && split.length < 3) {
              split.unshift(name);
            } else {
              split.unshift(`${name}-${service}`);
            }
            options.domain = split.join('.');
          } catch {
            exit(`Could not derive domain for ${service}. Please pass as an option.`);
          }
        }
      }
    }

    const { domain } = options;
    const [sub, ...rest] = domain.split('.');

    let appDomain;
    let apiDomain;

    if (service === 'web') {
      appDomain = options.domain;
      apiDomain = [`${sub}-api`, ...rest].join('.');
    } else if (service === 'api') {
      apiDomain = options.domain;
      appDomain = [sub.replace(/-api/, ''), ...rest].join('.');
    }

    for (let env of container.env) {
      if (env.name === 'APP_URL') {
        env.value = `https://${appDomain}`;
      } else if (env.name === 'API_URL') {
        env.value = `https://${apiDomain}`;
      }
    }
  }

  const app = [name, service, subservice].filter((p) => p).join('-');

  deployment.metadata.name = `${app}-deployment`;
  deployment.spec.selector.matchLabels.app = app;
  deployment.spec.template.metadata.labels.app = app;
}

async function applyServiceFile(filename, options) {
  const { environment } = options;
  const filePath = getServiceFilePath(environment, filename);
  await runCommand(`kubectl apply -f ${filePath}`);
}

async function runCommand(command) {
  console.info(gray(command));
  await execSyncInherit(command);
}

async function patchIngress(options) {
  const { environment, service } = options;
  const filename = `${service}-ingress.yml`;
  let ingress = readServiceYaml(environment, filename);
  let docs;
  if (Array.isArray(ingress)) {
    docs = ingress;
    ingress = ingress.find((doc) => {
      return doc.kind === 'Ingress';
    });
  } else {
    docs = [ingress];
  }
  if (!ingress) {
    ingress = readYamlTemplate(path.resolve(__dirname, './ingress.yml'), options);
    docs.unshift(ingress);
  }
  if (ingress.apiVersion !== INGRESS_REQUIRED_VERSION) {
    exit(`Cannot patch ingress as required version is "${INGRESS_REQUIRED_VERSION}".`);
  }

  addIngressRule(ingress, options);
  addNodePort(docs, options);
  writeServiceYaml(environment, filename, docs);
  await applyServiceFile(filename, options);
}

function addIngressRule(ingress, options) {
  const { domain } = options;
  const rules = ingress.spec.rules || [];
  const exists = rules.some((rule) => {
    return rule.host === domain;
  });
  if (!exists) {
    ingress.spec.rules = [...rules, readYamlTemplate(path.resolve(__dirname, './rule.yml'), options)];
  }
}

function addNodePort(docs, options) {
  const app = `${options.name}-${options.service}`;
  const exists = docs.find((doc) => {
    return doc.kind === 'Service' && doc.spec.selector.app === app;
  });
  if (!exists) {
    docs.push(readYamlTemplate(path.resolve(__dirname, './nodeport.yml'), options));
  }
}

export async function destroy(options) {
  await assertBedrockRoot();
  await checkConfig(options);
  await checkService(options);

  if (!options.name) {
    const branch = await getBranch();
    if (branch !== 'master' && branch !== 'main') {
      if (
        await prompt({
          type: 'confirm',
          message: `Would you like to delete subdeployment "${branch}"?`,
        })
      ) {
        options.name = branch;
      }
    }
    if (!options.name) {
      exit(`"name" must be provided. It should match the format as created.`);
    }
  }

  const { name, service, environment } = options;
  const deployment = `${name}-${service}-deployment`;
  const deploymentFile = `${deployment}.yml`;
  const servicesPath = path.join('deployment', 'environments', environment, 'services');
  try {
    fs.unlinkSync(path.resolve(servicesPath, deploymentFile));
  } catch {
    exit(`Could not find ${deploymentFile}. Check ${servicesPath} for ${deploymentFile}.`);
  }
  await runCommand(`kubectl delete deployments/${name}-${service}-deployment`);
}

function readYamlTemplate(filePath, vars = {}) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/{{(\w+)}}/g, (all, name) => {
    if (name in vars) {
      return vars[name];
    } else {
      throw new Error(`Could not find "${name}" in template.`);
    }
  });
  return yaml.load(content);
}
