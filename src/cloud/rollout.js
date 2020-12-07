import kleur from 'kleur';
import { exec, execSyncInherit } from '../util/shell';
import fs from 'fs';
import path from 'path';

export function getDeployment(service, subservice) {
  let deployment = service;
  if (subservice) deployment += `-${subservice}`;
  deployment += '-deployment';
  return deployment;
}

async function getTag() {
  let tag = await exec('git tag --points-at HEAD');
  if (!tag) tag = await exec('git rev-parse --short --verify HEAD');
  const stat = await exec('git diff --stat');
  if (stat) tag += '-dirty';
  return tag;
}

async function getMetaData() {
  const author = await exec('git config user.name');
  const date = new Date().toUTCString();
  const branch = await exec('git branch --show-current');
  const git = await getTag();
  let fields = `\\"author\\":\\"${author}\\"`;
  fields += `,\\"date\\":\\"${date}\\"`;
  fields += `,\\"branch\\":\\"${branch}\\"`;
  fields += `,\\"git\\":\\"${git}\\"`;
  const metaData = `{\\"spec\\":{\\"template\\":{\\"metadata\\":{\\"annotations\\":{${fields}}}}}}`;
  return metaData;
}

export async function rolloutDeployment(environment, service, subservice) {
  const deployment = getDeployment(service, subservice);
  console.info(kleur.yellow(`\n=> Rolling out ${environment} ${deployment}`));

  const deploymentFile = path.resolve(
    'deployment',
    'environments',
    environment,
    'services',
    `${deployment}.yml`
  );

  // Check for config file as it might not exist if the
  // deployment was dynamically created for a feature branch.
  if (fs.existsSync(deploymentFile)) {
    const applyCommand = `kubectl apply -f ${deploymentFile} --record`;
    // console.info(applyCommand);
    await execSyncInherit(applyCommand);
  }

  const metaData = await getMetaData();
  // Patching spec.template forces the container to pull the latest image and
  // perform a rolling update as long as imagePullPolicy: Always is specified.
  const patchCommand = `kubectl patch deployment ${deployment} -p "${metaData}" --record`;
  // console.info(patchCommand);
  execSyncInherit(patchCommand);
}
