import { prompt as inquire } from 'inquirer';
import { lowerFirst } from 'lodash';
import kleur from 'kleur';

import {
  validateEmail,
  validateDomain,
  validateRepository,
} from './validation';

export async function promptFill(answers, options) {
  const filled = await inquire(
    options
    .filter((option) => {
      return option.prompt;
    })
    .map((option) => {
      const { name, description, required } = option;
      const answer = answers[name];
      const validator = getWrappedValidator(option);
      const isValid = validator(answer) === true;
      const message = `Enter ${lowerFirst(description)}${required ? '' : ' (optional)'}:`;
      if (isValid && answer) {
        console.log(kleur.grey(`? ${message} ${answer}`));
      }
      return {
        name,
        type: 'input',
        message,
        default: answers[name],
        validate: validator,
        askAnswered: !isValid,
      };
    }), answers);
  Object.assign(answers, filled);
}

function getWrappedValidator(option) {
  const { validate, required } = option;
  let validator = getValidator(validate);
  return (val) => {
    try {
      if (validator) {
        validator(val, required);
      }
      return true;
    } catch(error) {
      return error.message;
    }
  }
}

function getValidator(type) {
  switch (type) {
    case 'email':
      return validateEmail;
    case 'domain':
      return validateDomain;
    case 'repository':
      return validateRepository;
  }
}
