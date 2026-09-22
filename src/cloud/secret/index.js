import os from 'os';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';

import { red, green, yellow } from 'kleur/colors';

import { exit } from '../../utils/flow.js';
import { prompt } from '../../utils/prompt.js';
import { assertBedrockRoot } from '../../utils/dir.js';
import { execSyncInherit } from '../../utils/shell.js';
import { getSecretNamePrompt, getAllSecretsPrompt, getSecretSubCommandPrompt, runKubectl } from '../utils.js';
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
  const secretJSON = await runKubectl(`kubectl get secret ${secretName} -o json --ignore-not-found`);
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

// Terminal editors only: GUI editors keep their own copy of every file they save,
// outside the directory bedrock removes.
const EDITORS = {
  vi: ['-n', '-i', 'NONE'],
  vim: ['-n', '-i', 'NONE'],
  nvim: ['-n', '-i', 'NONE'],
  // -I ignores nanorc, so a "set backup" there cannot leave a copy behind.
  nano: ['-I'],
};

function getEditor() {
  const command = process.env.VISUAL || process.env.EDITOR || 'vi';
  const [program, ...args] = command.split(/\s+/);
  const name = path.basename(program);
  if (!(name in EDITORS)) {
    console.info(yellow(`Editor "${command}" is not supported. Set EDITOR to vim or nano.`));
    return;
  }
  // Swap, backup, undo and history files would hold the values; vim writes them next
  // to the file unless configured otherwise, so they land in the temp directory too.
  const settings = name === 'nano' ? [] : ['-c', 'set nobackup nowritebackup noundofile noswapfile'];
  return [program, [...args, ...EDITORS[name], ...settings]];
}

function parseEnvFile(content) {
  const data = {};
  for (const [index, line] of content.split('\n').entries()) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const position = line.indexOf('=');
    const key = position === -1 ? '' : line.slice(0, position).trim();
    if (!KEY_PATTERN.test(key)) return { error: `line ${index + 1} is not KEY=value` };
    data[key] = Buffer.from(line.slice(position + 1), 'utf8').toString('base64');
  }
  return { data };
}

// Leftovers from a run that was killed before it could remove its own directory.
function sweepTempDirs() {
  for (const entry of readdirSync(os.tmpdir())) {
    if (entry.startsWith(TEMP_PREFIX)) rmSync(path.join(os.tmpdir(), entry), { recursive: true, force: true });
  }
}

/**
 * Opens every key in a terminal editor and uploads the file once the editor is
 * closed. The values are on disk only while the editor is open, in a private
 * directory removed straight afterwards.
 */
export async function editSecret(environment, secretName) {
  const secret = await getSecretInfo(secretName);
  // Unchanged values keep their original base64, so they are never decoded.
  const data = { ...(secret?.data || {}) };

  const binary = Object.entries(data).find(([, value]) => {
    return Buffer.from(Buffer.from(value, 'base64').toString('utf8'), 'utf8').toString('base64') !== value;
  });
  if (binary) return exit(`"${binary[0]}" holds binary data that an editor would corrupt. Edit it with kubectl instead.`);

  const editor = getEditor();
  if (!editor) return;

  console.info(yellow(`=> ${secret ? 'Editing' : 'Creating'} secret "${secretName}" on ${environment}`));

  sweepTempDirs();
  const dir = mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  const filePath = path.join(dir, `${secretName}.conf`);
  const release = () => rmSync(dir, { recursive: true, force: true });
  // Signals and process.exit (from exit() or a cancelled prompt) skip the finally block.
  process.once('exit', release);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, () => process.exit(130));

  const original = Object.entries(data)
    .map(([key, value]) => `${key}=${Buffer.from(value, 'base64').toString('utf8')}\n`)
    .join('');
  let content;

  try {
    writeFileSync(filePath, original, { mode: 0o600 });
    const [program, args] = editor;
    await new Promise((resolve) => spawn(program, [...args, filePath], { stdio: 'inherit' }).on('close', resolve));
    content = readFileSync(filePath, 'utf8');
  } finally {
    release();
    process.removeListener('exit', release);
  }

  if (content === original) return console.info(yellow('No changes'));
  const { data: edited, error } = parseEnvFile(content);
  if (error) return exit(`Nothing was saved: ${error}.`);
  if (!Object.keys(edited).length) return await deleteEmptySecret(secret, secretName);

  const result = uploadSecret(secret, secretName, edited);
  if (result.error) return exit(result.error);
  console.info(green(`Saved secret "${secretName}"`));
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

// Returns { secret } with the stored object, or { error } describing why it was refused.
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
    // The returned object carries the new resourceVersion, which the next write needs.
    const stored = execSync(`kubectl ${secret ? 'replace' : 'create'} -f - -o json`, {
      input: JSON.stringify(manifest),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { secret: JSON.parse(stored.toString()) };
  } catch (err) {
    const message = err.stderr?.toString().trim() || err.message;
    if (/Conflict|AlreadyExists|has been modified|already exists/.test(message)) {
      return { error: `Secret "${secretName}" was changed by someone else, so nothing was saved. Run edit again.` };
    }
    return { error: `Nothing was saved: ${message}` };
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
