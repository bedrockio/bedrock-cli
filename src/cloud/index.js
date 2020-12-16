import open from 'open';
import { green, yellow } from 'kleur';
import { assertBedrockRoot } from '../util/dir';
import { exec, execSyncInherit } from '../util/shell';
import { prompt } from '../util/prompt';
import { getConfig, setGCloudConfig, checkConfig, checkGCloudProject } from './authorize';
import { buildImage } from './build';
import { dockerPush } from './push';
import { warn } from './deploy';
import { rolloutDeployment, getDeployment, deleteDeployment, checkDeployment } from './rollout';
import { getSecret, setSecret, getSecretInfo, deleteSecret, decryptSecretData } from './secret';
import {
  checkKubectlVersion,
  getEnvironmentPrompt,
  getServicesPrompt,
  getTagPrompt,
  getSecretSubCommandPrompt,
  getSecretNamePrompt,
  getPlatformName,
  getAllSecretsPrompt,
} from './utils';

export async function authorize(options) {
  await assertBedrockRoot();

  const environment = options.environment || (await getEnvironmentPrompt());
  const config = await getConfig(environment);
  await setGCloudConfig(config.gcloud);
}

export async function status(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();

  const environment = options.environment || (await getEnvironmentPrompt());
  const config = await getConfig(environment);
  await checkConfig(environment, config);

  await execSyncInherit('kubectl get ingress');
  console.info('');
  await execSyncInherit('kubectl get services');
  console.info('');
  await execSyncInherit('kubectl get nodes');
  console.info('');
  const podInfo = await exec('kubectl get pods');
  console.info(podInfo, '\n');
  if (podInfo.includes('CreateContainerConfigError')) {
    console.info(
      yellow(
        `CreateContainerConfigError: Check if you created the required secrets, e.g., "bedrock cloud secret ${environment} set credentials"`
      )
    );
  }
}

export async function build(options) {
  await assertBedrockRoot();

  const { service, subservice, tag } = options;
  const platformName = getPlatformName();

  if (!service) {
    const services = await getServicesPrompt();
    if (!services.length) process.exit(0);
    const enteredTag = await getTagPrompt();

    for (const [service, subservice] of services) {
      await buildImage(platformName, service, subservice, enteredTag);
    }
  } else {
    await buildImage(platformName, service, subservice, tag);
  }
}

export async function push(options) {
  await assertBedrockRoot();

  const { service, subservice, tag } = options;
  const environment = options.environment || (await getEnvironmentPrompt());
  const config = await getConfig(environment);
  await checkConfig(environment, config);
  const { project } = config.gcloud;
  const platformName = getPlatformName();

  if (!service) {
    const services = await getServicesPrompt();
    if (!services.length) process.exit(0);
    const enteredTag = await getTagPrompt();
    for (const [service, subservice] of services) {
      await dockerPush(project, platformName, service, subservice, enteredTag);
    }
  } else {
    await dockerPush(project, platformName, service, subservice, tag);
  }
}

export async function rollout(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();

  const { service, subservice } = options;
  const environment = options.environment || (await getEnvironmentPrompt());
  const config = await getConfig(environment);
  await checkConfig(environment, config);

  if (!service) {
    const services = await getServicesPrompt();
    for (const [service, subservice] of services) {
      await rolloutDeployment(environment, service, subservice);
    }
  } else {
    await rolloutDeployment(environment, service, subservice);
  }
}

export async function deploy(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();

  const { service, subservice, tag } = options;
  const environment = options.environment || (await getEnvironmentPrompt());
  const config = await getConfig(environment);
  await checkConfig(environment, config);
  const { project } = config.gcloud;
  const platformName = getPlatformName();

  await warn(environment);

  if (!service) {
    const services = await getServicesPrompt();
    if (!services.length) process.exit(0);
    const enteredTag = await getTagPrompt();
    for (const [service, subservice] of services) {
      await buildImage(platformName, service, subservice, enteredTag);
      await dockerPush(project, platformName, service, subservice, enteredTag);
      await rolloutDeployment(environment, service, subservice);
    }
  } else {
    await buildImage(platformName, service, subservice, tag);
    await dockerPush(project, platformName, service, subservice, tag);
    await rolloutDeployment(environment, service, subservice);
  }
}

export async function undeploy(options) {
  await assertBedrockRoot();

  const { service, subservice } = options;
  const environment = options.environment || (await getEnvironmentPrompt());
  const config = await getConfig(environment);
  await checkConfig(environment, config);

  if (!service) {
    const services = await getServicesPrompt();
    for (const [service, subservice] of services) {
      const exists = await checkDeployment(service, subservice);
      if (exists) await deleteDeployment(environment, service, subservice);
    }
  } else {
    const exists = await checkDeployment(service, subservice);
    if (exists) await deleteDeployment(environment, service, subservice);
  }
}

async function showDeploymentInfo(service, subservice) {
  const deployment = getDeployment(service, subservice);
  const deploymentInfo = await checkDeployment(service, subservice);
  if (deploymentInfo) {
    const { annotations } = deploymentInfo.spec.template.metadata;
    console.info(green(`Deployment "${deployment}" annotations:`));
    console.info(annotations);
  }
}

export async function info(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();

  const { service, subservice } = options;
  const environment = options.environment || (await getEnvironmentPrompt());
  const config = await getConfig(environment);
  await checkConfig(environment, config);

  if (!service) {
    const services = await getServicesPrompt();
    for (const [service, subservice] of services) {
      await showDeploymentInfo(service, subservice);
    }
  } else {
    await showDeploymentInfo(service, subservice);
  }
}

export async function shell(options) {
  await assertBedrockRoot();

  const { service, subservice } = options;
  const environment = options.environment || (await getEnvironmentPrompt());
  await checkKubectlVersion();
  const config = await getConfig(environment);
  await checkConfig(environment, config);

  const podsJSON = await exec(`kubectl get pods -o json --ignore-not-found`);
  if (!podsJSON) {
    console.info(yellow(`No running pods`));
    process.exit(0);
  }
  const pods = JSON.parse(podsJSON).items;

  let deployment = 'api-cli-deployment';
  if (service) {
    deployment = getDeployment(service, subservice);
  }

  const filteredPods = pods.filter((pod) => pod.metadata.name.startsWith(deployment));

  if (!filteredPods.length) {
    console.info(yellow(`No running pods for deployment "${deployment}"`));
    process.exit(0);
  }

  const podName = filteredPods[0].metadata.name;
  console.info(yellow(`=> Starting bash for pod: "${podName}"`));

  const { spawn } = require('child_process');

  const child = spawn('kubectl', ['exec', '-it', podName, '--', 'bash'], {
    stdio: 'inherit',
  });

  child.on('exit', function (code) {
    console.info(green(`Finished bash for pod: "${podName}" (exit code: ${code})`));
  });
}

export async function logs(options) {
  await assertBedrockRoot();

  const { environment, service, subservice } = options;
  const config = await getConfig(environment);
  await checkConfig(environment, config);
  const { project, computeZone, kubernetes, label } = config.gcloud;

  let labelName = service;
  if (subservice) labelName += `-${subservice}`;
  const podLabel = label || 'app';

  const query = `resource.type="k8s_container"\nresource.labels.project_id="${project}"\nresource.labels.location="${computeZone}"\nresource.labels.cluster_name="${kubernetes.clusterName}"\nresource.labels.namespace_name="default"\nlabels.k8s-pod/${podLabel}="${labelName}"`;

  const params = new URLSearchParams({ query });

  const url = `https://console.cloud.google.com/logs/query;${params.toString()}?project=${project}`;
  console.info(green(`=> Opening Logs in GCloud UI`));
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

export async function secret(options) {
  await assertBedrockRoot();

  const environment = options.environment || (await getEnvironmentPrompt());
  const config = await getConfig(environment);
  await checkGCloudProject(config.gcloud);
  let subcommand = options.subcommand || (await getSecretSubCommandPrompt());
  if (!['get', 'set', 'info', 'delete'].includes(subcommand)) {
    console.info(
      yellow(`Subcommand "${subcommand}" is not supported. Only "get", "set" and "info".`)
    );
    let confirmed = await prompt({
      type: 'confirm',
      name: 'subcommand',
      message: 'Would you like to run "get" secret instead?',
      initial: true,
    });
    if (!confirmed) process.exit(0);
    subcommand = 'get';
  }

  if (subcommand == 'get') {
    const secretName = options.name || (await getAllSecretsPrompt());
    console.info(yellow(`=> Retrieving secret`));
    await getSecret(environment, secretName);
  } else if (subcommand == 'set') {
    const secretName = options.name || (await getSecretNamePrompt());
    await setSecret(environment, secretName);
  } else if (subcommand == 'info') {
    const secretName = options.name || (await getAllSecretsPrompt());
    console.info(yellow(`=> Retrieving secret`));
    const secretInfo = await getSecretInfo(secretName);
    if (secretInfo) {
      console.info(secretInfo);
      console.info(yellow('=> Decrypt data'));
      console.info(decryptSecretData(secretInfo));
    } else {
      console.info(yellow(`Could not find secret "${secretName}"`));
    }
  } else if (subcommand == 'delete') {
    const secretName = options.name || (await getAllSecretsPrompt());
    await deleteSecret(secretName);
  }
}
