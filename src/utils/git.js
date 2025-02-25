import { exec } from './shell.js';

export async function getRef() {
  let ref = await exec('git tag --points-at HEAD');
  ref ||= await exec('git rev-parse --short --verify HEAD');
  if (await exec('git diff --stat')) {
    ref += '-dirty';
  }
  return ref;
}

export async function getBranch() {
  return await exec('git branch --show-current');
}

export async function cloneRepository(dir, repo) {
  await exec(`git clone --single-branch --depth 1 https://github.com/${repo}.git ${dir}`);
}

export async function initializeRepository(dir, repo) {
  const commands = ['git tag bedrock-cut', 'git add .', 'git commit -m "Bedrock Create"'];
  if (repo) {
    commands.push(`git remote remove origin`);
    commands.push(`git remote add origin git@github.com:${repo}.git`);
  }
  await exec(commands);
}

export async function getConfig(config, fallback = '') {
  try {
    return await exec(`git config ${config}`);
  } catch {
    return fallback;
  }
}
