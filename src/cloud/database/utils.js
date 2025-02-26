import { pick, kebabCase } from 'lodash-es';

import { runCommand } from '../utils.js';
import { getRemoteCommand } from '../utils.js';

const PREPARE_SCRIPT = 'scripts/database/prepare-export.js';
const REMOTE_OPTIONS = ['createdAfter', 'createdBefore', 'limit', 'userId', 'email', 'exclude', 'raw', 'out'];

export async function runDatabaseExport(title, options) {
  const { cliPod } = options;
  const rOptions = pick(options, REMOTE_OPTIONS);
  const flags = Object.entries(rOptions).map(([name, value]) => {
    name = `--${kebabCase(name)}`;
    return value === true ? name : `${name} ${value}`;
  });

  let command;

  command = getRemoteCommand(cliPod, `node ${PREPARE_SCRIPT} ${flags.join(' ')}`);

  await runCommand(title, command);
}
