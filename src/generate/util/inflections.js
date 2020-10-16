import { camelCase, capitalize } from 'lodash';
import { plural } from 'pluralize';

export function getInflections(str) {
  const camelLower = camelCase(str);
  const camelUpper = capitalize(camelLower);
  const pluralLower = plural(camelLower);
  const pluralUpper = plural(camelUpper);
  return {
    camelLower,
    camelUpper,
    pluralLower,
    pluralUpper,
  };
}
