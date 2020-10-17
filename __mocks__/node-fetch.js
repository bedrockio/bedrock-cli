const MOCKS = require('../__fixtures__/fetch.json');

export default function fetch(url) {
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  const data = MOCKS[path];
  if (data) {
    return {
      json: async () => {
        return data;
      }
    };
  }
}
