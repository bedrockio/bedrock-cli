import fs from 'fs';
import path from 'path';
import kleur from 'kleur';
import { execSyncInherit, withDir } from '../util/shell';
import { exit } from '../util/exit';

export async function buildImage(options) {
  const { service, remote } = options;
  const serviceDir = path.resolve('services', service);

  if (!fs.existsSync(serviceDir)) {
    exit(`Service ${service} does not exist`);
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
  const image = getImage(options);
  const dockerfile = getDockerfile(options);

  let command = 'gcloud builds submit';
  command += ` --config ${path.resolve(__dirname, 'cloudbuild.yaml')}`;
  command += ` --substitutions _IMAGE=${image},_DOCKERFILE=${dockerfile}`;

  try {
    await execSyncInherit(command);
  } catch (e) {
    exit(e.message);
  }
}

async function buildImageLocal(options) {
  const image = getImage(options);
  const dockerfile = getDockerfile(options);
  console.info(kleur.yellow(`\n=> Building "${image}"`));
  try {
    await execSyncInherit(`docker build -t ${image} -f ${dockerfile} .`);
  } catch (e) {
    exit(e.message);
  }
}

// Gets the full image name plus tag.
function getImage(options) {
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
