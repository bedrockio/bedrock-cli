//import { yellow } from 'kleur';
import { exit } from '../util/exit';
import { prompt } from '../util/prompt';
import { setConfig } from './utils';

export async function bootstrapProjectEnvironment(project, environment, config) {
  const { gcloud } = config;
  if (!gcloud) exit(`Missing gcloud in config.json for environment: "${environment}"`);
  if (!gcloud.project)
    exit(`Missing gcloud.project in config.json for environment: "${environment}"`);
  if (project != gcloud.project) {
    let confirmed = await prompt({
      type: 'confirm',
      name: 'open',
      message: `Project "${project}" is different from project "${gcloud.project}" as defined in config.json. Your config.json will be updated, do you want to continue?`,
      initial: true,
    });
    if (!confirmed) process.exit(0);
    const updatedConfig = { ...config };
    if (config.gcloud.bucketPrefix == config.gcloud.project) {
      updatedConfig.gcloud.bucketPrefix = project;
    }
    updatedConfig.gcloud.project = project;
    await setConfig(environment, updatedConfig);
  }
}
