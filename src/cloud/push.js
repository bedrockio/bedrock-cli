import kleur from 'kleur';
import logger from '@bedrockio/logger';

import { exit } from '../utils/exit.js';
import { exec, execSyncInherit } from '../utils/shell.js';

async function pushImage(project, image, tag, gcrPrefix = '') {
  const gcrTag = `gcr.io/${project}/${gcrPrefix + image}:${tag}`;
  logger.info(kleur.green(`Pushing ${gcrTag}`));
  await exec(`docker tag ${image}:${tag} ${gcrTag}`);
  try {
    await execSyncInherit(`docker push ${gcrTag}`);
  } catch (e) {
    logger.info(
      kleur.yellow(
        "If You don't have the needed permissions to perform this operation, then run: 'gcloud auth configure-docker'",
      ),
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

    images.length ? logger.info(kleur.yellow('\n=> Pushing images:')) : logger.info(kleur.yellow('No images found'));
    images.forEach((image) => logger.info('-', image));

    for (const image of images) {
      await pushImage(project, image, tag, gcrPrefix);
    }
  } catch (e) {
    exit(e.message);
  }
}
