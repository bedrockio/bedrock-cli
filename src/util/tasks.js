import Listr from 'listr';
import { red } from 'kleur';

export async function runAsTask(title, fn) {
  try {
    return await runTask(title, fn);
  } catch(err) {
    console.log(red('Fatal error, exiting...'));
    process.exit(1);
  }
}

export async function runAsOptionalTask(title, fn) {
  try {
    return await runTask(title, fn);
  } catch(err) {
    // Do nothing
  }
}

async function runTask(title, fn) {
  let captured;
  const tasks = new Listr([
    {
      title,
      task: async () => {
        captured = await fn();
      },
    },
  ]);
  await tasks.run();
  return captured;
}
