import path from 'path';
import { existsSync, unlinkSync, mkdirSync, writeFileSync } from 'fs';
import { red, green, yellow } from 'kleur';
import { exit } from '../util/exit';
import { exec, execSyncInherit } from '../util/shell';
import { prompt } from '../util/prompt';
import { getSecretsDirectory } from './utils';

export async function getSecretInfo(secretName) {
  const secretJSON = await exec(`kubectl get secret ${secretName} -o json --ignore-not-found`);
  if (!secretJSON) return;
  try {
    return JSON.parse(secretJSON);
  } catch (e) {
    console.info(red(`Could not parse secret ${secretName}`));
    return;
  }
}

export async function getSecret(environment, secretName) {
  console.info(yellow(`=> Retrieving secret`));
  const secret = await getSecretInfo(secretName);
  if (!secret) return console.info(yellow(`Could not find secret "${secretName}"`));
  console.info(secret);
  if (!secret.data) return console.info(yellow(`Secret.data is empty"`));

  // mkdir (if not exists)
  const secretDir = getSecretsDirectory(environment);

  if (!existsSync(secretDir)) {
    console.info(yellow('=> Creating secrets folder'));
    mkdirSync(secretDir);
  }
  // write to file
  const filePath = path.join(secretDir, `${secretName}.conf`);
  console.info(yellow(`=> Creating ${secretName}.conf`));
  let data = '';
  for (const field of Object.keys(secret.data)) {
    let buff = Buffer.from(secret.data[field], 'base64');
    let value = buff.toString('ascii');

    data += `${field}=${value}\n`;
  }
  writeFileSync(filePath, data);
  console.info(
    green(
      `Saved secret to "${filePath}" - make sure to REMOVE THE FILE once you've made your changes`
    )
  );
}

export async function setSecret(environment, secretName, confirmPrompt = true) {
  const secretJoinedPath = path.join(
    'deployment',
    'environments',
    environment,
    'secrets',
    `${secretName}.conf`
  );
  const secretFilePath = path.resolve(secretJoinedPath);

  if (existsSync(secretFilePath)) {
    console.info(yellow(`=> Creating secret`));
    await execSyncInherit(`kubectl delete secret ${secretName} --ignore-not-found`);
    await execSyncInherit(
      `kubectl create secret generic ${secretName} --from-env-file=${secretFilePath}`
    );
    console.info(green(`Uploaded secrets from ${secretJoinedPath}`));
    if (confirmPrompt) {
      let confirmed = await prompt({
        type: 'confirm',
        name: 'delete',
        message:
          'We suggest to delete your secret locally. You can always retrieve it again with "bedrock cloud secret get <secretName>". Do you like to delete it now?',
        initial: true,
      });
      if (!confirmed) process.exit(0);
    }
    try {
      unlinkSync(secretFilePath);
    } catch (e) {
      exit(`Failed to deleted ${secretFilePath}`);
    }
    console.info(green(`Deleted ${secretJoinedPath}`));
  } else {
    exit(`Could not find secret, file path: "${secretFilePath}"`);
  }
}

export async function deleteSecret(secretName) {
  const secret = await getSecretInfo(secretName);
  if (!secret) return console.info(yellow(`Could not find secret "${secretName}"`));
  console.info(yellow(`=> Deleting secret`));
  await execSyncInherit(`kubectl delete secret ${secretName} --ignore-not-found`);
}
