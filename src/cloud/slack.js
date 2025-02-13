import { getConfig, getRef } from '../util/git.js';
import { exec } from '../util/shell.js';

export function getSlackWebhook(config) {
  if (config && config.slack && config.slack.webhook) {
    return config.slack.webhook;
  }
}

export async function postSlackMessage(hook, message) {
  if (!hook) return;
  try {
    await fetch(hook, {
      method: 'POST',
      body: JSON.stringify(message),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // ignore for now
  }
}

export async function createDeployMessage(environment, project, services) {
  const author = await getConfig('user.name', 'Anonymous');
  const gitRef = await getRef();
  const branch = await exec('git branch --show-current');
  const ts = Math.floor(Date.now() / 1000);
  const text = services
    .map((service) => {
      return `- ${service}`;
    })
    .join('\n');

  let color = '';
  if (environment == 'production') {
    color = '#ff0000';
  } else if (environment != 'staging') {
    color = '#ffa500';
  }

  return {
    attachments: [
      {
        fallback: 'Started Deploying',
        pretext: `Started Deploying: ${project} (${author})`,
        title: `${environment} | ${branch} | ${gitRef}`,
        text,
        ts,
        color,
      },
    ],
  };
}

export async function createFinishDeployMessage(project) {
  const author = await getConfig('user.name', 'Anonymous');
  return {
    text: `Finished Deploying: ${project} (${author})`,
  };
}

export async function slackStartedDeploy(environment, config, services) {
  const hook = getSlackWebhook(config);
  if (hook) {
    const project = config.gcloud && config.gcloud.project;
    const deployMessage = await createDeployMessage(environment, project, services);
    postSlackMessage(hook, deployMessage);
  }
}

export async function slackFinishedDeploy(config) {
  const hook = getSlackWebhook(config);
  if (hook) {
    const project = config.gcloud && config.gcloud.project;
    const deployMessage = await createFinishDeployMessage(project);
    postSlackMessage(hook, deployMessage);
  }
}
