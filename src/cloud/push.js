import { exit } from '../util/exit';
import kleur from 'kleur';
import { exec, execSyncInherit } from '../util/shell';

async function pushImage(project, image, tag) {
  const gcrTag = `gcr.io/${project}/${image}:${tag}`;
  console.info(kleur.green(`Pushing ${gcrTag}`));
  await exec(`docker tag ${image}:${tag} ${gcrTag}`);
  try {
    await execSyncInherit(`docker push ${gcrTag}`);
  } catch (e) {
    console.info(
      kleur.yellow(
        "If You don't have the needed permissions to perform this operation, then run: 'gcloud auth configure-docker'"
      )
    );
    exit(e.message);
  }
}

export async function dockerPush(options) {
  const { project, service, subservice, platformName, tag = 'latest' } = options;

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

    images.length ? console.info(kleur.yellow('\n=> Pushing images:')) : console.info(kleur.yellow('No images found'));
    images.forEach((image) => console.info('-', image));

    for (const image of images) {
      await pushImage(project, image, tag);
    }
  } catch (e) {
    exit(e.message);
  }
}
