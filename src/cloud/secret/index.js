import path from 'path';
import { execSync } from 'child_process';
import { existsSync, unlinkSync, mkdirSync, writeFileSync } from 'fs';

import { red, green, yellow } from 'kleur/colors';

import { exit } from '../../utils/flow.js';
import { prompt } from '../../utils/prompt.js';
import { getSecretsDirectory } from '../utils.js';
import { assertBedrockRoot } from '../../utils/dir.js';
import { exec, execSyncInherit } from '../../utils/shell.js';
import { getSecretNamePrompt, getAllSecretsPrompt, getSecretSubCommandPrompt } from '../utils.js';
import { checkConfig } from '../authorize.js';

export async function secretEdit(options) {
  await secret(options, 'edit');
}

export async function secretGet(options) {
  await secret(options, 'get');
}

export async function secretSet(options) {
  await secret(options, 'set');
}

export async function secretInfo(options) {
  await secret(options, 'info');
}

export async function secretDelete(options) {
  await secret(options, 'delete');
}

export default async function secret(options, subcommand) {
  await assertBedrockRoot();
  await checkConfig(options, { skipSecretsCheck: true });
  const { environment } = options;

  // Invoked as `bedrock cloud secret`, the CLI passes the command descriptor instead of a subcommand name.
  if (typeof subcommand !== 'string') subcommand = await getSecretSubCommandPrompt();

  if (subcommand == 'edit') {
    const secretName = options.name || (await getSecretNamePrompt());
    await editSecret(secretName);
  } else if (subcommand == 'get') {
    const secretName = options.name || (await getAllSecretsPrompt());
    console.info(yellow(`=> Retrieving secret`));
    await getSecret(environment, secretName);
  } else if (subcommand == 'set') {
    const secretName = options.name || (await getSecretNamePrompt());
    await setSecret(environment, secretName);
  } else if (subcommand == 'info') {
    const secretName = options.name || (await getAllSecretsPrompt());
    console.info(yellow(`=> Retrieving secret`));
    const secretInfo = await getSecretInfo(secretName);
    if (secretInfo) {
      secretInfo.dataKeys = Object.keys(secretInfo.data || {});
      secretInfo.data = `*** hidden to avoid sensitive information in your shell history ***`;
      console.info(secretInfo);
      console.info(yellow(`Note: Run 'bedrock cloud secret edit' to change the secret without writing it to disk`));
    } else {
      console.info(yellow(`Could not find secret "${secretName}"`));
    }
  } else if (subcommand == 'delete') {
    const secretName = options.name || (await getAllSecretsPrompt());
    await deleteSecret(secretName);
  }
}

export function decryptSecretData(secret) {
  let decryptedData = {};
  for (const field of Object.keys(secret.data)) {
    let buff = Buffer.from(secret.data[field], 'base64');
    let value = buff.toString('ascii');
    decryptedData[field] = value;
  }
  return decryptedData;
}

export async function getSecretInfo(secretName) {
  const secretJSON = await exec(`kubectl get secret ${secretName} -o json --ignore-not-found`);
  if (!secretJSON) return;
  try {
    return JSON.parse(secretJSON);
  } catch {
    console.info(red(`Could not parse secret ${secretName}`));
    return;
  }
}

export async function getSecret(environment, secretName) {
  const secret = await getSecretInfo(secretName);
  if (!secret) {
    return console.info(yellow(`Could not find secret "${secretName}"`));
  }
  if (!secret.data) return console.info(yellow(`Secret.data is empty`));

  const secretInfo = { ...secret };
  secretInfo.dataKeys = Object.keys(secretInfo.data);
  secretInfo.data = `*** hidden to avoid sensitive information in your shell history ***`;
  console.info(secretInfo);

  // mkdir (if not exists)
  const secretDir = getSecretsDirectory(environment);

  if (!existsSync(secretDir)) {
    console.info(yellow('=> Creating secrets folder'));
    mkdirSync(secretDir);
  }
  // write to file
  const filePath = path.join(secretDir, `${secretName}.conf`);
  console.info(yellow(`=> Creating ${secretName}.conf`));

  writeFileSync(filePath, toEnvFile(decryptSecretData(secret)));
  console.info(green(`Saved secret to "${filePath}" - make sure to REMOVE THE FILE once you've made your changes`));
}

function toEnvFile(data) {
  return Object.entries(data)
    .map(([field, value]) => `${field}=${value}\n`)
    .join('');
}

const KEY_PATTERN = /^[-._a-zA-Z0-9]+$/;

/**
 * Edits a secret key by key through masked prompts. Values live only in process
 * memory: nothing is written to disk, shown on screen or passed as an argument.
 */
export async function editSecret(secretName) {
  const secret = await getSecretInfo(secretName);
  // Unchanged values keep their original base64, so they are never decoded.
  const data = { ...(secret?.data || {}) };
  let changed = false;

  console.info(yellow(secret ? `=> Editing secret "${secretName}"` : `=> Creating secret "${secretName}"`));

  while (true) {
    const keys = Object.keys(data);
    const action = await prompt({
      type: 'select',
      message: `Secret "${secretName}" (${keys.length} keys):`,
      choices: [
        ...keys.map((key) => ({ title: `Change ${key}`, value: { key } })),
        { title: 'Add key', value: 'add' },
        ...(keys.length ? [{ title: 'Remove key', value: 'remove' }] : []),
        { title: 'Save and upload', value: 'save' },
        { title: 'Cancel', value: 'cancel' },
      ],
    });

    if (action === 'cancel') return console.info(yellow('Discarded changes'));
    if (action === 'save') break;

    if (action === 'remove') {
      const key = await prompt({
        type: 'select',
        message: 'Remove key:',
        choices: keys.map((key) => ({ title: key, value: key })),
      });
      delete data[key];
      changed = true;
      continue;
    }

    const key =
      action === 'add'
        ? await prompt({
            type: 'text',
            message: 'Key name:',
            validate: (value) =>
              !KEY_PATTERN.test(value)
                ? 'Use only letters, numbers, "-", "_" or "."'
                : keys.includes(value)
                  ? `"${value}" already exists`
                  : true,
          })
        : action.key;
    const value = await prompt({
      type: 'password',
      message: `Value for ${key}${action === 'add' ? '' : ' (empty keeps current)'}:`,
    });
    if (value) {
      data[key] = Buffer.from(value, 'utf8').toString('base64');
      changed = true;
    }
  }

  if (!changed) return console.info(yellow('No changes'));
  if (!Object.keys(data).length) exit('Secret has no keys, nothing uploaded. Use "bedrock cloud secret delete" to remove it.');

  // replace/create send the full object without a last-applied annotation, which would hold a copy of the data.
  const manifest = { apiVersion: 'v1', kind: 'Secret', type: 'Opaque', metadata: { name: secretName }, data };
  execSync(`kubectl ${secret ? 'replace' : 'create'} -f -`, {
    input: JSON.stringify(manifest),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  console.info(green(`Uploaded secret "${secretName}"`));
}

export async function setSecret(environment, secretName, confirmPrompt = true) {
  const secretJoinedPath = path.join('deployment', 'environments', environment, 'secrets', `${secretName}.conf`);
  const secretFilePath = path.resolve(secretJoinedPath);

  if (existsSync(secretFilePath)) {
    console.info(yellow(`=> Creating secret`));
    await execSyncInherit(`kubectl delete secret ${secretName} --ignore-not-found`);
    await execSyncInherit(`kubectl create secret generic ${secretName} --from-env-file=${secretFilePath}`);
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
    } catch {
      exit(`Failed to deleted ${secretFilePath}`);
    }
    console.info(green(`Deleted ${secretJoinedPath}`));
  } else {
    exit(`Could not find secret, file path: "${secretFilePath}"`);
  }
}

export async function deleteSecret(secretName) {
  const secret = await getSecretInfo(secretName);
  if (!secret) {
    return console.info(yellow(`Could not find secret "${secretName}"`));
  }
  console.info(yellow(`=> Deleting secret`));
  await execSyncInherit(`kubectl delete secret ${secretName} --ignore-not-found`);
}
