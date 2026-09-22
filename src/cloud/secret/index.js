import os from 'os';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';

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
const TEMP_PREFIX = 'bedrock-secret-';

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

// Terminal editors only: GUI editors keep their own copy of every file they save,
// outside the temp directory bedrock cleans up.
const EDITORS = {
  vi: ['-n', '-i', 'NONE'],
  vim: ['-n', '-i', 'NONE'],
  nvim: ['-n', '-i', 'NONE'],
  nano: ['-I'],
  micro: [],
  hx: [],
  helix: [],
};

function getEditor() {
  const command = process.env.VISUAL || process.env.EDITOR || 'vi';
  const [program, ...args] = command.split(/\s+/);
  const name = path.basename(program);
  if (!(name in EDITORS)) {
    console.info(yellow(`Editor "${command}" is not supported. Set EDITOR to vim or nano, or edit key by key.`));
    return;
  }
  // Swap, backup, undo and history files would hold the values; vim writes them next
  // to the file unless configured otherwise, so they land in the temp directory too.
  const settings = name === 'nano' ? [] : ['-c', 'set nobackup nowritebackup noundofile noswapfile'];
  return [program, [...args, ...EDITORS[name], ...settings]];
}

// Leftovers from a previous run that was killed before it could clean up.
function sweepTempDirs() {
  for (const entry of readdirSync(os.tmpdir())) {
    if (entry.startsWith(TEMP_PREFIX)) rmSync(path.join(os.tmpdir(), entry), { recursive: true, force: true });
  }
}

function parseEnvFile(content) {
  const data = {};
  for (const [index, line] of content.split('\n').entries()) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const position = line.indexOf('=');
    const key = position === -1 ? '' : line.slice(0, position).trim();
    if (!KEY_PATTERN.test(key)) {
      console.info(red(`Line ${index + 1} is not KEY=value, nothing was changed`));
      return;
    }
    data[key] = Buffer.from(line.slice(position + 1), 'utf8').toString('base64');
  }
  return data;
}

/**
 * Edits all keys at once in a terminal editor. The values touch disk for as long as
 * the editor is open, in a private temp directory removed straight afterwards.
 */
function editInEditor(secretName, data) {
  const binary = Object.entries(data).find(([, value]) => {
    return Buffer.from(Buffer.from(value, 'base64').toString('utf8'), 'utf8').toString('base64') !== value;
  });
  if (binary) {
    console.info(yellow(`"${binary[0]}" holds binary data that an editor would corrupt. Change keys one by one.`));
    return;
  }
  const editor = getEditor();
  if (!editor) return;

  sweepTempDirs();
  const dir = mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  const filePath = path.join(dir, `${secretName}.conf`);
  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  // Signals and process.exit (from exit() or a cancelled prompt) skip the finally block.
  process.once('exit', cleanup);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, () => process.exit(130));

  try {
    const original = Object.entries(data)
      .map(([key, value]) => `${key}=${Buffer.from(value, 'base64').toString('utf8')}\n`)
      .join('');
    writeFileSync(filePath, original, { mode: 0o600 });
    const [program, args] = editor;
    const { status } = spawnSync(program, [...args, filePath], { stdio: 'inherit' });
    if (status !== 0) {
      console.info(yellow(`Editor exited with code ${status}, nothing was changed`));
      return;
    }
    const content = readFileSync(filePath, 'utf8');
    if (content === original) return { data, changed: false };
    const edited = parseEnvFile(content);
    return edited && { data: edited, changed: true };
  } finally {
    cleanup();
    process.removeListener('exit', cleanup);
  }
}

/**
 * Edits a secret key by key through prompts. Values live only in process memory:
 * nothing is written to disk or passed as a command argument.
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
      message: `Secret "${secretName}" (${keys.length} keys${changed ? ", unsaved changes" : ""}):`,
      choices: [
        ...(keys.length ? [{ title: 'Change key', value: 'change' }] : []),
        { title: 'Add key', value: 'add' },
        ...(keys.length
          ? [
              { title: 'Remove key', value: 'remove' },
              { title: 'View all', value: 'view' },
            ]
          : []),
        { title: 'Open in editor', value: 'editor' },
        { title: 'Save', value: 'save' },
      ],
    });

    if (action === 'save') {
      if (!changed) return console.info(yellow('No changes'));
      if (!Object.keys(data).length) return await deleteEmptySecret(secret, secretName);
      const confirmed = await prompt({
        type: 'confirm',
        name: 'save',
        message: `Save changes to secret "${secretName}" on ${environment}?`,
        initial: true,
      });
      if (confirmed && uploadSecret(secret, secretName, data)) return console.info(green(`Saved secret "${secretName}"`));
      continue;
    }
    if (action === 'view') {
      await viewSecretValues(secretName, data);
      continue;
    }
    if (action === 'editor') {
      const edited = editInEditor(secretName, data);
      if (edited) {
        for (const key of Object.keys(data)) delete data[key];
        Object.assign(data, edited.data);
        changed = changed || edited.changed;
      }
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
        : await prompt({
            type: 'select',
            message: 'Change key:',
            choices: keys.map((key) => ({ title: key, value: key })),
          });
    const message = `Value for ${key}${action === 'add' ? '' : ' (empty keeps current)'}:`;
    // Visible while typing; erased once entered, or on Esc/Ctrl-C via the exit handler, so it doesn't stay in scrollback.
    let typed = '';
    const erase = () => {
      if (!process.stdout.isTTY) return;
      const rows = Math.ceil((message.length + typed.length + 5) / process.stdout.columns);
      process.stdout.write(`\x1b[${rows}A\x1b[0J`);
    };
    process.once('exit', erase);
    const value = await prompt({ type: 'text', message, onState: (state) => (typed = state.value || '') });
    process.removeListener('exit', erase);
    erase();
    if (process.stdout.isTTY) console.info(green(`✔ ${value ? `${key} updated` : `${key} unchanged`}`));
    if (value) {
      data[key] = Buffer.from(value, 'utf8').toString('base64');
      changed = true;
    }
  }
}

async function deleteEmptySecret(secret, secretName) {
  if (!secret) return console.info(yellow('Secret has no keys, nothing created'));
  const confirmed = await prompt({
    type: 'confirm',
    name: 'delete',
    message: `Secret "${secretName}" has no keys left. Delete it from the cluster?`,
    initial: false,
  });
  if (confirmed) await deleteSecret(secretName);
  else console.info(yellow('Discarded changes'));
}

// Returns false when the upload failed but the edits can be retried.
function uploadSecret(secret, secretName, data) {
  let manifest = { apiVersion: 'v1', kind: 'Secret', type: 'Opaque', metadata: { name: secretName }, data };
  if (secret) {
    // Swap only data so every other field survives; the kept resourceVersion makes replace fail on concurrent saves.
    // The last-applied annotation holds a copy of the old data, so it is not carried over.
    const { managedFields: _managedFields, ...metadata } = secret.metadata;
    const { 'kubectl.kubernetes.io/last-applied-configuration': _lastApplied, ...annotations } = metadata.annotations || {};
    manifest = { ...secret, metadata: { ...metadata, annotations }, data };
  }
  try {
    execSync(`kubectl ${secret ? 'replace' : 'create'} -f -`, {
      input: JSON.stringify(manifest),
      stdio: ['pipe', 'inherit', 'pipe'],
    });
    return true;
  } catch (err) {
    const message = err.stderr?.toString().trim() || err.message;
    if (/Conflict|AlreadyExists|has been modified|already exists/.test(message)) {
      exit(`Secret "${secretName}" was changed by someone else while you were editing. Nothing was saved; run edit again.`);
    }
    console.error(red(message));
    console.info(yellow('Nothing was saved. Your changes are kept; choose Save to try again.'));
    return false;
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
