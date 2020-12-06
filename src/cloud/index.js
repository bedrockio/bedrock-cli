import path from 'path';
import kleur from 'kleur';
import { assertBedrockRoot } from '../util/dir';
import { exec } from '../util/shell';
import { prompt } from '../util/prompt';
import { getConfig, setGCloudConfig, checkConfig } from './authorize';
import { buildImage } from './build';
import { dockerPush } from './push';
import { rolloutDeployment, getDeployment } from './rollout';

const devMode = true;

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
  await checkConfig(environment, config);

  const ingress = await exec('kubectl get ingress');
  if (ingress) console.info(ingress, '\n');

  console.info(await exec('kubectl get services'), '\n');
  console.info(await exec('kubectl get nodes'), '\n');
  console.info(await exec('kubectl get pods'));
}

export async function build(options) {
  const { service, subservice, tag } = options;
  if (!devMode) await assertBedrockRoot();

  const platformName = getPlatformName();

  await buildImage(platformName, service, subservice, tag);
}

export async function push(options) {
  const { environment, service, subservice, tag } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  await checkConfig(environment, config);
  const { project } = config.gcloud;
  const platformName = getPlatformName();

  await dockerPush(project, platformName, service, subservice, tag);
}

export async function rollout(options) {
  const { environment, service, subservice } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  await checkConfig(environment, config);

  await rolloutDeployment(environment, service, subservice);
}

async function warn(environment) {
  if (environment == 'production') {
    console.info(kleur.yellow('---------------------------------------------------------\n'));
    console.info(kleur.yellow('                 Deploying to production!                \n'));
    console.info(kleur.yellow('---------------------------------------------------------\n'));
    const confirmed = await prompt({
      type: 'confirm',
      name: 'deploy',
      message: 'Are you sure?',
    });
    if (!confirmed) process.exit(0);
  }
}

export async function deploy(options) {
  const { environment, service, subservice, tag } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  await checkConfig(environment, config);
  const { project } = config.gcloud;
  const platformName = getPlatformName();

  await warn(environment);

  await buildImage(platformName, service, subservice, tag);
  await dockerPush(project, platformName, service, subservice, tag);
  await rolloutDeployment(environment, service, subservice);
}

export async function info(options) {
  const { environment, service, subservice } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  await checkConfig(environment, config);

  const deployment = getDeployment(service, subservice);

  const deploymentInfoJSON = await exec(
    `kubectl get deployment ${deployment} -o jsonpath='{@}' --ignore-not-found`
  );
  if (!deploymentInfoJSON) {
    console.info(`Deployment "${deployment}" could not be found`);
    process.exit(0);
  }
  const deploymentInfo = JSON.parse(deploymentInfoJSON.slice(1, -1));
  const { annotations } = deploymentInfo.spec.template.metadata;
  console.info(`Deployment "${deployment}" annotations:`);
  console.log(annotations);
}
