import open from 'open';
import { reset, gray, green, yellow, red } from 'kleur';
import { assertBedrockRoot, assertBedrockServicesRoot } from '../util/dir';
import { exec, execSyncInherit } from '../util/shell';
import { prompt } from '../util/prompt';
import { setGCloudConfig, checkConfig } from './authorize';
import { buildImage } from './build';
import { dockerPush } from './push';
import { warn } from './deploy';
import { rolloutDeployment, getDeployment, deleteDeployment, checkDeployment } from './rollout';
import {
  readConfig,
  checkKubectlVersion,
  getEnvironmentPrompt,
  getServicesPrompt,
  getServices,
  getTagPrompt,
  getPlatformName,
} from './utils';
import { bootstrapProjectEnvironment } from './bootstrap';
import { slackStartedDeploy, slackFinishedDeploy } from './slack';

export async function authorize(options) {
  await assertBedrockRoot();

  const environment = options.environment || (await getEnvironmentPrompt());
  const config = readConfig(environment);
  await setGCloudConfig(config.gcloud);
}

export async function account(options) {
  try {
    const auth = JSON.parse(await exec('gcloud auth list --format json'));

    const name =
      options.name ||
      (await prompt({
        message: 'Select Account',
        type: 'select',
        choices: auth.map(({ account, status }) => {
          const active = status === 'ACTIVE' ? ' (active)' : '';
          return {
            title: `${account}${reset(gray(active))}`,
            value: account,
          };
        }),
      }));

    const active = auth.find(({ status }) => {
      return status === 'ACTIVE';
    });
    if (!active || active.account !== name) {
      await execSyncInherit(`gcloud config set account ${name}`);
      console.info(yellow(`=> Activate account "${name}"`));
    } else {
      console.info(yellow('No changes'));
    }
  } catch (e) {
    console.info(red('Could not get accounts from "gcloud config configuration list"'));
    return;
  }
}

export async function login() {
  console.info(
    yellow(
      'This will open a glcoud login URL in your browser twice. First for your account auth, and a second time for your application default.'
    )
  );
  let confirmed = await prompt({
    type: 'confirm',
    name: 'open',
    message: 'Would you like to proceeed?',
    initial: true,
  });
  if (!confirmed) return;
  console.info(yellow('=> Opening browser to auth login'));
  await execSyncInherit('gcloud auth login');
  console.info(yellow('=> Opening browser to auth application-default login'));
  await execSyncInherit('gcloud auth application-default login');
}

export async function status(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();

  const environment = options.environment || (await getEnvironmentPrompt());
  const config = readConfig(environment);
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
  await assertBedrockServicesRoot();

  options.platformName = await getPlatformName();

  if (options.service) {
    options.services = [[options.service]];
  } else {
    options.services = await getServicesPrompt();
    if (!options.services.length) {
      console.info(yellow('There were no services selected'));
      process.exit(0);
    }
    options.tag = await getTagPrompt();
  }

  for (const [service, subservice] of options.services) {
    await buildImage({
      service,
      subservice,
      ...options,
    });
  }
}

export async function push(options) {
  await assertBedrockRoot();

  const environment = options.environment || (await getEnvironmentPrompt());
  const config = readConfig(environment);
  await checkConfig(environment, config);
  const { project } = config.gcloud;
  options.platformName = await getPlatformName();

  if (options.service) {
    options.services = [[options.service]];
  } else {
    options.services = await getServicesPrompt();
    if (!options.services.length) {
      console.info(yellow('There were no services selected'));
      process.exit(0);
    }
    options.tag = await getTagPrompt();
  }

  await warn(environment);

  for (const [service, subservice] of options.services) {
    await dockerPush({
      project,
      service,
      subservice,
      ...options,
    });
  }
}

export async function rollout(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();

  const { service, subservice } = options;
  const environment = options.environment || (await getEnvironmentPrompt());
  const config = readConfig(environment);
  await checkConfig(environment, config);

  if (!service) {
    const services = await getServicesPrompt();
    if (!services.length) {
      console.info(yellow('There were no services selected'));
      process.exit(0);
    }
    await warn(environment);
    for (const [service, subservice] of services) {
      await rolloutDeployment(environment, service, subservice);
    }
  } else {
    await warn(environment);
    await rolloutDeployment(environment, service, subservice);
  }
}

export async function deploy(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();

  const environment = options.environment || (await getEnvironmentPrompt());
  const config = readConfig(environment);
  await checkConfig(environment, config);
  const { project } = config.gcloud;
  options.platformName = await getPlatformName();

  if (options.service) {
    options.services = [[options.service]];
  } else {
    options.services = options.all ? getServices() : await getServicesPrompt();
    if (!options.services.length) {
      console.info(yellow('There were no services selected'));
      process.exit(0);
    }
    options.tag = await getTagPrompt();
  }

  await warn(environment);
  const serviceNames = options.services.map(([service, subservice]) => {
    let serviceName = service;
    if (subservice) serviceName += ` / ${subservice}`;
    return serviceName;
  });
  try {
    slackStartedDeploy(environment, config, serviceNames);
  } catch (e) {
    console.error(red('Failed to post to Slack'));
  }
  for (const [service, subservice] of options.services) {
    await buildImage({
      service,
      subservice,
      ...options,
    });

    // Remote builds are already pushed.
    if (!options.remote) {
      await dockerPush({
        project,
        service,
        subservice,
        ...options,
      });
    }

    await rolloutDeployment(environment, service, subservice);
  }

  try {
    slackFinishedDeploy(config);
  } catch (e) {
    console.error(red('Failed to post to Slack'));
  }
}

export async function undeploy(options) {
  await assertBedrockRoot();

  const { service, subservice } = options;
  const environment = options.environment || (await getEnvironmentPrompt());
  const config = readConfig(environment);
  await checkConfig(environment, config);

  if (!service) {
    const services = await getServicesPrompt();
    if (!services.length) {
      console.info(yellow('There were no services selected'));
      process.exit(0);
    }
    await warn(environment);
    for (const [service, subservice] of services) {
      const exists = await checkDeployment(service, subservice);
      if (exists) await deleteDeployment(environment, service, subservice);
    }
  } else {
    await warn(environment);
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
  const config = readConfig(environment);
  await checkConfig(environment, config);

  if (!service) {
    const services = await getServicesPrompt();
    if (!services.length) {
      console.info(yellow('There were no services selected'));
      process.exit(0);
    }
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
  const config = readConfig(environment);
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

  const environment = options.environment || (await getEnvironmentPrompt());
  const config = readConfig(environment);
  await checkConfig(environment, config);
  const { project, computeZone, kubernetes, label } = config.gcloud;

  let service = options.service;
  let subservice = options.subservice;
  if (!service) {
    [service, subservice] = await getServicesPrompt('select');
  }

  let labelName = service;
  if (subservice) labelName += `-${subservice}`;
  const podLabel = label || 'app';

  const query = `resource.type="k8s_container"\nresource.labels.project_id="${project}"\nresource.labels.location="${computeZone}"\nresource.labels.cluster_name="${kubernetes.clusterName}"\nresource.labels.namespace_name="default"\nlabels.k8s-pod/${podLabel}="${labelName}"`;

  const params = new URLSearchParams({ query });

  const url = `https://console.cloud.google.com/logs/query;${params.toString()}?project=${project}`;
  console.info(yellow('=> Opening Logs in GCloud UI'));
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

export async function bootstrap(options) {
  await assertBedrockRoot();

  const environment = options.environment || (await getEnvironmentPrompt());
  const config = readConfig(environment);

  const project =
    options.project ||
    (await prompt({
      type: 'text',
      message: 'Enter projectId:',
      initial: config.gcloud && config.gcloud.project,
    }));
  console.info(green(`bedrock cloud ${environment} ${project}`));
  console.info(yellow(`=> Bootstrap GKE cluster and services (environment: [${environment}], project: [${project}])`));
  await bootstrapProjectEnvironment(project, environment, config);
}
