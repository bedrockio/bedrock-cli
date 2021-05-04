import fs from 'fs';
import path from 'path';
import compareVersions from 'compare-versions';
const yaml = require('js-yaml');
import { red } from 'kleur';
import { prompt } from '../util/prompt';
import { exit } from '../util/exit';
import { exec } from '../util/shell';

function getConfigFilePath(environment) {
  return path.resolve('deployment', 'environments', environment, 'config.json');
}

export function readConfig(environment) {
  const configFilePath = getConfigFilePath(environment);
  try {
    return require(configFilePath);
  } catch (e) {
    exit(`Could not find config.json for environment: "${environment}", file path: "${configFilePath}"`);
  }
}

export function writeConfig(environment, config) {
  const configFilePath = getConfigFilePath(environment);
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    exit(`Could not write to config.json for environment: "${environment}", file path: "${configFilePath}"`);
  }
}

export function getServiceFilePath(environment, filename) {
  return path.resolve('deployment', 'environments', environment, 'services', filename);
}

export function readServiceYaml(environment, filename) {
  const filePath = exports.getServiceFilePath(environment, filename);
  return yaml.safeLoad(fs.readFileSync(filePath, 'utf8'));
}

export function writeServiceYaml(environment, filename, data) {
  const filePath = exports.getServiceFilePath(environment, filename);
  const options = {
    quotingType: '"',
    forceQuotes: true,
  };
  const yamlString = yaml.safeDump(data, options);
  return fs.writeFileSync(filePath, yamlString, 'utf8');
}

export async function updateServiceYamlEnv(environment, service, envName, envValue) {
  const filename = `${service}-deployment.yml`;
  const deployment = readServiceYaml(environment, filename);
  const { env } = deployment.spec.template.spec.containers[0];
  deployment.spec.template.spec.containers[0].env = env.map(({ name, value = '' }) =>
    name == envName ? { name, value: envValue || '' } : { name, value }
  );
  writeServiceYaml(environment, filename, deployment);
}

export function getPlatformName() {
  return path.basename(process.cwd());
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

export async function getEnvironmentPrompt() {
  return await prompt({
    type: 'select',
    message: 'Select environment:',
    choices: getEnvironments().map((value) => {
      return { title: value, value };
    }),
  });
}

function getServices() {
  const services = [];
  const servicesFolders = getDirectories('services');
  for (const serviceFolder of servicesFolders) {
    for (const file of fs.readdirSync(path.resolve('services', serviceFolder))) {
      if (file == 'Dockerfile') {
        services.push([serviceFolder.toString(), '']);
      } else if (file.startsWith('Dockerfile.')) {
        services.push([serviceFolder.toString(), file.toString().replace('Dockerfile.', '')]);
      }
    }
  }
  return services;
}

export async function getServicesPrompt(type = 'multiselect') {
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

export async function getTagPrompt() {
  return await prompt({
    type: 'text',
    message: 'Enter build tag:',
    initial: 'latest',
  });
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
  } catch (e) {
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
        `Error: Minimum required "kubectl" version is "${minVersion}", you have "${version}". On macos run "brew upgrade kubernetes-cli."`
      );
    }
  } catch (e) {
    console.error(e);
    exit('Error: failed to parse kubectl version');
  }
}

export async function getSlackWebhook(config) {
  if (config && config.slack && config.slack.webhook) return config.slack.webhook;
}
