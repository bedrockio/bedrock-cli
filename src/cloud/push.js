import { green } from 'kleur/colors';

import { exit, warn } from '../utils/flow.js';
import { exec, execSyncInherit } from '../utils/shell.js';

async function pushImage(project, image, tag, gcrPrefix = '') {
  const gcrTag = `gcr.io/${project}/${gcrPrefix + image}:${tag}`;
  console.info(green(`Pushing ${gcrTag}`));
  await exec(`docker tag ${image}:${tag} ${gcrTag}`);
  try {
    await execSyncInherit(`docker push ${gcrTag}`);
  } catch (e) {
    warn(
      "If You don't have the needed permissions to perform this operation, then run: 'gcloud auth configure-docker'",
    );
    exit(e.message);
  }
}

export async function dockerPush(options) {
  const { project, service, subservice, platformName, config, tag = 'latest' } = options;
  const gcrPrefix = (config && config.gcloud && config.gcloud.gcrPrefix) || '';

  try {
    const dockerImages = await exec(`docker images --format "{{json . }}"`);
    const dockerImagesJSON = dockerImages.split('\n').map((image) => {
      return JSON.parse(image.slice(1, -1));
    });
    const repositories = dockerImagesJSON.filter((image) => image.Tag == tag).map((image) => image.Repository);

    let images = [];
    if (subservice) {
      images = repositories.filter((repo) => repo == `${platformName}-services-${service}-${subservice}`);
    } else if (service) {
      images = repositories.filter((repo) => repo == `${platformName}-services-${service}`);
    } else {
      images = repositories.filter((repo) => repo.startsWith(`${platformName}-services-`));
    }

    warn(images.length ? '\n=> Pushing images:' : 'No images found');
    images.forEach((image) => console.info('-', image));

    for (const image of images) {
      await pushImage(project, image, tag, gcrPrefix);
    }
  } catch (e) {
    exit(e.message);
  }
}
