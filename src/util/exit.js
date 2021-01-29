import kleur from 'kleur';

export function exit(message) {
  console.error(kleur.red(message));
  process.exit(1);
}
