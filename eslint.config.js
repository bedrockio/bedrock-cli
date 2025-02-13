import { jest, recommended, nodeImports } from '@bedrockio/eslint-plugin';
export default [
  jest,
  recommended,
  nodeImports,
  {
    rules: {
      'no-console': 'off',
    },
  },
];
