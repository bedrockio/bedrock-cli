import path from 'path';
import kleur from 'kleur';
import { assertBedrockRoot } from '../util/dir';
import { execSyncInherit } from '../util/shell';
import { getConfig, setGCloudConfig, checkConfig, checkGCloudProject } from './authorize';
import { buildImage } from './build';
import { dockerPush } from './push';
import { warn } from './deploy';
import { rolloutDeployment, getDeployment, deleteDeployment, checkDeployment } from './rollout';
import { provisionTerraform } from './provision';

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

  await execSyncInherit('kubectl get ingress');
  console.info('');
  await execSyncInherit('kubectl get services');
  console.info('');
  await execSyncInherit('kubectl get nodes');
  console.info('');
  await execSyncInherit('kubectl get pods');
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

export async function undeploy(options) {
  const { environment, service, subservice } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  await checkConfig(environment, config);
  await checkDeployment(service, subservice);

  await deleteDeployment(environment, service, subservice);
}

export async function info(options) {
  const { environment, service, subservice } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  await checkConfig(environment, config);
  const deployment = getDeployment(service, subservice);
  const deploymentInfo = await checkDeployment(service, subservice);
  const { annotations } = deploymentInfo.spec.template.metadata;
  console.info(`Deployment "${deployment}" annotations:`);
  console.log(annotations);
}

export async function provision(options) {
  const { environment, terraform } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  await checkGCloudProject(config.gcloud);

  await provisionTerraform(environment, terraform, config.gcloud);
}
