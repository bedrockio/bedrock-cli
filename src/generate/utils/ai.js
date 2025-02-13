import logger from '@bedrockio/logger';
import { MultiClient } from '@bedrockio/ai';

import { getRelativeFile, writeFile } from '../../util/file.js';

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
      apiKey:
        'xai-AWVUcOFxEufIa28aehQEGKtJh0FsCh8HaowyjWtQU00zWkYyyBfMi4MLAmW7BdfuxC1OKpgBtgfvefGD',
    },
  ],
});

export async function ejectTemplate(options) {
  const { file, exit } = options;
  const output = await client.buildTemplate(options);
  const filename = `generate-${file}.md`;
  await writeFile(filename, output);

  if (exit) {
    logger.info(
      `Template written to "${filename}". Use --template to pass back in to this script.`,
    );
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

  // Seems to like to output a `files` array.
  const files = output.files || output;
  for (let file of files) {
    let { filename, content } = file;
    if (typeof content !== 'string') {
      content = JSON.stringify(content, null, 2);
    }
    await writeFile(filename, content);
  }
}
