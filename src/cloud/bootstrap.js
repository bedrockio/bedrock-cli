import { green, yellow } from 'kleur';
import { exit } from '../util/exit';
import { prompt } from '../util/prompt';
import { exec, execSyncInherit } from '../util/shell';
import { writeConfig, readServiceYaml, writeServiceYaml } from './utils';
import { checkTerraformCommand } from './provision/index';

export async function bootstrapProjectEnvironment(project, environment, config) {
  await checkTerraformCommand();

  let activeAccount = '';
  try {
    activeAccount = await exec('gcloud config get-value account');
    if (!activeAccount) throw new Error('No activeAccount');
  } catch (e) {
    exit(
      'There is no active glcoud account. Please login to glcloud first. Run: "bedrock cloud login"'
    );
  }

  try {
    await exec(`gcloud projects describe ${project} --format json`);
  } catch (e) {
    exit(
      `Error: No access for user [${activeAccount}] or unknown project [${project}] (Perhaps you need to login first: "bedrock cloud login")`
    );
  }

  console.info(
    green(`Verified Google Cloud project [${project}] for environment [${environment}]`)
  );

  const { gcloud } = config;
  if (!gcloud) exit(`Missing gcloud in config.json for environment [${environment}]`);
  if (!gcloud.project)
    exit(`Missing gcloud.project in config.json for environment [${environment}]`);
  if (project != gcloud.project) {
    let confirmed = await prompt({
      type: 'confirm',
      name: 'open',
      message: `Project [${project}] is different from project [${gcloud.project}] as defined in config.json. Your config.json will be updated, do you want to continue?`,
      initial: true,
    });
    if (!confirmed) process.exit(0);
    const updatedConfig = { ...config };
    if (config.gcloud.bucketPrefix == config.gcloud.project) {
      updatedConfig.gcloud.bucketPrefix = project;
    }
    updatedConfig.gcloud.project = project;
    writeConfig(environment, updatedConfig);
  }

  console.info(yellow('=> Updating gcloud config project'));
  await execSyncInherit(`gcloud config set project ${project}`);
  console.info(yellow('=> Enabling Compute services (This can take a couple of minutes)'));
  await execSyncInherit('gcloud services enable compute.googleapis.com');
  console.info(yellow('=> Enabling Kubernetes services'));
  await execSyncInherit('gcloud services enable container.googleapis.com');

  //   const apiServiceYaml = readServiceYaml(environment, 'api-service.yml');
  //   console.info(JSON.stringify(apiServiceYaml, null, 2));
  //   apiServiceYaml.spec.loadBalancerIP = '127.0.0.1';
  //   writeServiceYaml(environment, 'api-service.yml', apiServiceYaml);
}
