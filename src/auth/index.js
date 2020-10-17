import kleur from 'kleur';
import { prompt } from '../util/prompt';
import { request, loadCredentials, writeCredentials } from '../util/api';

export async function login(options) {
  const credentials = await loadCredentials();
  const { email } = options;
  const password = await prompt({
    type: 'password',
    name: 'password',
    message: 'Enter password:',
  });
  try {
    const token = await getToken(email, password);
    const { id, name } = await getUser(token);
    credentials[id] = {
      name,
      email,
      token,
    };
    credentials.current = id;
    await writeCredentials(credentials);
    console.log(kleur.yellow('Successfully logged in!'));
  } catch(err) {
    console.log(kleur.red(`Unable to login: ${err.message}`));
  }
}

export async function list() {
  let accounts = await getAccounts();
  accounts = accounts.map(({ name, email, current }) => {
    return `${current ? kleur.cyan('❯') : ' ' } ${name} ${kleur.dim(`<${email}>`)}`;
  });
  console.log(kleur.white(accounts.join('\n')));
}

export async function set() {
  const accounts = await getAccounts();
  const id = await prompt({
    type: 'select',
    message: 'Select current account',
    initial: accounts.findIndex((a) => a.current),
    choices: accounts.map(({ id, name, email }) => {
      let title = name;
      title += kleur.reset().dim(` <${email}>`);
      return {
        title,
        value: id,
      }
    }),
  });
  const credentials = await loadCredentials();
  const account = credentials[id];
  credentials.current = id;
  await writeCredentials(credentials);
  console.log(kleur.yellow(`Set logged in user to ${account.name}.`));
}

export async function remove() {
  const accounts = await getAccounts();
  const id = await prompt({
    type: 'select',
    message: 'Select account to remove',
    choices: accounts.map(({ id, name, email }) => {
      let title = name;
      title += kleur.reset().dim(` <${email}>`);
      return {
        title,
        value: id,
      }
    }),
  });
  const credentials = await loadCredentials();
  const account = credentials[id];
  delete credentials[id];
  const { current, ...rest } = credentials;
  if (current === id) {
    const ids = Object.keys(rest);
    if (ids.length) {
      credentials.current = ids[0];
    } else {
      delete credentials.current;
    }
  }
  await writeCredentials(credentials);
  console.log(kleur.yellow(`Removed authorized user ${account.name}.`));
}

async function getAccounts() {
  const { current, ...rest } = await loadCredentials();
  return Object.keys(rest).map((key) => {
    const { name, email } = rest[key];
    return {
      id: key,
      name,
      email,
      current: key === current,
    };
  });
}

async function getToken(email, password) {
  const { token } = await request({
    path: '/1/auth/login',
    method: 'POST',
    body: {
      email,
      password,
    }
  });
  return token;
}

async function getUser(token) {
  return await request({
    token,
    path: '/1/users/me',
    method: 'GET',
  });
}
