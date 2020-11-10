import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import tmp from 'tmp';
import { prompt } from '../util/prompt';
import { cloneRepository } from '../util/git';
import { assertBedrockRoot } from '../util/dir';

export async function fetchPluginList() {
  const response = await fetch(
    'https://raw.githubusercontent.com/bedrockio/bedrock-core/master/.plugins.json',
    {
      method: 'GET',
    }
  );
  const result = await response.json();
  return result.plugins;
}

const ignoreFiles = ['.gitignore', 'bedrock.json', 'README.md', '.DS_Store'];
const ignoreFilesRegexes = [/\.git.+/, /\/docs\/.*/];

function injectByReg(source, replace, reg) {
  if (!source.includes(replace)) {
    const match = source.match(reg);
    if (match) {
      const last = match[match.length - 1];
      const index = source.indexOf(last) + last.length;

      let src = '';
      src += source.slice(0, index);
      src += '\n';
      src += replace;
      src += source.slice(index);
      source = src;
    }
  }
  return source;
}

function injectAtEnd(source, replace) {
  if (!source.includes(replace)) {
    source += `${replace}`;
  }
  return source;
}

export async function installPackageJsonDependencies(
  destination,
  packageFile,
  dependencies
) {
  const packageInfo = JSON.parse(
    fs.readFileSync(path.join(destination, packageFile)).toString('utf-8')
  );
  Object.keys(dependencies).forEach((packageName) => {
    const version = dependencies[packageName];
    console.info(
      `Configuring Node.js dependency in ${packageFile}: ${packageName}:${version}`
    );
    packageInfo.dependencies[packageName] = version;
  });
  fs.writeFileSync(
    path.join(destination, packageFile),
    JSON.stringify(packageInfo, null, 2)
  );
}

export async function installServiceEnv(destination, file, env, info) {
  let code = fs.readFileSync(path.join(destination, file)).toString('utf-8');
  code = injectAtEnd(code, `\n# ${info.name}\n`);
  Object.keys(env).forEach((key) => {
    const value = env[key];
    console.info(`Configuring env default in ${file}: ${key}`);
    code = injectAtEnd(code, `${key}=${value}\n`);
  });
  fs.writeFileSync(path.join(destination, file), code);
}

export async function installApiRoutes(destination, file, routes) {
  let code = fs.readFileSync(path.join(destination, file)).toString('utf-8');
  for (const route of routes) {
    const absolutePath = path.resolve(path.join(destination, route.path));
    const absoluteDirPath = path.dirname(
      path.resolve(path.join(destination, file))
    );
    const routeIncludePath = path.basename(
      absolutePath.slice(absoluteDirPath.length + 1),
      '.js'
    );
    const name = route.name;
    console.info(`Including route in ${file}: /1/${name}`);
    const includeCode = `\nconst ${name} = require('./${routeIncludePath}');\nrouter.use('/${name}', ${name}.routes());`;
    code = injectByReg(code, includeCode, /^router.use\(.+\);$/gm);
  }
  fs.writeFileSync(path.join(destination, file), code);
}

export async function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  for (const file of files) {
    if (fs.statSync(dirPath + '/' + file).isDirectory()) {
      arrayOfFiles = await getAllFiles(dirPath + '/' + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, '/', file));
    }
  }

  return arrayOfFiles;
}

async function getInfo(source) {
  return JSON.parse(fs.readFileSync(source + '/bedrock.json'));
}

function ignoreFile(file) {
  const fileName = file.split('/').slice(-1)[0];
  if (ignoreFiles.includes(fileName)) {
    return true;
  }
  for (const ignoreFilesRegex of ignoreFilesRegexes) {
    if (file.match(ignoreFilesRegex)) {
      return true;
    }
  }
  return false;
}

export async function copyFiles(source, destination) {
  const absoluteSourcePath = path.resolve(source);
  const files = await getAllFiles(absoluteSourcePath);
  console.info('Copying files:');
  for (const file of files) {
    const relativePath = file.slice(absoluteSourcePath.length);
    if (ignoreFile(file)) {
      continue;
    }
    console.info(` ${relativePath}`);
    const destinationPath = destination + relativePath;
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(file, destinationPath);
  }
}

function describeInfo(info) {
  const lines = [];
  lines.push(`Plugin: ${info.name}`);
  if (info.description) {
    lines.push(`  ${info.description}`);
  }
  const { api, web } = info.services;
  if (api) {
    const { dependencies, routes } = api;
    if (dependencies) {
      lines.push(`API Node Dependencies:`);
      Object.keys(dependencies).forEach((packageName) => {
        const version = dependencies[packageName];
        lines.push(`  ${packageName}: ${version}`);
      });
    }
    if (routes) {
      lines.push(`API Routes:`);
      routes.forEach((route) => {
        lines.push(`  ${route.path}`);
      });
    }
  }

  if (web) {
    const { dependencies } = web;
    if (dependencies) {
      lines.push(`Web Node Dependencies:`);
      Object.keys(dependencies).forEach((packageName) => {
        const version = dependencies[packageName];
        lines.push(`  ${packageName}: ${version}`);
      });
    }
  }
  return lines;
}

export async function summarizePlugin(source) {
  const info = await getInfo(source);
  const lines = describeInfo(info);

  lines.push(`Files:`);
  const absoluteSourcePath = path.resolve(source);
  const files = await getAllFiles(absoluteSourcePath);
  for (const file of files) {
    const relativePath = file.slice(absoluteSourcePath.length);
    if (ignoreFile(file)) {
      continue;
    }
    lines.push(` ${relativePath}`);
  }
  return lines;
}

async function installDependencies(source, destination) {
  const info = await getInfo(source);
  const { api, web } = info.services;
  if (api) {
    const { dependencies, env, routes } = api;
    if (dependencies) {
      await installPackageJsonDependencies(
        destination,
        '/services/api/package.json',
        dependencies
      );
    }
    if (env) {
      await installServiceEnv(destination, '/services/api/env.conf', env, info);
    }
    if (routes) {
      await installApiRoutes(
        destination,
        '/services/api/src/v1/index.js',
        routes
      );
    }
  }
  if (web) {
    const { dependencies, env } = web;
    if (dependencies) {
      await installPackageJsonDependencies(
        destination,
        '/services/web/package.json',
        dependencies
      );
    }
    if (env) {
      await installServiceEnv(destination, '/services/web/env.conf', env, info);
    }
  }
}

export async function list() {
  const result = await fetchPluginList();
  for (const plugin of result) {
    console.log(`${plugin.id} - ${plugin.name}`);
  }
}

export async function info(options) {
  const path = options.name.replace('@', '');
  const response = await fetch(
    `https://raw.githubusercontent.com/${path}/master/bedrock.json`,
    {
      method: 'GET',
    }
  );
  if (!response.ok) {
    console.error(`Could not find Github repo: ${options.name}`);
    return 1;
  }
  const info = await response.json();
  console.log(describeInfo(info).join('\n'));
}

export async function apply(options) {
  //const destination = await assertBedrockRoot();
  const destination = process.cwd();
  const repoPath = options.name.replace('@', '');
  console.info(`Cloning plugin into temporary directory`);
  const source = tmp.dirSync().name;
  await cloneRepository(source, repoPath);
  console.log((await summarizePlugin(source)).join('\n'));
  const continuePrompt = await prompt({
    type: 'toggle',
    name: 'value',
    message: 'Proceed in installing this plugin?',
    active: 'Yes',
    inactive: 'No',
    initial: true,
  });
  if (continuePrompt.value === true) {
    await copyFiles(source, destination);
    await installDependencies(source, destination);
    const info = await getInfo(source);
    console.info('Patching completed');
    if (info.homepage) {
      console.info(`For ${info.name} Usage, see: ${info.homepage}`);
    }
  }
}
