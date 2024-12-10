# Bedrock CLI

![Run Tests](https://github.com/bedrockio/bedrock-cli/workflows/Run%20Tests/badge.svg)

The Bedrock Command Line Interface can be used to manage Bedrock projects and deployments.

- [Installation](#installation)
- [Create a New Project](#create-a-new-project)
- [Deploy your Project](#deploy-your-project)
- [Generate Code](#generate-code)

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

## Deploy your Project

To use the bedrock `cloud` commands, check the `bedrock-core` Deployment [README.md](https://github.com/bedrockio/bedrock-core/tree/master/deployment), which includes: gcloud setup, deployment and provisioning.

Provisioning will allow new infrastructure to be created on Google Cloud using Terraform. CLI commands will also let you deploy and control a Kubernetes cluster.

### Google Cloud Platform

Bedrock uses GCP as it's standard cloud solution for hosting and deploying Bedrock projects. Projects are built using docker and deployed with kubernetes.

### Slack integration

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
    "bucketPrefix": "bedrock-foundation-staging",
    "project": "bedrock-foundation-staging",
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
  "slack": {
    "webhook": "https://hooks.slack.com/services/xxxxxxxx/xxxxxxxx"
  }
}
```

Each environment can use the same webhook for the same channel, or you can set up a different channel and webhook for each environment.

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

### Remote Builds

The following commands will build a docker image locally:

- `bedrock cloud build`
- `bedrock cloud deploy`

There is also the option to build the image remotely using GCP Container Registry:

- `bedrock cloud build --remote`
- `bedrock cloud deploy --remote`

This may be advantageous as it requires less data to transfer (pushing a tarball of the source vs pushing up an entire docker image), also notably docker images take much longer to build on Apple Silicon as they must compile to `x86` targets.

## Generate Code

The CLI `generate` command can be used to generate the following:

- `model` - model definitions
- `routes` - API routes
- `docs` - documentation
- `modal` - modal dialogs for editing objects from anywhere
- `screens` - basic CRUD screens (search/filter, detail page, etc)
- `subscreens` - screens for associated models (for example a page for `products` that belong to a `shop`)

Running `bedrock generate` can generate one or many of these resources. As the foundation for your generated code, models must be first created to allow generation of other resources so generating other resources will ask you to create a new model or load an existing one.

### Schema Creation

Generating a model requires creating a schema. Understanding [Mongoose schema types](https://mongoosejs.com/docs/schematypes.html) will be helpful here. The schema definition can be edited or changed within the CLI, then choosing `Build Schema` will continue on to generate other resources that are derived from it.

### Integration

The generator makes a best effort to integrate generated code into your app, and on a fresh Bedrock codebase can even generate new resources without restarting the server. However as your code diverges it may require some manual tweaking to correctly integrate with your app.

### Re-generating

As structured JSON data, models can safely be re-generated after manual changes but as a general rule, generated code is expected to diverge as it is modified. However if the code has not been manually changed then it is safe to re-run generators. Another strategy is to allow the generator to overwrite existing files and use `git diff` to manually merge custom and generated code.

Client side code specifically is expected to diverge, however `modal` dialogs benefit greatly from avoiding manual changes as editiable fields inside them can be re-generated after changes your model definition changes.

## More

Use the `help` command for more information on CLI commands:

```bash
bedrock help
```
