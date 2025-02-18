import fs from 'fs';

import os from 'os';
import path from 'path';

import yaml from 'js-yaml';
import compareVersions from 'compare-versions';
import { red, yellow, dim } from 'kleur/colors';

import { prompt } from '../utils/prompt.js';
import { exit, error } from '../utils/flow.js';
import { exec } from '../utils/shell.js';
import { getConfig } from '../utils/git.js';
import { loadJson } from '../utils/file.js';

export function getDeployment(options) {
  const { service, subservice, subdeployment } = options;
  let deployment = '';
  if (subdeployment) {
    deployment += `${subdeployment}-`;
  }
  deployment += service;
  if (subservice) {
    deployment += `-${subservice}`;
  }
  deployment += '-deployment';
  return deployment;
}

export async function readConfig(environment) {
  const configFilePath = getConfigFilePath(environment);
  try {
    return await loadJson(configFilePath);
  } catch {
    exit(`Could not find config.json for environment: "${environment}", file path: "${configFilePath}"`);
  }
}

export function writeConfig(environment, config) {
  const configFilePath = getConfigFilePath(environment);
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf8');
  } catch {
    exit(`Could not write to config.json for environment: "${environment}", file path: "${configFilePath}"`);
  }
}

export function getServiceFilePath(environment, filename) {
  return path.resolve('deployment', 'environments', environment, 'services', filename);
}

/**
 * @returns {any}
 */
export function readServiceYaml(environment, filename) {
  const filePath = getServiceFilePath(environment, filename);
  const content = fs.readFileSync(filePath, 'utf8');
  const data = content.split(/^---$/gm).map((str) => {
    return yaml.load(str);
  });
  if (data.length === 1) {
    return data[0];
  } else {
    return data;
  }
}

export function writeServiceYaml(environment, filename, docs) {
  if (!Array.isArray(docs)) {
    docs = [docs];
  }
  const output = docs
    .map((doc) => {
      return yaml.dump(doc, {
        quotingType: '"',
      });
    })
    .join('\n---\n');
  const filePath = getServiceFilePath(environment, filename);
  return fs.writeFileSync(filePath, output, 'utf8');
}

export async function updateServiceYamlEnv(environment, service, envName, envValue) {
  const filename = `${service}-deployment.yml`;
  const deployment = readServiceYaml(environment, filename);
  const { env } = deployment.spec.template.spec.containers[0];
  deployment.spec.template.spec.containers[0].env = env.map(({ name, value = '' }) =>
    name == envName ? { name, value: envValue || '' } : { name, value },
  );
  writeServiceYaml(environment, filename, deployment);
}

export async function checkPlatformName(options) {
  if (!options.platformName) {
    const platformName = path.basename(await getConfig('remote.origin.url'), '.git');
    if (!platformName) {
      console.info(yellow('Could not derive a platform name from the git config.'));
      console.info(yellow('A stable name needs to be derived before project can be deployed.'));
      console.info(yellow('Please initialize a git repo before proceeding.'));
      process.exit(1);
    }
    options.platformName = platformName;
  }
}

export async function checkServices(options) {
  if (options.service) {
    options.services = [[options.service, options.subservice]];
  } else {
    options.services = options.all ? getServices() : await getServicesPrompt();
    if (!options.services.length) {
      console.info(yellow('There were no services selected'));
      process.exit(1);
    }
  }
}

export async function checkService(options) {
  if (!options.service) {
    const [service, subservice] = await getServicesPrompt('select');
    options.service = service;
    options.subservice = subservice;
  }
}

function getDirectories(folder) {
  if (fs.existsSync(folder)) {
    return fs.readdirSync(folder).filter((file) => {
      const filePath = path.resolve(folder, file);
      return fs.lstatSync(filePath).isDirectory();
    });
  }
  return [];
}

export function getEnvironments() {
  return getDirectories(path.resolve('deployment', 'environments')).reverse();
}

export function getSecretsDirectory(environment) {
  return path.resolve('deployment', 'environments', environment, 'secrets');
}

export async function checkEnvironment(options) {
  const environments = getEnvironments();
  if (options.environment) {
    if (!environments.includes(options.environment)) {
      exit(`Cannot find environment "${options.environment}".`);
    }
  } else {
    options.environment = await prompt({
      type: 'select',
      message: 'Select environment:',
      choices: environments.map((value) => {
        return { title: value, value };
      }),
    });
  }
}

const KNOWN_BRANCHES = ['master', 'main', 'develop', 'development', 'staging', 'production'];

export async function checkSubdeployment(options) {
  if (!options.subdeployment) {
    const branch = await exec('git branch --show-current');
    if (!KNOWN_BRANCHES.includes(branch) && !branch.includes('/')) {
      if (
        await prompt({
          type: 'confirm',
          message: `You are currently on branch "${branch}". Would you like to deploy to ${branch} subdeployment instead? `,
        })
      ) {
        options.subdeployment = branch;
      } else {
        console.info(dim('Run "bedrock cloud subdeployment" for more about subdeployments.'));
      }
    }
  }
}

export function getServices() {
  const services = [];
  const servicesFolders = getDirectories('services');
  for (const serviceFolder of servicesFolders) {
    for (const file of fs.readdirSync(path.resolve('services', serviceFolder))) {
      if (file == 'Dockerfile') {
        services.push([serviceFolder.toString(), '']);
      } else if (file.startsWith('Dockerfile.') && !file.endsWith('.dev')) {
        services.push([serviceFolder.toString(), file.toString().replace('Dockerfile.', '')]);
      }
    }
  }
  return services;
}

function getConfigFilePath(environment) {
  return path.resolve('deployment', 'environments', environment, 'config.json');
}

async function getServicesPrompt(type = 'multiselect') {
  const services = getServices();
  return await prompt({
    type,
    ...(type == 'multiselect' && {
      hint: '- Space or arrow-keys to select. Press "a" to select all. Return to submit.',
    }),
    message: 'Select service / subservice:',
    instructions: false,
    choices: services.map(([service, subservice]) => {
      let title = service;
      if (subservice) title = `${service} / ${subservice}`;
      return { title, value: [service, subservice] };
    }),
  });
}

export async function checkTag(options) {
  if (!options.tag) {
    if (options.subdeployment) {
      options.tag = options.subdeployment;
    } else {
      options.tag = await prompt({
        type: 'text',
        message: 'Enter build tag:',
        initial: 'latest',
      });
    }
  }
}

export async function getTerraformPrompt() {
  const terraformCommands = ['init', 'plan', 'apply', 'destroy'];
  return await prompt({
    type: 'select',
    message: 'Select terraform command:',
    initial: 1,
    choices: terraformCommands.map((value) => {
      return { title: value, value };
    }),
  });
}

export async function getSecretSubCommandPrompt() {
  const secretCommands = ['get', 'set'];
  return await prompt({
    type: 'select',
    message: 'Select "get" or "set" secret:',
    choices: secretCommands.map((value) => {
      return { title: value, value };
    }),
  });
}

export async function getSecretNamePrompt() {
  return await prompt({
    type: 'text',
    message: 'Enter secret name:',
    initial: 'credentials',
    validate: (value) =>
      !value.match(/[^a-z0-9_-]/gim)
        ? `Name may contain only letters, numbers, dashes, or the underscore character.`
        : true,
  });
}

async function getAllSecrets() {
  const secretsJSON = await exec('kubectl get secret -o json --ignore-not-found');
  if (!secretsJSON) return [];
  try {
    const secrets = JSON.parse(secretsJSON);
    return secrets.items;
  } catch {
    console.info(red('Could not parse secrets'));
    return [];
  }
}

export async function getAllSecretsPrompt() {
  return await prompt({
    type: 'select',
    message: 'Select secret:',
    choices: (await getAllSecrets())
      .map(({ metadata }) => {
        if (!metadata || !metadata.name) return false;
        const { name } = metadata;
        return { title: name, value: name };
      })
      .filter(Boolean),
  });
}

export async function checkKubectlVersion(minVersion = 'v1.19.0') {
  try {
    const kubectlVersion = await exec('kubectl version --client -o json');
    const parsed = JSON.parse(kubectlVersion);
    const version = parsed.clientVersion.gitVersion;
    if (compareVersions.compare(minVersion, version, '>')) {
      exit(
        `Error: Minimum required "kubectl" version is "${minVersion}", you have "${version}". On macos run "brew upgrade kubernetes-cli."`,
      );
    }
  } catch (e) {
    error(e);
    exit('Error: failed to parse kubectl version');
  }
}

export async function getSlackWebhook(config) {
  if (config && config.slack && config.slack.webhook) {
    return config.slack.webhook;
  }
}

export function getArchitecture() {
  const arch = os.arch();

  // Node versions previous to 16 will be running in Rosetta which
  // reports "x64" as the architecture, so check CPUs directly.
  return arch === 'x64' && hasAppleCpus() ? 'arm64' : arch;
}

function hasAppleCpus() {
  return os.cpus().some((cpu) => {
    return cpu.model.includes('Apple');
  });
}
