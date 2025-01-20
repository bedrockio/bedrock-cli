import pluralize from 'pluralize';
import { kebabCase, camelCase, upperFirst } from 'lodash-es';

pluralize.addPluralRule(/z$/i, 'zzes');

export function getPlural(str) {
  return pluralize.plural(str);
}

export function getSingular(str) {
  return pluralize.singular(str);
}

export function camelUpper(str) {
  return upperFirst(camelCase(str));
}

export function kebabPlural(str) {
  return kebabCase(getPlural(str));
}

export function camelPlural(str) {
  return camelCase(getPlural(str));
}

export function kebabSingular(str) {
  return kebabCase(getSingular(str));
}
