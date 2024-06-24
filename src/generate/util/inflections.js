import { kebabCase, camelCase, upperFirst, startCase } from 'lodash';
import pluralize from 'pluralize';

pluralize.addPluralRule(/z$/i, 'zzes');

export function getInflections(str) {
  const kebab = kebabCase(str);
  const natural = startCase(str);
  const camelLower = camelCase(str);
  const camelUpper = upperFirst(camelLower);
  const pluralLower = pluralize.plural(camelLower);
  const pluralUpper = upperFirst(pluralLower);
  const pluralKebab = kebabCase(pluralLower);
  const pluralNatural = startCase(pluralUpper);
  return {
    kebab,
    camelLower,
    camelUpper,
    pluralLower,
    pluralUpper,
    pluralKebab,
    natural,
    pluralNatural,
  };
}
