import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import kleur from 'kleur';
import tmp from 'tmp';
import { homedir } from 'os';
import { prompt } from '../util/prompt';
import { assertBedrockRoot } from '../util/dir';
import { readFile } from '../util/file';
import { exec } from '../util/shell';
import { exit } from '../util/exit';
import { setGCloudConfig, checkGCloudConfig } from './authorize';

async function getConfig(environment) {
  const configFilePath = path.resolve('deployment/environments', environment, 'config.json');
  let config = {};
  try {
    config = await readFile(configFilePath);
  } catch (e) {
    exit(
      `Could not find config.json for environment: "${environment}", file path: "${configFilePath}"`
    );
  }
  return config;
}

export async function authorize(options) {
  const { environment } = options;

  // await assertBedrockRoot();
  const config = await getConfig(environment);
  await setGCloudConfig(config.gcloud);
  console.info(kleur.green(`Successfully authorized ${environment}`));
}

export async function status(options) {
  const { environment } = options;

  // await assertBedrockRoot();
  const config = await getConfig(environment);
  const valid = await checkGCloudConfig(environment, config.gcloud);
  if (!valid) exit('Invalid Google Cloud config');

  const ingress = await exec('kubectl get ingress');
  if (ingress) console.info(ingress, '\n');

  console.info(await exec('kubectl get services'), '\n');
  console.info(await exec('kubectl get nodes'), '\n');
  console.info(await exec('kubectl get pods'));
}
