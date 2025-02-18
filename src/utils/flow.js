import { yellow, red, cyan } from 'kleur/colors';

export function warn(msg) {
  console.warn(yellow(msg));
}

export function error(msg) {
  console.error(red(msg));
}

export function info(msg) {
  console.info(cyan(msg));
}

export function exit(msg) {
  console.error(red(msg));
  process.exit(1);
}
