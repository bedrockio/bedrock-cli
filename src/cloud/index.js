import path from 'path';
import kleur from 'kleur';
import { assertBedrockRoot } from '../util/dir';
import { exec } from '../util/shell';
import { prompt } from '../util/prompt';
import { getConfig, setGCloudConfig, checkConfig, checkGCloudProject } from './authorize';
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
    console.info(kleur.yellow(`Deployment "${deployment}" could not be found`));
    process.exit(0);
  }
  const deploymentInfo = JSON.parse(deploymentInfoJSON.slice(1, -1));
  const { annotations } = deploymentInfo.spec.template.metadata;
  console.info(`Deployment "${deployment}" annotations:`);
  console.log(annotations);
}

async function plan(options, planFile) {
  const { project, computeZone, kubernetes, bucketPrefix, envName } = options;
  // computeZone example: us-east1-c
  const region = computeZone.slice(0, -2); // e.g. us-east1
  const zone = computeZone.slice(-1); // e.g. c
  const { clusterName, nodePoolCount, minNodeCount, maxNodeCount, machineType } = kubernetes;
  const execSync = require('child_process').execSync;
  console.info(
    await execSync(
      `terraform plan -var "project=${project}" -var "environment=${envName}" -var "cluster_name=${clusterName}" -var "bucket_prefix=${bucketPrefix}" -var "region=${region}" -var "zone=${zone}" -var "node_pool_count=${nodePoolCount}" -var "min_node_count=${minNodeCount}" -var "max_node_count=${maxNodeCount}" -var "machine_type=${machineType}" -out="${planFile}"`,
      { encoding: 'utf-8' }
    )
  );
}

export async function provision(options) {
  const { environment, terraform } = options;
  if (!devMode) assertBedrockRoot();

  const config = await getConfig(environment);
  const { gcloud } = config;
  const { project, computeZone, envName, bucketPrefix } = gcloud;
  await checkGCloudProject(project);
  const region = computeZone.slice(0, -2);

  const planFile = await exec('mktemp');
  console.info(`planFile: ${planFile}`);

  if (terraform == 'init') {
    const terraformBucket = `${bucketPrefix}-terraform-system-state`;
    console.info(kleur.green(`Terraform bucket: ${terraformBucket}`));
    try {
      await exec(`gsutil ls gs://${terraformBucket}`);
    } catch (e) {
      if (e.message.includes('BucketNotFoundException')) {
        console.info(kleur.yellow(`${terraformBucket} does not exist. Creating now...`));
        await exec(`gsutil mb -l ${region} gs://${terraformBucket}`);
      }
    }
    process.chdir(path.resolve('deployment', 'environments', environment, 'provisioning'));
    console.info('Initialization can take several minutes...');
    let command = `terraform init -backend-config="bucket=${terraformBucket}" -backend-config="prefix=${envName}"`;
    console.info(command);
    const execSync = require('child_process').execSync;
    console.info(await execSync(command, { encoding: 'utf-8' }));
  } else if (terraform == 'plan') {
    process.chdir(path.resolve('deployment', 'environments', environment, 'provisioning'));
    await plan(gcloud, planFile);
  }
}
