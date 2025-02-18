import fs from 'fs';

import { green, yellow } from 'kleur/colors';

import { exit } from '../utils/flow.js';
import { prompt } from '../utils/prompt.js';
import { exec, execSyncInherit } from '../utils/shell.js';
import { writeConfig, readServiceYaml, writeServiceYaml } from './utils.js';
import { checkTerraformCommand, terraformInit, terraformApply } from './provision/index.js';

import { authorize, deploy, status } from './index.js';

export async function bootstrapProjectEnvironment(project, environment, config) {
  await checkTerraformCommand();

  let activeAccount = '';
  try {
    activeAccount = await exec('gcloud config get-value account');
    if (!activeAccount) throw new Error('No activeAccount');
  } catch {
    exit('There is no active gcloud account. Please login to gcloud first. Run: "bedrock cloud login"');
  }

  try {
    await exec(`gcloud projects describe ${project} --format json`);
  } catch {
    exit(
      `Error: No access for user [${activeAccount}] or unknown project [${project}]
       (Perhaps you need to login first: "bedrock cloud login")`,
    );
  }

  console.info(green(`Verified Google Cloud project [${project}] for environment [${environment}]`));

  const { gcloud } = config;
  if (!gcloud) {
    exit(`Missing gcloud in config.json for environment [${environment}]`);
  }
  if (!gcloud.project) {
    exit(`Missing gcloud.project in config.json for environment [${environment}]`);
  }
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

  console.info(yellow('=> Configure deployment GCR paths'));
  for (const service of ['api', 'api-cli', 'api-jobs', 'web']) {
    configureDeploymentGCRPath(environment, service, project);
  }

  let loginConfirmed = await prompt({
    type: 'confirm',
    name: 'open',
    message: `Terraform requires you run 'gcloud auth application-default login' for this project. Did you already login?`,
    initial: true,
  });
  if (!loginConfirmed) {
    console.info(yellow('=> Opening browser to auth application-default login'));
    await execSyncInherit('gcloud auth application-default login');
  }

  console.info(yellow('=> Terraform init'));
  await terraformInit({ environment });
  console.info(yellow('=> Terraform apply'));
  await terraformApply({ environment });

  console.info(yellow('=> Authorizing into Kubernetes cluster'));
  await authorize({ environment });
  console.info(yellow('=> Get Kubernetes cluster nodes'));
  await execSyncInherit('kubectl get nodes');

  const { computeZone, bootstrapDeploy = true, recreateIngress = true } = gcloud;
  // computeZone example: us-east1-c
  const region = computeZone.slice(0, -2); // e.g. us-east1
  const envPath = `deployment/environments/${environment}`;
  const services = gcloud.services || ['api', 'web'];
  const ingresses = gcloud.ingresses || [];

  if (fs.existsSync(`${envPath}/namespaces`)) {
    console.info(yellow('=> Creating namespaces'));
    await execSyncInherit(`kubectl apply -f ${envPath}/namespaces`);
  }

  console.info(yellow('=> Creating data pods'));
  await execSyncInherit(`kubectl delete -f ${envPath}/data --ignore-not-found`);
  await execSyncInherit(`kubectl create -f ${envPath}/data`);

  const ips = [];
  for (let service of services) {
    console.info(yellow(`=> Configure ${service} loadbalancer`));
    let ip = await configureServiceLoadBalancer(environment, service, region);
    if (ip) {
      ips.push([service, ip]);
    }
    console.info(yellow(`=> Creating ${service} service`));
    await execSyncInherit(`kubectl delete -f ${envPath}/services/${service}-service.yml --ignore-not-found`);
    await execSyncInherit(`kubectl create -f ${envPath}/services/${service}-service.yml`);
  }

  for (let ingress of ingresses) {
    console.info(yellow(`=> Configure ${ingress} ingress`));
    let ip = await configureIngress(ingress);
    ips.push([ingress + '-ingress', ip]);
    if (recreateIngress) {
      console.info(yellow(`=> Creating ${ingress} ingress`));
      await execSyncInherit(`kubectl delete -f ${envPath}/services/${ingress}-ingress.yml --ignore-not-found`);
      await execSyncInherit(`kubectl create -f ${envPath}/services/${ingress}-ingress.yml`);
    }
  }

  if (fs.existsSync(`${envPath}/gateways`)) {
    console.info(yellow('=> Creating gateways'));
    await execSyncInherit(`kubectl apply -f ${envPath}/gateways`);
  }

  if (bootstrapDeploy) {
    await deploy({ environment, service: 'api', subservice: 'cli' });
    await deploy({ environment, service: 'api' });
    await deploy({ environment, service: 'web' });

    await status({ environment });
  }

  console.info(yellow('=> Finishing up'));
  console.info(green('Make sure to configure your DNS records (Cloudflare recommended)\n'));
  for (const [serviceName, serviceIP] of ips) {
    console.info(green(` ${serviceName}:`));
    console.info(green(` - address: ${serviceIP}`));
    if (serviceName == 'api' || serviceName.match(/api-ingress$/)) {
      const apiUrl = await getApiUrl(environment);
      if (apiUrl) {
        console.info(green(` - configuration of API_URL in web deployment: ${apiUrl}\n`));
      }
    }
    if (serviceName == 'web' || serviceName.match(/web-ingress$/)) {
      const appUrl = await getAppUrl(environment);
      if (appUrl) {
        console.info(green(` - configuration of APP_URL in api deployment: ${appUrl}\n`));
      }
    }
  }

  console.info(green('Done!'));
}

async function configureServiceLoadBalancer(environment, service, region) {
  const fileName = `${service}-service.yml`;
  const serviceYaml = readServiceYaml(environment, fileName);

  if (serviceYaml.spec.type != 'LoadBalancer') {
    console.info(yellow(`=> Skipping: Service ${service} with type ${serviceYaml.spec.type} is no loadBalancer`));
    return;
  }

  let addressIP;
  try {
    const addressJSON = await exec(`gcloud compute addresses describe --region ${region} ${service} --format json`);
    addressIP = JSON.parse(addressJSON).address;
  } catch {
    console.info(yellow(`Creating ${service.toUpperCase()} address`));
    await execSyncInherit(`gcloud compute addresses create ${service} --region ${region}`);
    const addressJSON = await exec(`gcloud compute addresses describe --region ${region} ${service} --format json`);
    addressIP = JSON.parse(addressJSON).address;

    // Update service yml file
    console.info(yellow(`=> Updating ${fileName}`));
    serviceYaml.spec.loadBalancerIP = addressIP;
    writeServiceYaml(environment, fileName, serviceYaml);
    console.info(serviceYaml);
  }
  console.info(green(`${service.toUpperCase()} service loadBalancerIP: ${addressIP}`));
  return addressIP;
}

async function configureIngress(ingress) {
  let addressIP;
  const ingressName = ingress + '-ingress';
  try {
    const addressJSON = await exec(`gcloud compute addresses describe --global ${ingressName} --format json`);
    addressIP = JSON.parse(addressJSON).address;
  } catch {
    console.info(yellow(`Creating ${ingressName.toUpperCase()} address`));
    await execSyncInherit(`gcloud compute addresses create ${ingressName} --global`);
    const addressJSON = await exec(`gcloud compute addresses describe --global ${ingressName} --format json`);
    addressIP = JSON.parse(addressJSON).address;
  }
  console.info(green(`${ingressName.toUpperCase()} ingress addressIP: ${addressIP}`));
  return addressIP;
}

function configureDeploymentGCRPath(environment, service, project) {
  // Update deployment yml file
  const fileName = `${service}-deployment.yml`;

  let serviceYaml;
  try {
    serviceYaml = readServiceYaml(environment, fileName);
  } catch {
    return;
  }

  const image = serviceYaml.spec.template.spec.containers[0].image;
  const newImage = image.replace(/gcr\.io\/.*\//, `gcr.io/${project}/`);
  console.info(green(newImage));

  if (image != newImage) {
    console.info(yellow(`=> Updating ${fileName}`));
    serviceYaml.spec.template.spec.containers[0].image = newImage;
    writeServiceYaml(environment, fileName, serviceYaml);
  }
}

function getAppUrl(environment) {
  const fileName = 'api-deployment.yml';
  const serviceYaml = readServiceYaml(environment, fileName);
  return serviceYaml.spec.template.spec.containers[0].env
    .filter((env) => {
      return env.name == 'APP_URL';
    })
    .filter(Boolean)[0].value;
}

function getApiUrl(environment) {
  const fileName = 'web-deployment.yml';
  const serviceYaml = readServiceYaml(environment, fileName);
  return serviceYaml.spec.template.spec.containers[0].env
    .filter((env) => {
      return env.name == 'API_URL';
    })
    .filter(Boolean)[0].value;
}
