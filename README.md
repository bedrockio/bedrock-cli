# Bedrock CLI

![Run Tests](https://github.com/bedrockio/bedrock-cli/workflows/Run%20Tests/badge.svg)

The Bedrock Command Line Interface can be used to manage Bedrock projects:

- Create a new Project
- Generate Code: Models, Routes, CRUD UIs, etc.
- Installing Plugins into your Project
- Provisioning new infrastructure on Google Cloud using Terraform
- Deploying and controlling a Kubernetes cluster

## Installation

```bash
curl -s https://install.bedrock.io | bash
```

## Create a New Project

```bash
bedrock create
```

Quick create:

```bash
bedrock create \
  --domain seltzerbox.com \
  --repository github.com/dominiek/seltzer-box \
  seltzer-box
```

## Cloud Deployment

To use the bedrock `cloud` commands, check the `bedrock-core` Deployment [README.md](https://github.com/bedrockio/bedrock-core/tree/master/deployment), which includes: gcloud setup, deployment and provisioning.

## More

```bash
bedrock --help
```

## Slack integration

The `bedrock cloud deploy` command supports posting message on a Slack channel when starting and finishing the deploy. This requires the following steps:

- Create a new Slack App at [api.slack.com](https://api.slack.com/) for your workspace
- Optional: Update your Slack with a nice Icon and description
- Create `incoming webhook`. Select this feature in the menu, and hit `Add New Webhook to Workspace`. It will ask you to select the Slack channel in your workspace to post messages to.
- Copy the generated Webhook URL, which includes the api token
- Paste the Webhook URL in your project's deployment environment `config.json` (See Deployment [README.md](https://github.com/bedrockio/bedrock-core/tree/master/deployment)). Example `deployment/environments/staging/config.json` (replace webhook value with your own Webhook URL):

```json
{
  "gcloud": {
    "envName": "staging",
    "bucketPrefix": "bedrock-foundation",
    "project": "bedrock-foundation",
    "computeZone": "us-east1-c",
    "kubernetes": {
      "clusterName": "cluster-2",
      "nodePoolCount": 1,
      "minNodeCount": 1,
      "maxNodeCount": 3,
      "machineType": "n2-standard-2"
     },
    "label": "app"
  },
  "slack" : {
    "webhook": "https://hooks.slack.com/services/xxxxxxxx/xxxxxxxx"
  }
}
```

Each environment can use the same webhook for the same channel, or you can set up a different channel and webhook for each environment.


## Issues

### Authorization

- Use `gcloud auth login` and `gcloud auth application-default login` to login to the right Google account, or `bedrock cloud login`
- Use `bedrock cloud authorize staging` to get cluster credentials
- If you've used `gcloud auth` with another account, run `gcloud config set account <EMAIL>` or `bedrock cloud account <EMAIL>`, then re-run `bedrock cloud authorize`.

If you get this error when trying to deploy:

```
unauthorized: You don't have the needed permissions to perform this operation, and you may have invalid credentials
```

Then do the following

```
gcloud auth configure-docker
```

or

```
gcloud docker --authorize-only
```