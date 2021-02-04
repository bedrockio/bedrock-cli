import { camelCase, upperFirst } from 'lodash';

const REPO_REG = /^[a-z-]+\/[a-z-]+/;

export function validateRepository(str = '', option) {
  if ((str || option.required) && !REPO_REG.test(str)) {
    return 'Enter valid GitHub repository (organization/repository)';
  }
  return true;
}

const EMAIL_REG = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i;

export function validateEmail(str = '', option) {
  if ((str || option.required) && !EMAIL_REG.test(str)) {
    return 'Enter valid email';
  }
  return true;
}

const DOMAIN_REG = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;

export function validateDomain(str = '', option) {
  if ((str || option.required) && !DOMAIN_REG.test(str)) {
    return 'Enter valid domain';
  }
  return true;
}

export function validateEnum(arg, option) {
  let values;
  if (Array.isArray(arg)) {
    values = arg;
  } else if (typeof arg === 'string') {
    values = [arg];
  } else {
    values = [];
  }
  const { required, choices } = option;
  if (required && values.length === 0) {
    return 'Value is required';
  }
  const allowed = choices.map((choice) => choice.value);
  const hasDisallowed = values.some((str) => {
    return !allowed.includes(str);
  });
  if (hasDisallowed) {
    return `Must be one of ${allowed.join(', ')}`;
  }
  return true;
}

export function validateString(str = '', option) {
  if (!str && option.required) {
    return 'Cannot be empty.';
  } else if (str.match(/['"]/)) {
    return 'Exclude quotes.';
  }
  return true;
}

export function validateCamelUpper(str) {
  if (!str) {
    return 'Please enter a valid name.';
  } else if (camelUpper(str) !== str) {
    return 'Please enter name in upper camel case.';
  }
  return true;
}

function camelUpper(str) {
  return upperFirst(camelCase(str));
}

export function validateNumber(str) {
  if (!str) {
    return 'Value required.';
  } else if (Number.isNaN(+str)) {
    return 'Number is not valid.';
  }
  return true;
}

export function validateRegExp(str) {
  if (!str.match(/^\/.+\/$/)) {
    return 'Please enter a valid RegExp.';
  }
  return true;
}

export function validateBoolean(str) {
  if (str !== 'true' && str !== 'false') {
    return 'Please enter true or false';
  }
  return true;
}

export function validateDate(str) {
  if (str === 'now') {
    return true;
  }
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) {
    return 'Enter any intelligible date or "now".';
  }
  return true;
}
