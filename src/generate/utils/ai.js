import { MultiClient } from '@bedrockio/ai';

import { getRelativeFile, writeFile } from '../../utils/file.js';

const client = new MultiClient({
  templates: getRelativeFile(import.meta, '../templates'),
  platforms: [
    {
      name: 'openai',
      apiKey:
        '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',
    },
    {
      name: 'claude',
      apiKey:
        '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',
    },
    {
      name: 'gemini',
      apiKey: 'AIzaSyB--MVzmiqAgqX6pJRdxqDvyiGUlnERjBU',
    },
    {
      name: 'grok',
      apiKey: 'xai-AWVUcOFxEufIa28aehQEGKtJh0FsCh8HaowyjWtQU00zWkYyyBfMi4MLAmW7BdfuxC1OKpgBtgfvefGD',
    },
  ],
});

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
