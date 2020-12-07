import path from 'path';
import kleur from 'kleur';
import open from 'open';
import { assertBedrockRoot } from '../util/dir';
import { exec, execSyncInherit } from '../util/shell';
import { prompt } from '../util/prompt';
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
  console.info(annotations);
}

export async function provision(options) {
  const { environment, terraform } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  await checkGCloudProject(config.gcloud);

  await provisionTerraform(environment, terraform, config.gcloud);
}

export async function shell(options) {
  const { environment, service, subservice } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  await checkConfig(environment, config);

  const podsJSON = await exec(`kubectl get pods -o jsonpath='{.items}' --ignore-not-found`);
  if (!podsJSON) {
    console.info(kleur.yellow(`No running pods`));
    process.exit(0);
  }
  const pods = JSON.parse(podsJSON.slice(1, -1));

  let deployment = 'api-cli-deployment';
  if (service) {
    deployment = getDeployment(service, subservice);
  }

  const filteredPods = pods.filter((pod) => pod.metadata.name.startsWith(deployment));

  if (!filteredPods.length) {
    console.info(kleur.yellow(`No running pods for deployment "${deployment}"`));
    process.exit(0);
  }

  const podName = filteredPods[0].metadata.name;
  console.info(kleur.green(`=> Starting bash for pod: "${podName}"`));

  const { spawn } = require('child_process');

  const child = spawn('kubectl', ['exec', '-it', podName, '--', 'bash'], {
    stdio: 'inherit',
  });

  child.on('exit', function (code) {
    console.info(kleur.green(`Finished bash for pod: "${podName}" (exit code: ${code})`));
  });
}

export async function logs(options) {
  const { environment, service, subservice } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  await checkConfig(environment, config);
  const { project, computeZone, kubernetes, label } = config.gcloud;

  let labelName = service;
  if (subservice) labelName += `-${subservice}`;
  const podLabel = label || 'app';

  const query = `resource.type="k8s_container"\nresource.labels.project_id="${project}"\nresource.labels.location="${computeZone}"\nresource.labels.cluster_name="${kubernetes.clusterName}"\nresource.labels.namespace_name="default"\nlabels.k8s-pod/${podLabel}="${labelName}"`;

  const params = new URLSearchParams({ query });

  const url = `https://console.cloud.google.com/logs/query;${params.toString()}?project=${project}`;
  console.info(kleur.green(`=> Opening Logs in GCloud UI`));
  console.info(url);
  let confirmed = await prompt({
    type: 'confirm',
    name: 'open',
    message: 'Open URL in browser?',
    initial: true,
  });
  if (!confirmed) process.exit(0);
  await open(url);
}
