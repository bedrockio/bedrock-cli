import kleur from 'kleur';
import { execSyncInherit } from '../util/shell';

export async function buildImage(platformName, service, subservice, tag = 'latest') {
  await process.chdir('./services/api');
  if (!subservice) {
    const imageName = `${platformName}-services-${service}:${tag}`;
    console.info(kleur.yellow(`\n=> Building "${imageName}"`));
    execSyncInherit(`docker build -t ${imageName} .`);
  } else {
    const imageName = `${platformName}-services-${service}-${subservice}:${tag}`;
    console.info(kleur.yellow(`\n=> Building "${imageName}"`));
    execSyncInherit(`docker build -t ${imageName} -f Dockerfile.${subservice} .`);
  }
  await process.chdir('../..');
}
