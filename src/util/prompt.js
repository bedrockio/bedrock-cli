import prompts from 'prompts';
import kleur from 'kleur';
import { lowerFirst } from 'lodash-es';

import { validateEnum, validateEmail, validateDomain, validateString, validateRepository } from './validation.js';

export async function promptFill(answers, options = []) {
  prompts.override(answers);
  const filled = await prompts(
    options
      .filter((option) => {
        return option.prompt;
      })
      .map((option) => {
        const { name } = option;
        const answer = answers[name];
        const validator = getWrappedValidator(option);
        const isValid = validator(answer) === true;
        const promptOptions = getPromptOptions(option);
        if (isValid && answer) {
          let { message } = promptOptions;
          message = message.replace(/\?$/, ':');
          const answerStr = Array.isArray(answer) ? answer.join(', ') : answer;
          console.log(kleur.grey(`? ${message} ${answerStr}`));
        }
        return {
          name,
          initial: answers[name],
          validate: validator,
          ...promptOptions,
        };
      }),
    {
      onCancel: () => {
        process.exit(1);
      },
    }
  );
  prompts.override(null);
  Object.assign(answers, filled);
}

export async function prompt(arg) {
  const answers = await prompts(arg, {
    onCancel: () => {
      process.exit(1);
    },
  });
  if (!Array.isArray(arg)) {
    return Object.values(answers)[0];
  } else {
    return answers;
  }
}

function getPromptOptions(option) {
  const { type: optionType, description, required, choices, downcase } = option;
  const msg = downcase ? lowerFirst(description) : description;
  if (optionType === 'multiple') {
    return {
      type: 'multiselect',
      instructions: kleur.grey('(select multiple)'),
      message: `Select ${msg}:`,
      choices: choices.map((choice) => {
        const { title, value, selected, description } = choice;
        return {
          title,
          value,
          selected,
          description,
        };
      }),
    };
  } else if (optionType === 'boolean') {
    return {
      type: 'confirm',
      initial: true,
      message: `${description.replace(/\.?$/, '?')}`,
    };
  } else if (optionType === 'password') {
    return {
      type: 'password',
      message: `Enter ${msg}${required ? '' : ' (optional)'}:`,
    };
  } else {
    return {
      type: 'text',
      message: `Enter ${msg}${required ? '' : ' (optional)'}:`,
    };
  }
}

function getWrappedValidator(option) {
  const { type } = option;
  let validator = getValidator(type);
  return (val) => {
    if (validator) {
      return validator(val, option);
    }
    return true;
  };
}

function getValidator(type) {
  switch (type) {
    case 'email':
      return validateEmail;
    case 'domain':
      return validateDomain;
    case 'multiple':
      return validateEnum;
    case 'repository':
      return validateRepository;
    case 'string':
      return validateString;
    case 'password':
      return validateString;
  }
}
