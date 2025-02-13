import kleur from 'kleur';
import logger from '@bedrockio/logger';

export function warn(...args) {
  logger.info(kleur.yellow(...args));
}

export function error(...args) {
  logger.info(kleur.red(...args));
}

export function info(...args) {
  logger.info(kleur.cyan(...args));
}

export function exit(...args) {
  logger.info(kleur.red(...args));
  process.exit(1);
}
