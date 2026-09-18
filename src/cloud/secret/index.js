import { execSync } from 'child_process';

import { red, green, yellow } from 'kleur/colors';

import { exit } from '../../utils/flow.js';
import { prompt } from '../../utils/prompt.js';
import { assertBedrockRoot } from '../../utils/dir.js';
import { exec, execSyncInherit } from '../../utils/shell.js';
import { getSecretNamePrompt, getAllSecretsPrompt, getSecretSubCommandPrompt } from '../utils.js';
import { checkConfig } from '../authorize.js';

export async function secretEdit(options) {
  await secret(options, 'edit');
}

export async function secretInfo(options) {
  await secret(options, 'info');
}

export async function secretDelete(options) {
  await secret(options, 'delete');
}

export default async function secret(options, subcommand) {
  await assertBedrockRoot();
  await checkConfig(options);

  // Invoked as `bedrock cloud secret`, the CLI passes the command descriptor instead of a subcommand name.
  if (typeof subcommand !== 'string') subcommand = await getSecretSubCommandPrompt();

  if (subcommand == 'edit') {
    const secretName = options.name || (await getSecretNamePrompt());
    await editSecret(options.environment, secretName);
  } else if (subcommand == 'info') {
    const secretName = options.name || (await getAllSecretsPrompt());
    console.info(yellow(`=> Retrieving secret`));
    const secretInfo = await getSecretInfo(secretName);
    if (secretInfo) {
      secretInfo.dataKeys = Object.keys(secretInfo.data || {});
      secretInfo.data = `*** hidden to avoid sensitive information in your shell history ***`;
      console.info(secretInfo);
      console.info(yellow(`Note: Run 'bedrock cloud secret edit' to view or change values`));
    } else {
      console.info(yellow(`Could not find secret "${secretName}"`));
    }
  } else if (subcommand == 'delete') {
    const secretName = options.name || (await getAllSecretsPrompt());
    await deleteSecret(secretName);
  }
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

const KEY_PATTERN = /^[-._a-zA-Z0-9]+$/;

// Refusing non-TTY output keeps values out of pipes, logs and agent shells; the
// alternate screen keeps them out of scrollback once dismissed.
async function viewSecretValues(secretName, data) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) exit('Viewing values requires an interactive terminal.');
  const leaveAltScreen = () => process.stdout.write('\x1b[?1049l');
  process.once('exit', leaveAltScreen);
  process.stdout.write('\x1b[?1049h\x1b[H');
  console.info(yellow(`Secret "${secretName}"\n`));
  for (const [key, value] of Object.entries(data)) {
    console.info(`${key}=${Buffer.from(value, 'base64').toString('utf8')}`);
  }
  console.info('');
  await prompt({ type: 'invisible', message: 'Press Enter to hide values' });
  leaveAltScreen();
  process.removeListener('exit', leaveAltScreen);
}

/**
 * Edits a secret key by key through hidden prompts. Values live only in process
 * memory: nothing is written to disk, shown on screen or passed as an argument.
 */
export async function editSecret(environment, secretName) {
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
        ...(keys.length
          ? [
              { title: 'Remove key', value: 'remove' },
              { title: 'View values', value: 'view' },
            ]
          : []),
        { title: 'Save', value: 'save' },
      ],
    });

    if (action === 'save') {
      // No changes and removing every key are handled after the loop.
      if (!changed || !Object.keys(data).length) break;
      const confirmed = await prompt({
        type: 'confirm',
        name: 'save',
        message: `Save changes to secret "${secretName}" on ${environment}?`,
        initial: true,
      });
      if (confirmed) break;
      continue;
    }
    if (action === 'view') {
      await viewSecretValues(secretName, data);
      continue;
    }

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
      type: 'invisible',
      message: `Value for ${key}${action === 'add' ? '' : ' (empty keeps current)'}:`,
    });
    if (value) {
      data[key] = Buffer.from(value, 'utf8').toString('base64');
      changed = true;
    }
  }

  if (!changed) return console.info(yellow('No changes'));
  if (!Object.keys(data).length) {
    if (!secret) return console.info(yellow('Secret has no keys, nothing created'));
    const confirmed = await prompt({
      type: 'confirm',
      name: 'delete',
      message: `Secret "${secretName}" has no keys left. Delete it from the cluster?`,
      initial: false,
    });
    if (confirmed) await deleteSecret(secretName);
    else console.info(yellow('Discarded changes'));
    return;
  }

  // replace/create send the full object without a last-applied annotation, which would hold a copy of the data.
  const manifest = { apiVersion: 'v1', kind: 'Secret', type: 'Opaque', metadata: { name: secretName }, data };
  execSync(`kubectl ${secret ? 'replace' : 'create'} -f -`, {
    input: JSON.stringify(manifest),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  console.info(green(`Saved secret "${secretName}"`));
}

export async function deleteSecret(secretName) {
  const secret = await getSecretInfo(secretName);
  if (!secret) {
    return console.info(yellow(`Could not find secret "${secretName}"`));
  }
  console.info(yellow(`=> Deleting secret`));
  await execSyncInherit(`kubectl delete secret ${secretName} --ignore-not-found`);
}
