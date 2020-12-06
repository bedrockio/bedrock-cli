import kleur from 'kleur';
import { exec } from '../util/shell';

export async function buildImage(platformName, service, subservice, tag = 'latest') {
  await process.chdir('./services/api');
  if (!subservice) {
    const imageName = `${platformName}-services-${service}:${tag}`;
    console.info(kleur.yellow(`\n=> Building "${imageName}"`));
    require('child_process').execSync(`docker build -t ${imageName} .`, { stdio: 'inherit' });
  } else {
    const imageName = `${platformName}-services-${service}-${subservice}:${tag}`;
    console.info(kleur.yellow(`\n=> Building "${imageName}"`));
    require('child_process').execSync(
      `docker build -t ${imageName} -f Dockerfile.${subservice} .`,
      { stdio: 'inherit' }
    );
  }
  await process.chdir('../..');
}
