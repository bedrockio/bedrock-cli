import fs from 'fs';
import path from 'path';
import kleur from 'kleur';
import { getArchitecture, checkSubdeployment, checkPlatformName, checkTag } from './utils';
import { checkConfig } from './authorize';
import { execSyncInherit, withDir } from '../util/shell';
import { exit } from '../util/exit';
import sha from '../sha';

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
  console.info(kleur.yellow(`\n=> Remote build "${image}"`));
  console.info(kleur.gray(command));

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
      console.info(kleur.yellow(`Building with native architecture ${arch}.`));
    } else {
      platform = 'linux/amd64';
    }
  }
  const image = await getImage(options);
  const dockerfile = getDockerfile(options);
  const sha = await sha();

  const flags = [`--build-arg GIT_HASH=${sha}`,`-t ${image}`, `-f ${dockerfile}`, ...(platform ? [`--platform=${platform}`] : [])].join(' ');

  const command = `DOCKER_BUILDKIT=1 DOCKER_SCAN_SUGGEST=false docker build ${flags} .`;
  console.info(kleur.yellow(`\n=> Building "${image}"`));
  console.info(kleur.gray(command));

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
    console.info(kleur.gray('Running pre build hook...'));
    await execSyncInherit(`docker-hooks/pre-build ${environment} ${service}`);
  }
}
