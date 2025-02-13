import kleur from 'kleur';
import logger from '@bedrockio/logger';

export function exit(message) {
  logger.error(kleur.red(message));
  process.exit(1);
}
