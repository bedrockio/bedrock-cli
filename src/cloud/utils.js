import fs from 'fs';
import path from 'path';
import compareVersions from 'compare-versions';
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

function getEnvironments() {
  return getDirectories(path.resolve('deployment', 'environments')).reverse();
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
