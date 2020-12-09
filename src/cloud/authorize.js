import fs from 'fs';
import path from 'path';
import kleur from 'kleur';
import { exit } from '../util/exit';
import { exec } from '../util/shell';
import { readFile } from '../util/file';

export async function getConfig(environment) {
  const configFilePath = path.resolve('deployment', 'environments', environment, 'config.json');
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

export async function setGCloudConfig(options = {}) {
  const { project, computeZone, kubernetes } = options;
  if (!kubernetes) exit('Missing kubernetes settings in config');
  try {
    // gcloud returns output on stderr
    if (!project) exit('Missing project');
    console.info(await exec(`gcloud config set project ${project}`, 'stderr'));

    if (!computeZone) exit('Missing computeZone');
    console.info(await exec(`gcloud config set compute/zone ${computeZone}`, 'stderr'));

    const { clusterName } = kubernetes;
    if (!clusterName) exit('Missing kubernetes.clusterName');

    console.info(await exec(`gcloud container clusters get-credentials ${clusterName}`, 'stderr'));
    console.info(await exec(`gcloud config set container/cluster ${clusterName}`, 'stderr'));
  } catch (e) {
    exit(e.message);
  }
}

export async function checkGCloudProject(options = {}) {
  const { project } = options;
  if (!project) exit('Missing project');
  const currentProject = await exec('gcloud config get-value project');
  if (project != currentProject) {
    console.info(
      kleur.red(`Invalid Google Cloud config (use authorize script): project = ${currentProject}`)
    );
    return false;
  }
  return true;
}

function getKubectlContext(project, computeZone, clusterName) {
  return `gke_${project}_${computeZone}_${clusterName}`;
}

async function getCurrentKubectlContext() {
  const kubectlConfigJSON = await exec('kubectl config view -o json');
  const kubectlConfig = JSON.parse(kubectlConfigJSON);
  return kubectlConfig['current-context']; // e.g. 'gke_bedrock-foundation_us-east1-c_cluster-2'
}

async function checkGCloudConfig(environment, options = {}) {
  const { project, computeZone, kubernetes } = options;
  if (!kubernetes) exit('Missing kubernetes settings in config');
  try {
    let valid = checkGCloudProject(options);

    if (!computeZone) exit('Missing computeZone');
    const currentComputeZone = await exec('gcloud config get-value compute/zone');
    if (computeZone != currentComputeZone) {
      valid = false;
      console.info(
        kleur.red(
          `Invalid Google Cloud config (use authorize script): compute/zone = ${currentComputeZone}`
        )
      );
    }

    const { clusterName } = kubernetes;
    if (!clusterName) exit('Missing kubernetes.clusterName');
    const currentClusterName = await exec('gcloud config get-value container/cluster');
    if (clusterName != currentClusterName) {
      valid = false;
      console.info(
        kleur.red(
          `Invalid Google Cloud config (use authorize script): container/cluster = ${currentClusterName}`
        )
      );
    }

    const kubectlContext = getKubectlContext(project, computeZone, clusterName);
    const currentkubectlContext = await getCurrentKubectlContext();
    if (kubectlContext != currentkubectlContext) {
      valid = false;
      console.info(
        kleur.red(
          `Invalid Google Cloud config (use authorize script): kubectl context = ${currentkubectlContext}`
        )
      );
    }

    if (valid) {
      console.info(
        kleur.green(
          `Using Google Cloud environment ${environment} (project=${project}, compute/zone=${computeZone}, cluster=${clusterName}, kubectl/context=${currentkubectlContext})`
        )
      );
    }

    // TODO: add optional fallback to authorize current values

    return valid;
  } catch (e) {
    exit(e.message);
  }
}

async function checkSecrets(environment) {
  const secretsDir = path.resolve('deployment', 'environments', environment, 'secrets');
  if (fs.existsSync(secretsDir)) {
    const secretFiles = await exec(`ls ${secretsDir}`);
    if (secretFiles) {
      console.info(kleur.red('---'));
      console.info(kleur.red('---'));
      console.info(
        kleur.red(
          `--- Warning: Found files in deployment/environments/${environment}/secrets/ - make sure to remove these!`
        )
      );
      console.info(kleur.red('---'));
      console.info(kleur.red('---'));
    }
  }
}

export async function checkConfig(environment, config) {
  if (!config) exit('Missing config');
  if (!config.gcloud) exit('Missing gcloud field in config');
  await checkSecrets(environment);
  const valid = await checkGCloudConfig(environment, config.gcloud);
  if (!valid) process.exit(1);
}
