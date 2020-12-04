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
