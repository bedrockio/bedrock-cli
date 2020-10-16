import execa from 'execa';

export async function exec(commands) {
  try {
    if (typeof commands === 'string') {
      commands = [commands];
    }
    let output = '';
    for (let command of commands) {
      const [first, ...rest] = command.match(/".+"|\S+/g);
      output = (await execa(first, rest)).stdout;
    }
    return output;
  } catch(err) {
    const { stderr, stdout } = err;
    const message = (stderr || stdout).split('\n').join(' ');
    throw new Error(message);
  }
}
