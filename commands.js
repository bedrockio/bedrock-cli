const generateBaseOptions = [
  {
    flags: '--eject',
    description: 'Write the AI template to disk to allow tweaking.',
  },
  {
    flags: '--template [file]',
    description: 'Use with "eject" to tweak and pass back in a template.',
  },
  {
    flags: '-p, --platform [name]',
    description: 'The AI platform to use.',
    default: 'openai',
    choices: ['openai', 'claude', 'gemini', 'grok'],
  },
];

const generateSingleResourceOptions = [
  {
    flags: '-m, --model [name...]',
    description: 'Model(s) to generate for. May be multiple.',
  },
  {
    flags: '--example [file]',
    description: 'File to serve as example input. Defaults to "shops" file.',
  },
  ...generateBaseOptions,
];

export default {
  name: 'bedrock',
  description: 'Command line interface for working with Bedrock projects.',
  commands: [
    {
      name: 'create',
      description: 'Create a new Bedrock project.',
      arguments: [
        {
          name: 'project',
          description: 'Project name',
          required: true,
          prompt: true,
        },
      ],
      options: [
        {
          flags: '-d, --domain <domain>',
          description: 'Domain',
          type: 'domain',
          required: true,
          downcase: true,
          prompt: true,
        },
        {
          flags: '-r, --repository [repository]',
          description: 'Git repository',
          type: 'repository',
          prompt: true,
        },
        {
          flags: '--production',
          description: 'Google Cloud Production Project ID',
          prompt: true,
        },
        {
          flags: '--staging',
          description: 'Google Cloud Staging Project ID',
          prompt: true,
        },
        {
          flags: '--address [address]',
          description: 'Company address',
          downcase: true,
          prompt: true,
        },
        {
          flags: '--password [password]',
          description: 'Admin password',
          downcase: true,
          prompt: true,
        },
      ],
    },
    {
      name: 'generate',
      description: 'Generate new Bedrock resources with AI.',
      commands: [
        {
          name: 'model',
          description: 'Generate Mongoose models.',
          options: generateBaseOptions,
        },
        {
          name: 'routes',
          description: 'Generate API routes.',
          options: generateSingleResourceOptions,
        },
        {
          name: 'tests',
          description: 'Generate tests for an API route.',
          options: generateSingleResourceOptions,
        },
        {
          name: 'screens',
          description: 'Generate top level screens.',
          options: [
            {
              flags: '-m, --model [name...]',
              description: 'Model(s) to generate for. May be multiple.',
            },
            ...generateBaseOptions,
          ],
          arguments: [
            {
              name: 'dir',
              description: 'Path to example screens.',
              required: true,
            },
          ],
        },
        {
          name: 'modal',
          description: 'Generate modal for resource create/update.',
          options: generateSingleResourceOptions,
        },
      ],
    },
    {
      name: 'cloud',
      description: 'Cloud Controls for deployment and provisioning',
      commands: [
        {
          name: 'login',
          description: 'Login to Google Cloud',
        },
        {
          name: 'login-application',
          functionName: 'loginApplication',
          description: 'Login application-default to Google Cloud',
        },
        {
          name: 'account',
          description: 'Set Google Cloud account',
          arguments: [
            {
              name: 'name',
              type: 'string',
              description: 'Switch to Google Cloud account with <name> (e.g. john.doe@gmail.com)',
            },
          ],
        },
        {
          name: 'authorize',
          description: 'Authorize cloud environment',
          arguments: [
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (e.g. staging)',
            },
          ],
        },
        {
          name: 'status',
          description: 'Get status of cloud deployment',
          arguments: [
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (e.g. staging)',
            },
          ],
        },
        {
          name: 'build',
          description: 'Build service container',
          options: [
            {
              flags: '--remote',
              description: 'Build remotely. Must have Cloud Build API enabled (https://bit.ly/3BC55o5).',
            },
            {
              flags: '--native',
              description: 'Build using native CPU architecture.',
            },
            {
              flags: '--environment',
              description: 'Environment for build. Only applies if builds are per-environment.',
            },
          ],
          arguments: [
            {
              name: 'service',
              type: 'string',
              description: 'Service (e.g. api)',
            },
            {
              name: 'subservice',
              type: 'string',
              description: 'SubService (e.g. cli)',
            },
            {
              name: 'tag',
              type: 'string',
              description: 'Image Tag, defaults to latest (e.g. v1.2)',
            },
          ],
        },
        {
          name: 'push',
          description: 'Push service container to gcr.io',
          arguments: [
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (e.g. staging)',
            },
            {
              name: 'service',
              type: 'string',
              description: 'Service (e.g. api)',
            },
            {
              name: 'subservice',
              type: 'string',
              description: 'SubService (e.g. cli)',
            },
            {
              name: 'tag',
              type: 'string',
              description: 'Image Tag, defaults to latest (e.g. v1.2)',
            },
          ],
        },
        {
          name: 'rollout',
          description: 'Rollout service to cluster',
          arguments: [
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (e.g. staging)',
            },
            {
              name: 'service',
              type: 'string',
              description: 'Service (e.g. api)',
            },
            {
              name: 'subservice',
              type: 'string',
              description: 'SubService (e.g. cli)',
            },
          ],
        },
        {
          name: 'deploy',
          description: 'Build, push and rollout service to cluster',
          options: [
            {
              flags: '--all',
              description: 'Deploy all services.',
            },
            {
              flags: '--remote',
              description: 'Build remotely. Must have Cloud Build API enabled (https://bit.ly/3BC55o5).',
            },
            {
              flags: '--subdeployment',
              description: 'Deploy a subdeployment created with "bedrock cloud subdeployment create".',
            },
          ],
          arguments: [
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (e.g. staging)',
            },
            {
              name: 'service',
              type: 'string',
              description: 'Service (e.g. api)',
            },
            {
              name: 'subservice',
              type: 'string',
              description: 'SubService (e.g. cli)',
            },
            {
              name: 'tag',
              type: 'string',
              description: 'Image Tag, defaults to latest (e.g. v1.2)',
            },
          ],
        },
        {
          name: 'undeploy',
          description: 'Delete service from cluster',
          arguments: [
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (e.g. staging)',
            },
            {
              name: 'service',
              type: 'string',
              description: 'Service (e.g. api)',
            },
            {
              name: 'subservice',
              type: 'string',
              description: 'SubService (e.g. cli)',
            },
          ],
        },
        {
          name: 'database',
          description: 'Tools for importing database.',
          commands: [
            {
              name: 'import',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
              ],
              options: [
                {
                  flags: '-a, --created-after [date]',
                  description: 'Limit to users created after a certain date. Can be any parseable date.',
                },
                {
                  flags: '-b, --created-before [date]',
                  description: 'Limit to users created before a certain date. Can be any parseable date.',
                },
                {
                  flags: '-l, --limit [number]',
                  description: 'Limit to a fixed number of users from the most recently created.',
                },
                {
                  flags: '-u, --user-id [string...]',
                  description: 'Limit to users by ID (can be multiple).',
                },
                {
                  flags: '-m, --email [string...]',
                  description: 'Limit to users by email (can be multiple).',
                },
                {
                  flags: '-e, --exclude [string...]',
                  description: 'Exclude collections. (default: [])',
                },
                {
                  flags: '-r, --raw [boolean]',
                  default: false,
                  description: 'Skip sanitizations. Only use this when necessary.',
                },
                {
                  flags: '-o, --out [string]',
                  description: 'The directory to export the export to. (default: "export")',
                },
              ],
            },
          ],
        },
        {
          name: 'info',
          description: 'Deployment info',
          arguments: [
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (e.g. staging)',
            },
            {
              name: 'service',
              type: 'string',
              description: 'Service (e.g. api)',
            },
            {
              name: 'subservice',
              type: 'string',
              description: 'SubService (e.g. cli)',
            },
          ],
        },
        {
          name: 'shell',
          description: 'Start remote bash shell on service container',
          arguments: [
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (e.g. staging)',
            },
            {
              name: 'service',
              type: 'string',
              description: 'Service (e.g. api)',
            },
            {
              name: 'subservice',
              type: 'string',
              description: 'SubService (e.g. cli)',
            },
          ],
        },
        {
          name: 'logs',
          description: 'Open Google Cloud logs explorer UI in your browser',
          arguments: [
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (e.g. staging)',
            },
            {
              name: 'service',
              type: 'string',
              description: 'Service (e.g. api)',
            },
            {
              name: 'subservice',
              type: 'string',
              description: 'SubService (e.g. cli)',
            },
          ],
        },
        {
          name: 'bootstrap',
          description: 'Bootstrap GKE cluster',
          arguments: [
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (e.g. staging)',
            },
            {
              name: 'project',
              type: 'string',
              description: 'Google Cloud project id (e.g. bedrock-foundation)',
            },
          ],
        },
        {
          name: 'port-forward',
          description: 'port-forward service to localhost',
          arguments: [
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (e.g. staging)',
            },
            {
              name: 'service',
              type: 'string',
              description: 'Service (e.g. api)',
            },
            {
              name: 'subservice',
              type: 'string',
              description: 'SubService (e.g. cli)',
            },
            {
              name: 'localPort',
              type: 'string',
              description: 'Local Port number',
            },
            {
              name: 'remotePort',
              type: 'string',
              description: 'Remote Port number',
            },
          ],
        },
        {
          name: 'provision',
          description:
            'Provision cluster on Google Cloud with Terraform (subcommands: <plan>, <apply>, <init> and <destroy>)',
          commands: [
            {
              name: 'plan',
              functionName: 'terraformPlan',
              description: 'Terraform plan provisioning of cluster',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
              ],
            },
            {
              name: 'apply',
              functionName: 'terraformApply',
              description: 'Terraform apply provisioning plan of cluster',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
              ],
            },
            {
              name: 'init',
              functionName: 'terraformInit',
              description: 'Terraform initialize provisioning',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
              ],
            },
            {
              name: 'refresh',
              functionName: 'terraformRefresh',
              description: 'Terraform apply -refresh-only',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
              ],
            },
            {
              name: 'reconfigure',
              functionName: 'terraformReconfigure',
              description: 'Terraform initialize provisioning with -reconfigure',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
              ],
            },
            {
              name: 'migrate',
              functionName: 'terraformMigrate',
              description: 'Terraform initialize provisioning with -migrate-state',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
              ],
            },
            {
              name: 'destroy',
              functionName: 'terraformDestroy',
              description: 'Terraform destroy provisioned cluster',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
              ],
            },
          ],
        },
        {
          name: 'secret',
          description: 'Deploy and update Secrets (subcommands: <get>, <set>, <info> and <delete>)',
          commands: [
            {
              name: 'get',
              functionName: 'secretGet',
              description: 'Get Secret from cluster and store in local <secret-name>.conf file',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
                {
                  name: 'name',
                  type: 'string',
                  description: 'Secret name (e.g. credentials)',
                },
              ],
            },
            {
              name: 'set',
              functionName: 'secretSet',
              description: 'Push secret to cluster from local <secret-name>.conf file',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
                {
                  name: 'name',
                  type: 'string',
                  description: 'Secret name (e.g. credentials)',
                },
              ],
            },
            {
              name: 'info',
              functionName: 'secretInfo',
              description: 'Retrieve secret info from cluster',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
                {
                  name: 'name',
                  type: 'string',
                  description: 'Secret name (e.g. credentials)',
                },
              ],
            },
            {
              name: 'delete',
              functionName: 'secretDelete',
              description: 'Delete secret from cluster',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
                {
                  name: 'name',
                  type: 'string',
                  description: 'Secret name (e.g. credentials)',
                },
              ],
            },
          ],
        },
        {
          name: 'subdeployment',
          description: 'Create or destroy subdeployments for feature branches (subcommands <create> and <destroy>).',
          commands: [
            {
              name: 'create',
              description: 'Create a subdeployment. Creates new kubernetes resources and adds rules to ingress.',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
                {
                  name: 'service',
                  type: 'string',
                  description: 'Service to base subdeployment off of (e.g. web, api)',
                },
                {
                  name: 'subservice',
                  type: 'string',
                  description: 'SubService (e.g. cli)',
                },
              ],
              options: [
                {
                  flags: '--name',
                  description: 'Subdeployment name. Will be used in kubernetes resource files.',
                },
                {
                  flags: '--domain',
                  description:
                    'Domain the subdeployment will be hosted on. If not specified this\nwill be generated by appending a subdomain (test.example.com or test-api.example.com).',
                },
              ],
            },
            {
              name: 'destroy',
              description:
                'Destroys a subdeployment. Deletes existing kubernetes resources and removes rules from ingress.',
              arguments: [
                {
                  name: 'environment',
                  type: 'string',
                  description: 'Environment (e.g. staging)',
                },
              ],
              options: [
                {
                  flags: '--name',
                  description: 'Subdeployment name to be deleted.',
                },
              ],
            },
          ],
        },
        {
          name: 'export',
          description: 'Export models to a zip file that can be used as fixtures.',
          arguments: [
            {
              name: 'environment',
              type: 'string',
              description: 'Environment (e.g. staging)',
            },
          ],
          options: [
            {
              flags: '-m, --model [name...]',
              description: 'Comma separated list of Mongoose model names to export.',
            },
            {
              flags: '-i, --ids [id...]',
              description: 'Comma separated list of ObjectIds to export.',
            },
          ],
        },
      ],
    },
    {
      name: 'config',
      description: 'Updates CLI configs and credentials.',
    },
    {
      name: 'update',
      description: 'Updates this script.',
    },
  ],
};
