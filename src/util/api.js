import path from 'path';
import fetch from 'node-fetch';
import { once } from 'lodash';
import { homedir } from 'os';
import { promises as fs } from 'fs';

// TODO: change to bedrock.io
const API_URL = 'http://localhost:2300';
const CREDENTIALS_FILE = path.resolve(homedir(), '.bedrock', 'credentials.json');

export async function request(options) {
  const { path, method, body, token = await getCurrentToken() } = options;
  const url = `${API_URL}${path}`;
  const headers = {
      'Content-Type': 'application/json',
      ...token && {
        'Authorization': `Bearer ${token}`,
      }
  };
  const response = await fetch(url, {
    headers,
    method,
    mode: 'cors',
    ...body && {
      body: JSON.stringify(body),
    },
  });
  const { data, error } = await response.json();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export const loadCredentials = once(() => {
  try {
    return require(CREDENTIALS_FILE);
  } catch(err) {
    return {};
  }
});

export async function writeCredentials(credentials) {
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf8');
}

async function getCurrentToken() {
  const credentials = await getCurrentCredentials();
  return credentials ? credentials.token : null;
}

async function getCurrentCredentials() {
  const credentials = await loadCredentials();
  return credentials.current ? credentials[credentials.current] : null;
}
