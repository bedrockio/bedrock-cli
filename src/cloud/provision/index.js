import path from 'path';
import kleur from 'kleur';
import { prompt } from '../../util/prompt';
import { exec, execSyncInherit, withDir } from '../../util/shell';
import { exit } from '../../util/exit';
import { assertBedrockRoot } from '../../util/dir';
import { checkGCloudProject } from '../authorize';
import { readConfig, checkEnvironment } from '../utils';

export async function terraformPlan(options) {
  await terraform(options, 'plan');
}

export async function terraformApply(options) {
  await terraform(options, 'apply');
}

export async function terraformInit(options) {
  await terraform(options, 'init');
}

export async function terraformReconfigure(options) {
  await terraform(options, 'reconfigure');
}

export async function terraformRefresh(options) {
  await terraform(options, 'refresh');
}

export async function terraformMigrate(options) {
  await terraform(options, 'migrate');
}

export async function terraformDestroy(options) {
  await terraform(options, 'destroy');
}

export async function checkTerraformCommand() {
  try {
    await exec('which terraform');
  } catch (e) {
    exit('Error: Terraform is not installed (https://www.terraform.io/)');
  }
}

async function terraform(options, command) {
  await assertBedrockRoot();
  await checkEnvironment(options);
  const { environment } = options;
  const config = readConfig(environment);

  await checkGCloudProject(config.gcloud);
  await checkTerraformCommand();

  // config.info("Note: Terrafrom requires gcloud application-default authentication. Run 'bedrock cloud login-application' at least once.");

  try {
    await provisionTerraform(environment, command, config.gcloud);
  } catch (e) {
    // ignore error
  }
}

async function plan(options, planFile, refresh = false) {
  const { project, computeZone, kubernetes, bucketPrefix, envName } = options;
  // computeZone example: us-east1-c
  const region = computeZone.slice(0, -2); // e.g. us-east1
  const zone = computeZone.slice(-1); // e.g. c
  const { clusterName, minNodeCount, maxNodeCount, machineType, diskType, diskSize, preemptible } = kubernetes;
  console.info(kleur.yellow(`=> Planning with planFile: "${planFile}"`));
  const refreshOnly = refresh ? '-refresh-only' : '';

  const args = [
    `-var "project=${project}"`,
    `-var "environment=${envName}"`,
    `-var "cluster_name=${clusterName}"`,
    `-var "bucket_prefix=${bucketPrefix}"`,
    `-var "region=${region}"`,
    `-var "zone=${zone}"`,
    `-var "min_node_count=${minNodeCount}"`,
    `-var "max_node_count=${maxNodeCount}"`,
    `-var "machine_type=${machineType}"`,
    `-var "preemptible=${preemptible}"`,
  ];

  if (diskType) {
    args.push(`-var "disk_type=${diskType}"`);
  }

  if (diskSize) {
    args.push(`-var "disk_size=${diskSize}"`);
  }

  args.push(`-out="${planFile}"`);

  const command = `terraform plan ${refreshOnly} ${args.join(' ')}`;
  console.info(command);
  await execSyncInherit(command);
}

export async function provisionTerraform(environment, terraform, options) {
  await withDir(path.resolve('deployment', 'environments', environment, 'provisioning'), async () => {
    const { project, computeZone, envName, bucketPrefix } = options;
    const region = computeZone.slice(0, -2);

    const planFile = await exec('mktemp');

    if (terraform == 'init') {
      const terraformBucket = `${bucketPrefix}-terraform-system-state`;
      console.info(kleur.green(`Terraform bucket: ${terraformBucket}`));
      try {
        await exec(`gsutil ls gs://${terraformBucket}`);
      } catch (e) {
        if (e.message.includes('BucketNotFoundException')) {
          console.info(kleur.yellow(`${terraformBucket} does not exist. Creating now...`));
          await exec(`gsutil mb -l ${region} gs://${terraformBucket}`);
        }
      }
      console.info('Initialization can take several minutes...');
      let command = `terraform init -backend-config="bucket=${terraformBucket}" -backend-config="prefix=${envName}"`;
      console.info(command);
      await execSyncInherit(command);
    } else if (terraform == 'reconfigure') {
      const terraformBucket = `${bucketPrefix}-terraform-system-state`;
      console.info(kleur.green(`Terraform bucket: ${terraformBucket}`));
      console.info('Initialization with -reconfigure can take several minutes...');
      let command = `terraform init -reconfigure -backend-config="bucket=${terraformBucket}" -backend-config="prefix=${envName}"`;
      console.info(command);
      await execSyncInherit(command);
      await plan(options, planFile, true);
      let confirmed = await prompt({
        type: 'confirm',
        name: 'apply',
        message: 'Are you sure?',
      });
      if (!confirmed) process.exit(0);
      await execSyncInherit(`terraform apply -refresh-only "${planFile}"`);
    } else if (terraform == 'refresh') {
      await plan(options, planFile, true);
      await execSyncInherit(`terraform apply -refresh-only "${planFile}"`);
    } else if (terraform == 'migrate') {
      const terraformBucket = `${bucketPrefix}-terraform-system-state`;
      console.info(kleur.green(`Terraform bucket: ${terraformBucket}`));
      console.info('Initialization with -migrate-state can take several minutes...');
      let command = `terraform init -migrate-state -backend-config="bucket=${terraformBucket}" -backend-config="prefix=${envName}"`;
      console.info(command);
      await execSyncInherit(command);
    } else if (terraform == 'plan') {
      await plan(options, planFile);
    } else if (terraform == 'apply') {
      await plan(options, planFile);
      console.info(kleur.yellow('---------------------------------------------------------\n'));
      console.info(kleur.yellow('         Applying plan can take several minutes          \n'));
      console.info(kleur.yellow('---------------------------------------------------------\n'));
      console.info(kleur.yellow(`Project: ${project}\nEnvironment: ${environment}\n`));

      let confirmed = await prompt({
        type: 'confirm',
        name: 'apply',
        message: 'Are you sure?',
      });
      if (!confirmed) process.exit(0);
      await execSyncInherit(`terraform apply "${planFile}"`);
    } else if (terraform == 'destroy') {
      console.info('Resources to destroy:');
      await execSyncInherit('terraform state list');
      console.info(kleur.yellow('---------------------------------------------------------\n'));
      console.info(kleur.yellow('    Destroying infrastructure can take several minutes   \n'));
      console.info(kleur.yellow('---------------------------------------------------------\n'));
      console.info(kleur.yellow(`Project: ${project}\nEnvironment: ${environment}\n`));

      let confirmed = await prompt({
        type: 'confirm',
        name: 'destroy',
        message: 'Are you sure?',
      });
      if (!confirmed) process.exit(0);
      try {
        await execSyncInherit(`terraform destroy -auto-approve`);
      } catch (e) {
        console.info(kleur.yellow('Make sure to manually empty buckets before destroying (failsafe)'));
      }
    } else {
      console.info(kleur.yellow(`Terraform command "${terraform}" not supported`));
    }
  });
}
