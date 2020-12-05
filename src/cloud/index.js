import fs from 'fs';
import path from 'path';
import kleur from 'kleur';
import { assertBedrockRoot } from '../util/dir';
import { readFile } from '../util/file';
import { exec } from '../util/shell';
import { exit } from '../util/exit';
import { setGCloudConfig, checkGCloudConfig } from './authorize';
import { buildImage } from './build';
import { dockerPush } from './push';

const devMode = true;

async function getConfig(environment) {
  const configFilePath = path.resolve('deployment/environments', environment, 'config.json');
  let config = {};
  try {
    config = await readFile(configFilePath);
  } catch (e) {
    exit(
      `Could not find config.json for environment: "${environment}", file path: "${configFilePath}"`
    );
  }
  return config;
}

function getPlatformName() {
  return path.basename(process.cwd());
}

export async function authorize(options) {
  const { environment } = options;
  if (!devMode) await assertBedrockRoot();

  const config = await getConfig(environment);
  await setGCloudConfig(config.gcloud);
  console.info(kleur.green(`Successfully authorized ${environment}`));
}

export async function status(options) {
  const { environment } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  const valid = await checkGCloudConfig(environment, config.gcloud);
  if (!valid) exit('Invalid Google Cloud config');

  const ingress = await exec('kubectl get ingress');
  if (ingress) console.info(ingress, '\n');

  console.info(await exec('kubectl get services'), '\n');
  console.info(await exec('kubectl get nodes'), '\n');
  console.info(await exec('kubectl get pods'));
}

export async function build(options) {
  const { service, subservice, tag = 'latest' } = options;
  if (!devMode) await assertBedrockRoot();

  const platformName = getPlatformName();
  await buildImage(platformName, service, subservice, tag);
}

export async function push(options) {
  const { environment, service, subservice, tag = 'latest' } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  const valid = await checkGCloudConfig(environment, config.gcloud);
  if (!valid) exit('Invalid Google Cloud config');

  const platformName = getPlatformName();
  const { project } = config.gcloud;

  await dockerPush(project, platformName, service, subservice, tag);
}

async function getTag() {
  let tag = await exec('git tag --points-at HEAD');
  if (!tag) tag = await exec('git rev-parse --short --verify HEAD');
  const stat = await exec('git diff --stat');
  if (stat) tag += '-dirty';
  return tag;
}

async function getMetaData() {
  const author = await exec('git config user.name');
  const date = new Date().toUTCString();
  const branch = await exec('git branch --show-current');
  const git = await getTag();
  let fields = `\\"author\\":\\"${author}\\"`;
  fields += `,\\"date\\":\\"${date}\\"`;
  fields += `,\\"branch\\":\\"${branch}\\"`;
  fields += `,\\"git\\":\\"${git}\\"`;
  const metaData = `{\\"spec\\":{\\"template\\":{\\"metadata\\":{\\"annotations\\":{${fields}}}}}}`;
  return metaData;
}

async function rolloutDeployment(environment, service, subservice) {
  let deployment = service;
  if (subservice) deployment += `-${subservice}`;
  deployment += '-deployment';

  console.info(`Rolling out ${environment} ${deployment}`);

  const deploymentFile = path.resolve(
    'deployment',
    'environments',
    environment,
    'services',
    `${deployment}.yml`
  );

  // Check for config file as it might not exist if the
  // deployment was dynamically created for a feature branch.
  if (fs.existsSync(deploymentFile)) {
    const applyCommand = `kubectl apply -f ${deploymentFile} --record`;
    // console.info(applyCommand);
    console.info(await exec(applyCommand));
  }

  const metaData = await getMetaData();
  // Patching spec.template forces the container to pull the latest image and
  // perform a rolling update as long as imagePullPolicy: Always is specified.
  const patchCommand = `kubectl patch deployment ${deployment} -p "${metaData}" --record`;
  // console.info(patchCommand);
  // Note: exec does not work with escaped double quotes
  const execSync = require('child_process').execSync;
  console.info(execSync(patchCommand, { encoding: 'utf-8' }));
}

export async function rollout(options) {
  const { environment, service, subservice } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  const valid = await checkGCloudConfig(environment, config.gcloud);
  if (!valid) exit('Invalid Google Cloud config');

  await rolloutDeployment(environment, service, subservice);
}
