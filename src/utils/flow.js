import kleur from 'kleur';

export function warn(...args) {
  console.info(kleur.yellow(...args));
}

export function error(...args) {
  console.info(kleur.red(...args));
}

export function info(...args) {
  console.info(kleur.cyan(...args));
}

export function exit(...args) {
  console.info(kleur.red(...args));
  process.exit(1);
}
