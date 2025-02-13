import fs from 'fs';
import path from 'path';

import kleur from 'kleur';
import logger from '@bedrockio/logger';

import { getRef } from '../util/git.js';
import { exit } from '../util/exit.js';
import { execSyncInherit, withDir } from '../util/shell.js';
import { checkConfig } from './authorize.js';
import { checkPlatformName, checkSubdeployment, checkTag, getArchitecture } from './utils.js';

export async function buildImage(options) {
  const { service, remote } = options;
  const serviceDir = path.resolve('services', service);

  if (!fs.existsSync(serviceDir)) {
    exit(`Service ${service} does not exist`);
  }

  if (options.remote) {
    await checkConfig(options);
  }

  await withDir(serviceDir, async () => {
    if (remote) {
      return await buildImageRemote(options);
    } else {
      return await buildImageLocal(options);
    }
  });
}

async function buildImageRemote(options) {
  await checkSubdeployment(options);

  const image = await getImage(options);
  const dockerfile = getDockerfile(options);

  const flags = [
    `--config ${path.resolve(__dirname, 'cloudbuild.yaml')}`,
    `--substitutions _IMAGE=${image},_DOCKERFILE=${dockerfile}`,
  ].join(' ');

  const command = `gcloud builds submit ${flags}`;
  logger.info(kleur.yellow(`\n=> Remote build "${image}"`));
  logger.info(kleur.gray(command));

  try {
    await runPreDeployHook(options);
    await execSyncInherit(command);
  } catch (e) {
    exit(e.message);
  }
}
async function buildImageLocal(options) {
  const arch = getArchitecture();
  let platform;

  // Assume x86_64 architecture. This could potentially be derived
  // from a gcloud command if necessary.
  if (arch !== 'x64') {
    if (options.native) {
      logger.info(kleur.yellow(`Building with native architecture ${arch}.`));
    } else {
      platform = 'linux/amd64';
    }
  }
  const image = await getImage(options);
  const dockerfile = getDockerfile(options);
  const ref = await getRef();

  const flags = [
    `--build-arg GIT_HASH=${ref}`,
    `-t ${image}`,
    `-f ${dockerfile}`,
    ...(platform ? [`--platform=${platform}`] : []),
  ].join(' ');

  const command = `DOCKER_BUILDKIT=1 DOCKER_SCAN_SUGGEST=false docker build ${flags} .`;
  logger.info(kleur.yellow(`\n=> Building "${image}"`));
  logger.info(kleur.gray(command));

  try {
    await runPreDeployHook(options);
    await execSyncInherit(command);
  } catch (e) {
    exit(e.message);
  }
}

// Gets the full image name plus tag.
async function getImage(options) {
  await checkPlatformName(options);
  await checkTag(options);
  const { service, subservice, platformName, tag = 'latest' } = options;
  let name = `${platformName}-services-${service}`;
  if (subservice) {
    name += `-${subservice}`;
  }
  name += `:${tag}`;
  return name;
}

function getDockerfile(options) {
  const { subservice } = options;
  let filename = `Dockerfile`;
  if (subservice) {
    filename += `.${subservice}`;
  }
  if (!fs.existsSync(filename)) {
    exit(`Service does not exist. ${filename} is missing`);
  }
  return filename;
}

async function runPreDeployHook(options) {
  if (fs.existsSync('docker-hooks/pre-build')) {
    const { environment, service } = options;
    logger.info(kleur.gray('Running pre build hook...'));
    await execSyncInherit(`docker-hooks/pre-build ${environment} ${service}`);
  }
}
