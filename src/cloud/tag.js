import { green, yellow, red } from 'kleur/colors';

import { exec, execSyncInherit } from '../utils/shell.js';

const TAG_VALUES = {
  staging: 'Staging',
  production: 'Production',
  development: 'Development',
  test: 'Test',
};

export async function setEnvironmentTag(project, environment) {
  const tagValue = TAG_VALUES[environment];
  if (!tagValue) {
    console.info(yellow(`Unknown environment "${environment}" for tagging. Skipping.`));
    return;
  }

  console.info(yellow(`=> Setting environment tag "${tagValue}" on project "${project}"`));

  // Get project number
  const projectNumber = await exec(`gcloud projects describe ${project} --format=value(projectNumber)`);

  const parent = `//cloudresourcemanager.googleapis.com/projects/${projectNumber}`;

  // Check if environment tag is already bound
  try {
    const bindingsJSON = await exec(
      `gcloud resource-manager tags bindings list --parent=${parent} --location=global --format=json`,
    );
    const bindings = JSON.parse(bindingsJSON);
    const hasTag = bindings.some((b) => b.tagValue && b.tagValue.includes('/environment/'));
    if (hasTag) {
      console.info(green('Environment tag already set. Skipping.'));
      return;
    }
  } catch {
    // If listing fails, proceed to try creating the binding
  }

  // Ensure the tag key exists at project level
  try {
    await exec(`gcloud resource-manager tags keys describe ${project}/environment --format=json`);
  } catch {
    console.info(yellow('=> Creating environment tag key'));
    execSyncInherit(`gcloud resource-manager tags keys create environment --parent=projects/${project}`);
  }

  // Ensure the tag value exists
  try {
    await exec(`gcloud resource-manager tags values describe ${project}/environment/${tagValue} --format=json`);
  } catch {
    console.info(yellow(`=> Creating environment tag value "${tagValue}"`));
    execSyncInherit(
      `gcloud resource-manager tags values create ${tagValue} --parent=${project}/environment`,
    );
  }

  // Create the tag binding
  execSyncInherit(
    `gcloud resource-manager tags bindings create --tag-value=${project}/environment/${tagValue} --parent=${parent} --location=global`,
  );
  console.info(green(`Environment tag "${tagValue}" set on project "${project}".`));
}
