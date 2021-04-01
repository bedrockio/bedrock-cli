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
    const message = (stderr || stdout).split('\n').join(' ') || err.message;
    throw new Error(message);
  }
}

// Use when you need to pass through the corresponding stdio stream to the Node.js script output.
// This facilitates live updates to the output, e.g., when "watching" output or pushing docker images.
// See: https://stackoverflow.com/a/31104898
export async function execSyncInherit(command) {
  await execSync(command, { stdio: 'inherit' });
}

export async function withDir(dir, fn) {
  const lastDir = process.cwd();
  process.chdir(dir);
  await fn();
  process.chdir(lastDir);
}

// Synchronous form is needed to be used inside concurrent tasks. Using withDir
// inside concurrent tasks isn't recommended as process.chdir introduces state,
// however may be required when combined with require().
export function withDirSync(dir, fn) {
  const lastDir = process.cwd();
  process.chdir(dir);
  fn();
  process.chdir(lastDir);
}
