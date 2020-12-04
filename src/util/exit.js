import kleur from 'kleur';

export function exit(message) {
  console.info(kleur.red(message));
  process.exit(1);
}
