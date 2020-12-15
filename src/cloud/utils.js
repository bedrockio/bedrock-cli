import fs from 'fs';
import path from 'path';
import compareVersions from 'compare-versions';
import { red } from 'kleur';
import { prompt } from '../util/prompt';
import { exit } from '../util/exit';
import { exec } from '../util/shell';

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

export async function getServicesPrompt() {
  const services = getServices();
  return await prompt({
    type: 'multiselect',
    hint: '- Space or arrow-keys to select. Press "a" to select all. Return to submit.',
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
      value.replace(/[^a-z0-9_-]/gim, '') != value
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
