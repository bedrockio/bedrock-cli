import { groupBy, mergeWith } from 'lodash';
import { convert } from '@yeongjet/joi-to-json-schema';

export function routerToOpenApi(router, data = {}) {
  if (!data.paths) {
    data.paths = [];
  }
  const layers = router.stack.filter((layer) => layer.methods.length > 0);
  for (let layer of layers) {
    const { methods, path } = layer;
    let [method] = methods;
    if (methods.includes('HEAD')) {
      method = 'GET';
    }

    let definition = data.paths.find((p) => {
      return p.path === path && p.method === method;
    });
    if (!definition) {
      definition = {
        method,
        path,
      };
      data.paths.push(definition);
    }

    const validationMiddleware = layer.stack.find((layer) => !!layer.schemas);
    if (validationMiddleware) {
      const query = getParamsFromValidationMiddleware(validationMiddleware, 'query');
      if (query && query.length) {
        definition.requestQuery = mergeArraysBy(definition.requestQuery, query, 'name');
      }
      const body = getParamsFromValidationMiddleware(validationMiddleware, 'body');
      if (body && body.length) {
        definition.requestBody = mergeArraysBy(definition.requestBody, body, 'name');
      }
    }
    if (!definition.responseBody) {
      definition.responseBody = [];
    }
    definition.examples = mergeArraysBy(definition.examples || [], getExamplesFromDefinition(definition), 'name');
  }
  return data;
}

function mergeArraysBy(arr1, arr2, key) {
  const obj = groupBy([...(arr1 || []), ...(arr2 || [])], key);
  const arr = [];
  for (let group of Object.values(obj)) {
    const obj = group[0];
    if (group.length > 1) {
      mergeWith(obj, ...group.slice(1), (objValue, srcValue) => {
        if (!srcValue && objValue) {
          return objValue;
        }
      });
    }
    arr.push(obj);
  }
  return arr;
}

function getParamsFromValidationMiddleware(validationMiddleware, type) {
  try {
    const params = [];
    const { schemas } = validationMiddleware;
    const schema = schemas[type];
    if (!schema) return [];
    const jsonSchema = convert(schema, (jsonSchema, joiSchema) => {
      if (joiSchema.$_getFlag('result') === 'strip') {
        return 'strip';
      }
      return jsonSchema;
    });
    const { properties, required } = jsonSchema;
    Object.keys(properties).forEach((name) => {
      const schema = properties[name];
      if (schema !== 'strip') {
        params.push({
          name,
          schema,
          description: '',
          required: (required || []).includes(name),
        });
      }
    });
    return params;
  } catch (error) {
    console.warn(`Warning could not convert Joi validation to JSON: ${error.message}`);
    return [];
  }
}

function getExamplesFromDefinition(definition) {
  const { requestBody, responseBody, examples = [] } = definition;
  if (!examples.length) {
    const hasRequest = requestBody && requestBody.length;
    const hasResponse = responseBody && responseBody.length;
    const example = {};
    if (hasRequest) {
      example.requestBody = fieldsToExample(requestBody);
    }
    if (hasResponse) {
      example.responseBody = fieldsToExample(responseBody);
    }
    if (Object.keys(example).length) {
      examples.push(example);
    }
  }
  return examples;
}

function fieldsToExample(fields) {
  const data = {};
  for (let field of fields) {
    data[field.name] = schemaToExampleValue(field.schema, field.name);
  }
  return data;
}

function schemaToExampleValue(schema, fallback) {
  const { type } = schema;
  if (type === 'object') {
    const obj = {};
    for (let [key, value] of Object.entries(schema.properties)) {
      obj[key] = schemaToExampleValue(value);
    }
    return obj;
  } else if (type === 'number') {
    if (schema.default) {
      return schema.default;
    } else if (schema.minimum) {
      return schema.minimum;
    } else if (schema.maximum) {
      return schema.maximum;
    } else {
      return 1;
    }
  } else if (type === 'string') {
    if (schema.format === 'date-time') {
      return '2020-01-01T00:00:00Z';
    } else if (schema.enum) {
      return schema.enum[0];
    } else if (fallback === 'email') {
      return 'foo@bar.com';
    } else if (fallback === 'password') {
      return '12345';
    } else if (schema.minLength === 24 && schema.maxLength === 24) {
      // Currently only way to sniff mongo ObjectId
      return fallback + 'Id';
    } else {
      return fallback || 'sample';
    }
  } else if (type === 'array') {
    return [schemaToExampleValue(schema.items)];
  } else if (type === 'boolean') {
    return true;
  } else if (schema.anyOf) {
    return schemaToExampleValue(schema.anyOf[0]);
  } else {
    throw new Error('Unsupported schema type');
  }
}
