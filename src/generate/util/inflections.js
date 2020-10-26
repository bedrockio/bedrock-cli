import { kebabCase, camelCase, upperFirst } from 'lodash';
import { plural } from 'pluralize';

export function getInflections(str) {
  const kebab = kebabCase(str);
  const camelLower = camelCase(str);
  const camelUpper = upperFirst(camelLower);
  const pluralLower = plural(camelLower);
  const pluralUpper = upperFirst(camelUpper);
  const pluralKebab = kebabCase(pluralLower);
  return {
    kebab,
    camelLower,
    camelUpper,
    pluralLower,
    pluralUpper,
    pluralKebab,
  };
}
