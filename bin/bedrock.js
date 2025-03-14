#!/usr/bin/env node

import path from 'path';
import fs from 'fs';

import { yellow } from 'kleur/colors';
import { program, Option } from 'commander';
import { camelCase } from 'lodash-es';

import { promptFill } from '../src/utils/prompt.js';
import { loadJson, getDirname } from '../src/utils/file.js';

import commands from '../commands.js';

async function addCommand(command, descriptor) {
  const { description, options = [], arguments: args = [] } = descriptor;
  command.description(getDescription(description));
  command.on('--help', () => {
    console.log('');
  });

  for (let arg of args) {
    const { name, required, description } = arg;
    const flag = required ? `<${name}>` : `[${name}]`;
    command.argument(flag, description);
  }

  for (let obj of options) {
    const { flags, description, choices, default: defaultValue } = obj;

    let option = new Option(flags, description);

    if (defaultValue) {
      option = option.default(defaultValue);
    }

    if (choices) {
      option.choices(choices);
    }

    command.addOption(option);
  }
  for (let sub of descriptor.commands || []) {
    sub.parent = descriptor;
    const { name } = sub;
    const subcommand = command.command(name);
    subcommand.storeOptionsAsProperties(false);
    await addCommand(subcommand, sub);
    const handler = await getHandler(sub);
    if (handler) {
      subcommand.action(async () => {
        const options = gatherOptions(subcommand);
        if (sub.arguments) {
          subcommand.args.forEach((arg, i) => {
            if (sub.arguments[i]) {
              const { name } = sub.arguments[i];
              options[name] = arg;
            } else {
              console.info(yellow(`Warning: "${arg}" argument not used`));
            }
          });
        }
        for (let { name, type } of sub.options || []) {
          const val = options[name];
          if (val && type === 'array') {
            options[name] = val.trim().split(',');
          }
        }
        await promptFill(options, sub.arguments);
        await promptFill(options, sub.options);
        await handler(options, sub);
      });
    }
  }
}

function gatherOptions(command) {
  const options = {};
  while (command && command !== program) {
    Object.assign(options, command.opts());
    command = command.parent;
  }
  return options;
}

async function getHandler(descriptor) {
  const dirs = getHandlerPath(descriptor);
  const name = descriptor.functionName || camelCase(descriptor.name);

  let handler;

  handler ||= await importHandler(name, ...dirs, 'index.js');
  handler ||= await importHandler(name, ...dirs.slice(0, -1), `${dirs.slice(-1)[0]}.js`);
  handler ||= await importHandler(name, ...dirs.slice(0, -1), 'index.js');

  return handler;
}

async function importHandler(name, ...args) {
  const file = path.resolve(getDirname(import.meta.url), '../src', ...args);
  if (!fs.existsSync(file)) {
    return null;
  }
  const mod = await import(file);
  return mod[name] || mod.default;
}

function getHandlerPath(descriptor) {
  const handlerPath = [];
  while (descriptor.parent) {
    handlerPath.unshift(descriptor.name);
    descriptor = descriptor.parent;
  }
  return handlerPath;
}

function getDescription(arg) {
  return Array.isArray(arg) ? arg.join('\n') : arg;
}

(async () => {
  const { version } = await loadJson(path.resolve(getDirname(import.meta.url), '../package.json'));
  program.version(version, '-v, --version');
  await addCommand(program, commands);

  program.parse(process.argv);
})();
