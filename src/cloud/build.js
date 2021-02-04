import fs from 'fs';
import path from 'path';
import kleur from 'kleur';
import { execSyncInherit, withDir } from '../util/shell';
import { exit } from '../util/exit';

export async function buildImage(platformName, service, subservice, tag = 'latest') {
  const serviceDir = path.resolve('services', service);
  if (!fs.existsSync(serviceDir)) {
    exit(`Service ${service} does not exist`);
  }

  await withDir(serviceDir, async () => {
    if (!subservice) {
      const imageName = `${platformName}-services-${service}:${tag}`;
      console.info(kleur.yellow(`\n=> Building "${imageName}"`));
      try {
        await execSyncInherit(`docker build -t ${imageName} .`);
      } catch (e) {
        exit(e.message);
      }
    } else {
      const imageName = `${platformName}-services-${service}-${subservice}:${tag}`;
      console.info(kleur.yellow(`\n=> Building "${imageName}"`));
      if (!fs.existsSync(`Dockerfile.${subservice}`)) {
        exit(`Subservice does not exist. Dockerfile.${subservice} is missing`);
      }
      try {
        await execSyncInherit(`docker build -t ${imageName} -f Dockerfile.${subservice} .`);
      } catch (e) {
        exit(e.message);
      }
    }
  });

}
