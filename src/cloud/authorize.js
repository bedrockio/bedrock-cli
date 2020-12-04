import { exit } from '../util/exit';
import kleur from 'kleur';
import { exec } from '../util/shell';

export async function setGCloudConfig(options) {
  const { project, computeZone, kubernetes } = options;
  if (!kubernetes) exit('Missing kubernetes settings in config');
  try {
    const stdErr = true; // gcloud returns output on stderr

    if (!project) exit('Missing project');
    console.log(await exec(`gcloud config set project ${project}`, stdErr));

    if (!computeZone) exit('Missing computeZone');
    console.info(await exec(`gcloud config set compute/zone ${computeZone}`, stdErr));

    const { clusterName } = kubernetes;
    if (!clusterName) exit('Missing kubernetes.clusterName');

    console.info(await exec(`gcloud container clusters get-credentials ${clusterName}`, stdErr));
    console.info(await exec(`gcloud config set container/cluster ${clusterName}`, stdErr));
  } catch (e) {
    exit(e.message);
  }
}

export async function checkGCloudConfig(environment, options) {
  const { project, computeZone, kubernetes } = options;
  if (!kubernetes) exit('Missing kubernetes settings in config');
  try {
    let valid = true;
    if (!project) exit('Missing project');
    const currentProject = await exec('gcloud config get-value project');
    if (project != currentProject) {
      valid = false;
      console.info(
        kleur.red(`Invalid Google Cloud config (use authorize script): project = ${currentProject}`)
      );
    }

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

    // TODO: add check for secrets folder: deployment/environments/$ENVIRONMENT/secrets

    console.info(
      kleur.green(
        `Using Google Cloud environment ${environment} (project=${project}, compute/zone=${computeZone}, cluster=${clusterName})`
      )
    );

    // TODO: add optional fallback to authorize current values

    return valid;
  } catch (e) {
    exit(e.message);
  }
}
