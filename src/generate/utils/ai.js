import { Client } from '@bedrockio/ai';

import { loadConfig } from '../../utils/config.js';

import { getRelativeFile, writeFile } from '../../utils/file.js';

let client;

export async function ejectTemplate(options) {
  const { file, exit } = options;
  const output = await client.buildTemplate(options);
  const filename = `generate-${file}.md`;
  await writeFile(filename, output);

  if (exit) {
    console.info(`Template written to "${filename}". Use --template to pass back in to this script.`);
    process.exit(0);
  }
}

export async function createAiClient(options) {
  const config = await loadConfig();
  const { DEFAULT_AI_PLATFORM: platform = 'openai' } = config;
  const name = getConfigForPlatform(platform);
  const apiKey = config[name];

  if (!platform) {
    throw new Error('Platform not provided.');
  } else if (!apiKey) {
    throw new Error(`API key not found for ${platform}. Use bedrock config to set.`);
  }

  client = new Client({
    templates: getRelativeFile(import.meta, '../templates'),
    platform,
    apiKey,
    ...(options.aiModel && {
      model: options.aiModel,
    }),
  });
}

function getConfigForPlatform(platform) {
  switch (platform) {
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'anthropic':
      return 'ANTHROPIC_API_KEY';
    case 'gemini':
      return 'GEMINI_API_KEY';
    case 'xai':
      return 'XAI_API_KEY';
  }
}

export async function generateLocalFiles(options) {
  const { eject, ...rest } = options;

  if (eject) {
    ejectTemplate({
      ...rest,
      exit: true,
    });
  }

  const output = await client.prompt({
    ...options,
    output: 'json',
  });

  // Sometimes likes to output a `files` array.
  let files = output.files;
  // Sometimes ignores me and outputs just an object.
  files ||= Array.isArray(output) ? output : [output];

  for (let file of files) {
    let { filename, content } = file;
    if (typeof content !== 'string') {
      content = JSON.stringify(content, null, 2);
    }
    await writeFile(filename, content);
  }
}
