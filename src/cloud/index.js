import { spawn } from 'child_process';

import open from 'open';
import { reset, gray, green, yellow, red } from 'kleur/colors';

import { assertBedrockRoot } from '../utils/dir.js';
import { exec, execSyncInherit } from '../utils/shell.js';
import { prompt } from '../utils/prompt.js';
import { checkConfig, setGCloudConfig } from './authorize.js';
import { buildImage } from './build.js';
import { dockerPush } from './push.js';
import { confirmDeployment } from './deploy.js';
import { rolloutDeployment, deleteDeployment, checkDeployment } from './rollout.js';
import {
  checkKubectlVersion,
  checkTag,
  checkPlatformName,
  checkSubdeployment,
  checkServices,
  checkService,
  getDeployment,
  readConfig,
  checkEnvironment,
} from './utils.js';
import { bootstrapProjectEnvironment } from './bootstrap.js';
import { slackStartedDeploy, slackFinishedDeploy } from './slack.js';
import { error } from '../utils/flow.js';

export async function authorize(options) {
  await assertBedrockRoot();
  await checkEnvironment(options);
  const { environment } = options;
  const config = await readConfig(environment);

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
  } catch {
    console.info(red('Could not get accounts from "gcloud config configuration list"'));
    return;
  }
}

export async function login() {
  console.info(yellow('This will open a gcloud login URL in your browser for your account auth.'));
  let confirmed = await prompt({
    type: 'confirm',
    name: 'open',
    message: 'Would you like to proceeed?',
    initial: true,
  });
  if (!confirmed) return;
  console.info(yellow('=> Opening browser to auth login'));
  await execSyncInherit('gcloud auth login');
}

export async function loginApplication() {
  console.info(yellow('This will open a gcloud login URL in your browser for your application default.'));
  let confirmed = await prompt({
    type: 'confirm',
    name: 'open',
    message: 'Would you like to proceeed?',
    initial: true,
  });
  if (!confirmed) return;
  console.info(yellow('=> Opening browser to auth application-default login'));
  await execSyncInherit('gcloud auth application-default login');
}

export async function status(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();
  await checkConfig(options);

  const { environment } = options;
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
        `CreateContainerConfigError: Check if you created the required secrets, e.g., "bedrock cloud secret set ${environment} secrets"`,
      ),
    );
  }
}

export async function build(options) {
  await assertBedrockRoot();
  await checkServices(options);

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
  await checkConfig(options);
  await checkPlatformName(options);
  if (options.service && !options.tag) {
    options.tag = options.subdeployment || 'latest';
  }
  await checkServices(options);
  await checkTag(options);

  await confirmDeployment(options.environment);

  const { project } = options.config.gcloud;
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
  await checkConfig(options);
  await checkSubdeployment(options);
  await checkServices(options);

  await confirmDeployment(options.environment);

  for (const [service, subservice] of options.services) {
    await rolloutDeployment({
      service,
      subservice,
      ...options,
    });
  }
}

export async function deploy(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();
  await checkConfig(options);
  await checkSubdeployment(options);
  await checkPlatformName(options);
  if (options.service && !options.tag) {
    options.tag = options.subdeployment || 'latest';
  }
  await checkServices(options);
  await checkTag(options);

  if (!options.config.gcloud.skipWarn) {
    await confirmDeployment(options.environment);
  }

  const { project } = options.config.gcloud;
  const serviceNames = options.services.map(([service, subservice]) => {
    let serviceName = service;
    if (subservice) serviceName += ` / ${subservice}`;
    return serviceName;
  });
  try {
    slackStartedDeploy(options.environment, options.config, serviceNames);
  } catch {
    error('Failed to post to Slack');
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

    await rolloutDeployment({
      service,
      subservice,
      ...options,
    });
  }

  try {
    slackFinishedDeploy(options.config);
  } catch {
    error('Failed to post to Slack');
  }
}

export async function undeploy(options) {
  await assertBedrockRoot();
  await checkConfig(options);
  await checkServices(options);

  await confirmDeployment(options.environment);

  for (const [service, subservice] of options.services) {
    const opt = {
      ...options,
      service,
      subservice,
    };
    const exists = await checkDeployment(opt);
    if (exists) {
      await deleteDeployment(opt);
    }
  }
}

async function showDeploymentInfo(options) {
  const deployment = getDeployment(options);
  const deploymentInfo = await checkDeployment(options);
  if (deploymentInfo) {
    const { annotations } = deploymentInfo.spec.template.metadata;
    console.info(green(`Deployment "${deployment}" annotations:`));
    console.info(annotations);
  }
}

export async function info(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();
  await checkConfig(options);
  await checkServices(options);

  for (const [service, subservice] of options.services) {
    await showDeploymentInfo({
      ...options,
      service,
      subservice,
    });
  }
}

export async function shell(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();
  await checkConfig(options);

  const podsJSON = await exec(`kubectl get pods -o json --ignore-not-found`);
  if (!podsJSON) {
    console.info(yellow(`No running pods`));
    process.exit(0);
  }
  const pods = JSON.parse(podsJSON).items;

  let deployment = 'api-cli-deployment';
  if (options.service) {
    deployment = getDeployment(options);
  }

  if (options.config && options.config.gcloud) {
    const { dropDeploymentPostfix } = options.config.gcloud;
    if (dropDeploymentPostfix && '-deployment' == deployment.slice(-11)) {
      // drop -deployment from deployment name
      deployment = deployment.slice(0, -11);
    }
  }

  const filteredPods = pods.filter((pod) => pod.metadata.name.startsWith(deployment));

  if (!filteredPods.length) {
    console.info(yellow(`No running pods for deployment "${deployment}"`));
    process.exit(0);
  }

  const podName = filteredPods[0].metadata.name;
  console.info(yellow(`=> Starting bash for pod: "${podName}"`));

  const child = spawn('kubectl', ['exec', '-it', podName, '--', 'bash'], {
    stdio: 'inherit',
  });

  child.on('exit', function (code) {
    console.info(green(`Finished bash for pod: "${podName}" (exit code: ${code})`));
  });
}

export async function portForward(options) {
  await assertBedrockRoot();
  await checkKubectlVersion();
  await checkConfig(options);
  await checkService(options);

  const { service, subservice } = options;

  let deployment = `deployment/${service}`;
  if (subservice) {
    deployment += `-${subservice}`;
  }
  deployment += '-deployment';

  const localPort =
    options.localPort ||
    (await prompt({
      type: 'text',
      message: 'Enter Local Port number',
      initial: '5602',
      validate: (value) => (!value.match(/^[0-9]+$/gim) ? `Port may contain only numbers.` : true),
    }));

  const remotePort =
    options.remotePort ||
    (await prompt({
      type: 'text',
      message: 'Enter Remote Port number',
      initial: '5601',
      validate: (value) => (!value.match(/^[0-9]+$/gim) ? `Port may contain only numbers.` : true),
    }));

  console.info(yellow(`=> Starting portFoward for "${deployment}" ${localPort}:${remotePort}`));

  await execSyncInherit(`kubectl port-forward ${deployment} ${localPort}:${remotePort}`);
}

export async function logs(options) {
  await assertBedrockRoot();
  await checkConfig(options);
  await checkService(options);

  const { config, service, subservice } = options;
  const { project, computeZone, kubernetes, label } = config.gcloud;

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
  await checkEnvironment(options);
  const { environment } = options;
  const config = await readConfig(environment);

  const project =
    options.project ||
    (await prompt({
      type: 'text',
      message: 'Enter Google Cloud project ID:',
      initial: config.gcloud && config.gcloud.project,
    }));
  console.info(green(`bedrock cloud ${environment} ${project}`));
  console.info(yellow(`=> Bootstrap GKE cluster and services (environment: [${environment}], project: [${project}])`));
  await bootstrapProjectEnvironment(project, environment, config);
}
