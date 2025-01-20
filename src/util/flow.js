import kleur from 'kleur';

export function warn(...args) {
  console.log(kleur.yellow(...args));
}

export function error(...args) {
  console.log(kleur.red(...args));
}

export function info(...args) {
  console.log(kleur.cyan(...args));
}

export function exit(...args) {
  console.log(kleur.red(...args));
  process.exit(1);
}
