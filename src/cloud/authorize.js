import fs from 'fs';
import path from 'path';
import { red, green } from 'kleur';
import { exit } from '../util/exit';
import { exec, execSyncInherit } from '../util/shell';
import { prompt } from '../util/prompt';
import { getSecretInfo, setSecret } from './secret';
import { checkEnvironment, readConfig } from './utils';

async function setGCloudConfig(config = {}) {
  const { project, computeZone, kubernetes } = config;
  if (!kubernetes) exit('Missing kubernetes settings in config');
  try {
    // gcloud returns output on stderr
    if (!project) exit('Missing project');
    await execSyncInherit(`gcloud config set project ${project}`);

    if (!computeZone) exit('Missing computeZone');
    await execSyncInherit(`gcloud config set compute/zone ${computeZone}`);

    const { clusterName } = kubernetes;
    if (!clusterName) exit('Missing kubernetes.clusterName');

    try {
      await execSyncInherit(`gcloud container clusters get-credentials ${clusterName}`);
    } catch (e) {
      exit(e.message);
    }

    await execSyncInherit(`gcloud config set container/cluster ${clusterName}`);
    console.info(
      green(`Successfully authorized (project=${project}, compute/zone=${computeZone}, cluster=${clusterName})`)
    );
  } catch (e) {
    exit(e.message);
  }
}

export async function checkGCloudProject(config = {}) {
  const { project } = config;
  if (!project) exit('Missing project');
  const currentProject = await exec('gcloud config get-value project');
  if (project != currentProject) {
    console.info(red(`Invalid Google Cloud config: project = ${currentProject}`));
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

async function checkGCloudConfig(environment, config = {}, quiet) {
  const { project, computeZone, kubernetes } = config;
  if (!kubernetes) exit('Missing kubernetes settings in config');
  try {
    let valid = await checkGCloudProject(config);

    if (!computeZone) exit('Missing computeZone');
    const currentComputeZone = await exec('gcloud config get-value compute/zone');
    if (computeZone != currentComputeZone) {
      valid = false;
      console.info(red(`Invalid Google Cloud config: compute/zone = ${currentComputeZone}`));
    }

    const { clusterName } = kubernetes;
    if (!clusterName) exit('Missing kubernetes.clusterName');
    const currentClusterName = await exec('gcloud config get-value container/cluster');
    if (clusterName != currentClusterName) {
      valid = false;
      console.info(red(`Invalid Google Cloud config: container/cluster = ${currentClusterName}`));
    }

    const kubectlContext = getKubectlContext(project, computeZone, clusterName);
    const currentkubectlContext = await getCurrentKubectlContext();
    if (kubectlContext != currentkubectlContext) {
      valid = false;
      console.info(red(`Invalid Google Cloud config: kubectl context = ${currentkubectlContext}`));
    }

    if (valid && !quiet) {
      console.info(green(`Using Google Cloud environment "${environment}"`));
      console.info('project=' + green(project));
      console.info('compute/zone=' + green(computeZone));
      console.info('cluster=' + green(clusterName));
      console.info('kubectl/context=' + green(currentkubectlContext));
    }
    return valid;
  } catch (e) {
    exit(e.message);
  }
}

async function checkSecrets(environment) {
  const secretsDir = path.resolve('deployment', 'environments', environment, 'secrets');
  if (fs.existsSync(secretsDir)) {
    const secretFilesLS = await exec(`ls ${secretsDir}`);
    const secretFiles = secretFilesLS.split('\n').filter((file) => file.endsWith('.conf'));
    for (const secretFile of secretFiles) {
      const secretName = secretFile.slice(0, -5);
      const secretInfo = await getSecretInfo(secretName);
      if (!secretInfo) {
        console.info(
          red(
            `Warning: Found secret file deployment/environments/${environment}/secrets/${secretFile} that has not been created on the cluster.`
          )
        );
        let confirmed = await prompt({
          type: 'confirm',
          name: 'subcommand',
          message: `Would you like to create secret "${secretName}" now?`,
          initial: true,
        });
        if (confirmed) await setSecret(environment, secretName);
      } else {
        console.info(
          red(
            `Warning: Found secret file deployment/environments/${environment}/secrets/${secretFile} - make sure to remove this file!`
          )
        );
      }
    }
  }
}

// TODO: rename to something more understandable
export async function checkConfig(options) {
  await checkEnvironment(options);

  options.config = readConfig(options.environment);
  const { config, environment, force, quiet } = options;

  if (!config) exit('Missing config.');
  if (!config.gcloud) exit('Missing gcloud field in config.');

  const valid = await checkGCloudConfig(environment, config.gcloud, quiet || !force);
  if (!valid) {
    if (quiet) {
      // export command requires terminal to be quiet as it will stream back binary data
      // so simply error here instead of following prompt flow.
      exit(`Not authorized for ${environment}. Run "bedrock cloud authorize ${environment}".`);
    } else {
      if (!force) {
        const confirmed = await prompt({
          type: 'confirm',
          name: 'authorize',
          message: `Would you like to switch and authorize project: "${config.gcloud.project}" for environment: "${environment}"?`,
        });
        if (!confirmed) process.exit(1);
      }
      await setGCloudConfig(config.gcloud);
    }
  }
  await checkSecrets(environment);
}
