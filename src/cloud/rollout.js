import kleur from 'kleur';
import { exit } from '../util/exit';
import { getConfig } from '../util/git';
import { exec, execSyncInherit } from '../util/shell';
import { getArchitecture } from './utils';
import fs from 'fs';
import path from 'path';

export function getDeployment(service, subservice) {
  let deployment = service;
  if (subservice) deployment += `-${subservice}`;
  deployment += '-deployment';
  return deployment;
}

export async function getRef() {
  let ref = await exec('git tag --points-at HEAD');
  if (!ref) ref = await exec('git rev-parse --short --verify HEAD');
  const stat = await exec('git diff --stat');
  if (stat) ref += '-dirty';
  return ref;
}

async function getMetaData() {
  const date = new Date().toUTCString();
  const author = await getConfig('user.name', 'Anonymous');
  const branch = await exec('git branch --show-current');
  const git = await getRef();
  const arch = getArchitecture();

  const metaData = {
    spec: {
      template: {
        metadata: {
          annotations: {
            date,
            author,
            branch,
            arch,
            git,
          },
        },
      },
    },
  };
  return JSON.stringify(metaData).replace(/"/g, '\\"');
}

export async function rolloutDeployment(environment, service, subservice) {
  const deployment = getDeployment(service, subservice);
  console.info(kleur.yellow(`\n=> Rolling out ${environment} ${deployment}`));

  const deploymentFile = path.resolve('deployment', 'environments', environment, 'services', `${deployment}.yml`);

  // Check for config file as it might not exist if the
  // deployment was dynamically created for a feature branch.
  if (fs.existsSync(deploymentFile)) {
    try {
      await execSyncInherit(`kubectl apply -f ${deploymentFile} --record`);
    } catch (e) {
      exit(e.message);
    }
  }

  const metaData = await getMetaData();

  // Patching spec.template forces the container to pull the latest image and
  // perform a rolling update as long as imagePullPolicy: Always is specified.
  try {
    await execSyncInherit(`kubectl patch deployment ${deployment} -p "${metaData}" --record`);
  } catch (e) {
    exit(e.message);
  }
}

export async function deleteDeployment(environment, service, subservice) {
  const deployment = getDeployment(service, subservice);
  console.info(kleur.yellow(`\n=> Deleting ${environment} ${deployment}`));

  const deploymentFile = path.resolve('deployment', 'environments', environment, 'services', `${deployment}.yml`);

  // Check for config file as it might not exist if the
  // deployment was dynamically created for a feature branch.
  if (fs.existsSync(deploymentFile)) {
    try {
      await execSyncInherit(`kubectl delete -f ${deploymentFile}`);
    } catch (e) {
      exit(e.message);
    }
  }
}

export async function checkDeployment(service, subservice) {
  const deployment = getDeployment(service, subservice);

  const deploymentInfoJSON = await exec(`kubectl get deployment ${deployment} -o json --ignore-not-found`);
  if (!deploymentInfoJSON) {
    console.info(kleur.yellow(`Deployment "${deployment}" could not be found`));
    return false;
  }
  return JSON.parse(deploymentInfoJSON);
}
