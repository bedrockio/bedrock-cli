import { getTag } from './rollout';
import { exec } from '../util/shell';
import fetch from 'node-fetch';

export function getSlackWebhook(config) {
  if (config && config.slack && config.slack.webhook) return config.slack.webhook;
}

export async function postSlackMessage(hook, message) {
  if (!hook) return;
  try {
    await fetch(hook, {
      method: 'POST',
      body: JSON.stringify(message),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // ignore for now
  }
}

export async function createDeployMessage(environment, project, services) {
  const author = await exec('git config user.name');
  const gitTag = await getTag();
  const branch = await exec('git branch --show-current');
  const ts = Math.floor(Date.now() / 1000);
  const text = services
    .map((service) => {
      return `- ${service}`;
    })
    .join('\n');

  return {
    attachments: [
      {
        fallback: 'Started Deploying',
        pretext: `Started Deploying - ${project} (${author})`,
        title: `${environment} | ${branch} | ${gitTag}`,
        text,
        ts,
      },
    ],
  };
}

export async function createFinishDeployMessage(project) {
  const author = await exec('git config user.name');
  return {
    text: `Finished Deploying - ${project} (${author})`,
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
