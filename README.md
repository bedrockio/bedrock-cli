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

## More

```bash
bedrock --help
```
