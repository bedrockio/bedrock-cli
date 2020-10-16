const REPO_REG = /^[a-z-]+\/[a-z-]+/;

export function validateRepository(str = '', required) {
  if ((str || required) && !REPO_REG.test(str)) {
    throw new TypeError('Enter valid GitHub repository (organization/repository)');
  }
}

const EMAIL_REG = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i;

export function validateEmail(str = '', required) {
  if ((str || required) && !EMAIL_REG.test(str)) {
    throw new TypeError('Enter valid email');
  }
}

const DOMAIN_REG = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;

export function validateDomain(str = '', required) {
  if ((str || required) && !DOMAIN_REG.test(str)) {
    throw new TypeError('Enter valid domain');
  }
}
