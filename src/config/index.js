import { yellow } from 'kleur/colors';

import { promptConfirm } from '../utils/prompt.js';
import { loadConfig, writeConfig } from '../utils/config.js';

const PLATFORMS = ['openai', 'anthropic', 'gemini', 'grok'];

export async function config() {
  const config = await loadConfig();

  await promptConfirm(config, [
    {
      type: 'select',
      prompt: true,
      required: true,
      name: 'DEFAULT_AI_PLATFORM',
      description: 'Default AI platform',
      choices: [
        {
          title: 'OpenAI',
          value: 'openai',
        },
        {
          title: 'Claude',
          value: 'anthropic',
        },
        {
          title: 'Gemini',
          value: 'gemini',
        },
        {
          title: 'Grok',
          value: 'xai',
        },
      ],
    },
    {
      type: 'text',
      name: 'OPENAI_API_KEY',
      description: 'OpenAI API key',
      confirm: true,
    },
    {
      type: 'text',
      name: 'ANTHROPIC_API_KEY',
      description: 'Anthropic API key',
      confirm: true,
    },
    {
      type: 'text',
      name: 'GEMINI_API_KEY',
      description: 'Gemini API key',
      confirm: true,
    },
    {
      type: 'text',
      name: 'XAI_API_KEY',
      description: 'xAI API key',
      confirm: true,
    },
  ]);

  console.info(
    yellow(`
Your config:

${JSON.stringify(config, null, 2)}

`),
  );

  await writeConfig(config);
}
