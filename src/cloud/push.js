import { exit } from '../util/exit';
import kleur from 'kleur';
import { exec } from '../util/shell';

async function pushImage(project, image, tag) {
  const gcrTag = `gcr.io/${project}/${image}:${tag}`;
  console.info(kleur.green(`Pushing ${gcrTag}`));
  await exec(`docker tag ${image}:${tag} ${gcrTag}`);
  const pushOutput = await exec(`docker push ${gcrTag}`);
  console.info(pushOutput.split('\n').slice(-1)[0]);
}

export async function dockerPush(project, platformName, service, subservice, tag) {
  try {
    const dockerImages = await exec(`docker images --format "{{json . }}"`);
    const dockerImagesJSON = dockerImages.split('\n').map((image) => {
      return JSON.parse(image.slice(1, -1));
    });
    const repositories = dockerImagesJSON
      .filter((image) => image.Tag == tag)
      .map((image) => image.Repository);

    let images = [];
    if (subservice) {
      images = repositories.filter(
        (repo) => repo == `${platformName}-services-${service}-${subservice}`
      );
    } else if (service) {
      images = repositories.filter((repo) => repo == `${platformName}-services-${service}`);
    } else {
      images = repositories.filter((repo) => repo.startsWith(`${platformName}-services-`));
    }

    console.info('Images:');
    console.info('-', images.join('\r\n- '));

    for (const image of images) {
      await pushImage(project, image, tag);
    }
  } catch (e) {
    exit(e.message);
  }
}
