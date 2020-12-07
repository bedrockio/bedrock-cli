import execa from 'execa';
import { execSync } from 'child_process';

export async function exec(commands, std = `stdout`) {
  try {
    if (typeof commands === 'string') {
      commands = [commands];
    }
    let output = '';
    for (let command of commands) {
      const [first, ...rest] = command.match(/".+"|\S+/g);
      const execResult = await execa(first, rest);
      output = std == 'stderr' ? execResult.stderr : execResult.stdout;
    }
    return output;
  } catch (err) {
    const { stderr, stdout } = err;
    const message = (stderr || stdout).split('\n').join(' ');
    throw new Error(message);
  }
}

export async function execSyncInherit(command) {
  await execSync(command, { stdio: 'inherit' });
}

export async function execSyncPipe(command) {
  return await execSync(command, { stdio: 'pipe', encoding: 'utf-8' });
}
