import { startCase } from 'lodash';
import { block } from './template';
import { replaceBlock } from './source';
import { getInflections } from './inflections';

export function replaceInputs(source, options) {
  return replaceBlock(source, getInputs(options), 'fields');
}

function getInputs(options) {
  return options.schema
    .concat()
    .map((field) => {
      if (!field.private) {
        return getInputForField(field, options);
      }
    })
    .filter((f) => f)
    .join('\n');
}

function getInputForField(field, options) {
  switch (field.type) {
    case 'String':
      return getStringInput(field, options);
    case 'Number':
      if (field.currency) {
        return getCurrencyInput(field, options);
      } else {
        return getNumberInput(field, options);
      }
    case 'Text':
      return getTextInput(field, options);
    case 'Date':
      return getDateInput(field, options);
    case 'Boolean':
      return getBooleanInput(field, options);
    case 'StringArray':
      return getStringArrayInput(field, options);
    case 'Upload':
    case 'UploadArray':
      return getUploadInput(field, options);
    case 'ObjectId':
    case 'ObjectIdArray':
      return getReferenceInput(field, options);
  }
}

function getStringInput(field, options) {
  const { name, required } = field;
  const { camelLower } = getInflections(options.name);
  if (field.enum) {
    return block`
      <Form.Dropdown
        ${required ? 'required' : ''}
        selection
        name="${name}"
        label="${startCase(name)}"
        value={${camelLower}.${name} || ''}
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
        onChange={this.setField}
      />
    `;
  } else {
    return block`
      <Form.Input
        ${required ? 'required' : ''}
        type="text"
        name="${name}"
        label="${startCase(name)}"
        value={${camelLower}.${name} || ''}
        onChange={this.setField}
      />
    `;
  }
}

function getStringArrayInput(field, options) {
  const { name, required } = field;
  const { camelLower } = getInflections(options.name);
  if (field.enum) {
    return block`
      <Form.Dropdown
        ${required ? 'required' : ''}
        multiple
        selection
        name="${name}"
        label="${startCase(name)}"
        value={${camelLower}.${name} || []}
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
        onChange={this.setField}
      />
    `;
  } else {
    return block`
      <Form.Dropdown
        ${required ? 'required' : ''}
        search
        selection
        multiple
        allowAdditions
        name="${name}"
        label="${startCase(name)}"
        options={
          ${camelLower}.${name}?.map((value) => {
            return {
              value,
              text: value,
            };
          }) || []
        }
        onChange={this.setField}
        value={${camelLower}.${name} || []}
      />
    `;
  }
}

function getTextInput(field, options) {
  const { name, required } = field;
  const { camelLower } = getInflections(options.name);
  return block`
    <Form.TextArea
      ${required ? 'required' : ''}
      name="${name}"
      label="${startCase(name)}"
      value={${camelLower}.${name} || ''}
      onChange={this.setField}
    />
  `;
}

function getDateInput(field, options) {
  const { name, required } = field;
  const { camelLower } = getInflections(options.name);
  return block`
    <DateField
      ${field.time ? 'time' : ''}
      ${required ? 'required' : ''}
      name="${name}"
      label="${startCase(name)}"
      value={${camelLower}.${name}}
      onChange={this.setField}
    />
  `;
}

function getReferenceInput(field, options) {
  const { ref, name, type, required } = field;
  const { camelLower } = getInflections(options.name);
  const rInflections = getInflections(ref);
  const isArray = type.match(/Array/);
  return block`
      {!this.props.${name} && (
        <ReferenceField
          ${required ? 'required' : ''}
          name="${name}"
          label="${startCase(name)}"
          value={${camelLower}.${name} || ${isArray ? '[]' : "''"}}
          path="/1/${rInflections.pluralKebab}/search"
          placeholder="Search ${startCase(rInflections.pluralUpper)}"
          onChange={this.setField}
        />
      )}
    `;
}

function getUploadInput(field, options) {
  const { name, type, required } = field;
  const { camelLower } = getInflections(options.name);
  const isArray = type.match(/Array/);
  return block`
    <UploadsField
      ${required ? 'required' : ''}
      name="${name}"
      label="${startCase(name)}"
      value={${camelLower}.${name}${isArray ? ' || []' : ''}}
      onChange={this.setField}
      onError={(error) => this.setState({ error })}
    />
  `;
}

function getNumberInput(field, options) {
  const { name, required, min, max } = field;
  const { camelLower } = getInflections(options.name);
  return block`
    <Form.Input
      ${required ? 'required' : ''}
      type="number"
      name="${name}"
      label="${startCase(name)}"
      value={${camelLower}.${name}?.toFixed() || ''}
      onChange={this.setNumberField}
      ${min ? `min="${min}"` : ''}
      ${max ? `max="${max}"` : ''}
    />
  `;
}

function getCurrencyInput(field, options) {
  const { name, required, min, max, currency } = field;
  const { camelLower } = getInflections(options.name);
  return block`
    <CurrencyField
      ${currency === 'cents' ? 'cents' : ''}
      ${required ? 'required' : ''}
      name="${name}"
      label="${startCase(name)}"
      value={${camelLower}.${name} || ''}
      onChange={this.setField}
      ${min ? `min="${min}"` : ''}
      ${max ? `max="${max}"` : ''}
    />
  `;
}

function getBooleanInput(field, options) {
  const { name, required } = field;
  const { camelLower } = getInflections(options.name);
  return block`
    <Form.Checkbox
      ${required ? 'required' : ''}
      name="${name}"
      label="${startCase(name)}"
      checked={${camelLower}.${name}}
      onChange={this.setCheckedField}
    />
  `;
}
