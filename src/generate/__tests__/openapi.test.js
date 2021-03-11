const { routerToOpenApi } = require('../util/openapi');
const mockRouter = require('../__fixtures__/router.js');

describe('routeToOpenApi', () => {
  it('should extract OpenAPI paths from a Koa Router', async () => {
    const result = routerToOpenApi(mockRouter);
    const { paths } = result;
    expect(paths.length > 4).toBe(true);
    const patchDefinition = paths.find((d) => d.method === 'PATCH' && d.path === '/:userId');
    expect(patchDefinition.method).toBe('PATCH');
    expect(patchDefinition.path).toBe('/:userId');
    expect(patchDefinition.requestBody.length).toBe(3);
  });
});
