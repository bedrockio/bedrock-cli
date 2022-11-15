import { startCase } from 'lodash';
import { replaceBlock } from './source';
import { getInflections } from './inflections';
import { block } from './template';

export function replaceFilters(source, options) {
  return replaceBlock(source, getFilters(options), 'filters');
}

function getFilters(options) {
  const { camelLower } = getInflections(options.name);
  return options.schema
    .map((field) => {
      if (!field.private) {
        return getFilterForField(field, camelLower);
      }
    })
    .filter((f) => f)
    .join('\n');
}

function getFilterForField(field, camelLower) {
  switch (field.type) {
    case 'Date':
      return getDateFilter(field, camelLower);
    case 'String':
      return getTextFilter(field, camelLower);
    case 'Number':
      return getNumberFilter(field, camelLower);
    case 'Boolean':
      return getBooleanFilter(field, camelLower);
    case 'StringArray':
      return getMultiDropdownFilter(field, camelLower);
  }
}

function getDateFilter(field) {
  const { name } = field;
  return block`
    <SearchFilters.DateRange
      name="${name}"
      label="${startCase(name)}"
    />
  `;
}

function getTextFilter(field) {
  const { name } = field;

  if (field.enum) {
    return block`
      <SearchFilters.Dropdown
        search
        name="${name}"
        label="${startCase(name)}"
        options={[
        ${field.enum
          .map((val) => {
            return `
          {
            text: "${val}",
            value: "${val}",
          }`;
          })
          .join(',\n')}
        ]}
      />
    `;
  } else {
    return block`
    <SearchFilters.Search name="${name}" label="${startCase(name)}" />
  `;
  }
}

function getNumberFilter(field) {
  const { name, min, max } = field;
  const hasMin = min != null;
  const hasMax = max != null;
  if (hasMin || hasMax) {
    return block`
      <SearchFilters.Number
        name="${name}"
        label="${startCase(name)}"
        ${hasMin ? `min="${min}"` : ''}
        ${hasMax ? `max="${max}"` : ''}
      />
    `;
  } else {
    return block`
      <SearchFilters.Number name="${name}" label="${startCase(name)}" />
    `;
  }
}

function getBooleanFilter(field) {
  const { name } = field;
  return block`
    <SearchFilters.Checkbox name="${name}" label="${startCase(name)}" />
  `;
}

function getMultiDropdownFilter(field) {
  const { name } = field;
  if (field.enum) {
    return block`
      <SearchFilters.Dropdown
        search
        multiple
        name="${name}"
        label="${startCase(name)}"
        options={[
        ${field.enum
          .map((val) => {
            return `
          {
            text: "${val}",
            value: "${val}",
          }`;
          })
          .join(',\n')}
        ]}
      />
    `;
  } else {
    return block`
      <SearchFilters.Dropdown
        search
        multiple
        allowAdditions
        name="${name}"
        label="${startCase(name)}"
      />
    `;
  }
}
