import { describe, it, expect } from 'vitest';
import { generateOpenAPI, generateOpenAPIPerDomain } from './openapi';
import type { Endpoint } from '../types';

describe('generateOpenAPI', () => {
  const endpoint: Endpoint = {
    id: '1', pattern: 'GET /users/:id', method: 'GET',
    urlPattern: '/users/:id', domain: 'api.com', protocol: 'http',
    sampleCount: 3,
    schema: {
      pathParams: [{ name: ':id', observedValues: ['1', '2'], inferredType: 'integer' }],
      response: { '200': { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
    },
  };

  it('produces valid OpenAPI 3.0.3 structure with servers', () => {
    const spec = generateOpenAPI([endpoint]);
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toContain('api.com');
    expect(spec.servers).toBeDefined();
    expect(spec.servers[0].url).toContain('api.com');
    expect(spec.paths['/users/{id}']).toBeDefined();
  });

  it('includes path parameters', () => {
    const spec = generateOpenAPI([endpoint]);
    const params = spec.paths['/users/{id}'].get.parameters;
    expect(params).toBeDefined();
    expect(params[0].name).toBe('id');
    expect(params[0].in).toBe('path');
  });

  it('includes response schema', () => {
    const spec = generateOpenAPI([endpoint]);
    const response = spec.paths['/users/{id}'].get.responses['200'];
    expect(response.content['application/json'].schema).toBeDefined();
  });

  it('handles multiple endpoints on same path with different methods', () => {
    const postEndpoint: Endpoint = {
      ...endpoint, id: '2', pattern: 'POST /users/:id', method: 'POST',
      schema: { request: { type: 'object', properties: { name: { type: 'string' } } } },
    };
    const spec = generateOpenAPI([endpoint, postEndpoint]);
    expect(spec.paths['/users/{id}'].get).toBeDefined();
    expect(spec.paths['/users/{id}'].post).toBeDefined();
  });

  it('generates per-domain specs', () => {
    const otherEndpoint: Endpoint = {
      ...endpoint, id: '3', domain: 'other.com',
    };
    const specs = generateOpenAPIPerDomain([endpoint, otherEndpoint]);
    expect(specs).toHaveLength(2);
    expect(specs.find(s => s.info.title.includes('api.com'))).toBeDefined();
    expect(specs.find(s => s.info.title.includes('other.com'))).toBeDefined();
  });

  it('generates synthetic path for GraphQL endpoints', () => {
    const gqlEndpoint: Endpoint = {
      id: '4', pattern: 'POST /graphql/GetUser', method: 'POST',
      urlPattern: '/graphql/GetUser', domain: 'api.com', protocol: 'graphql',
      sampleCount: 2,
      schema: {
        request: { type: 'object', properties: { query: { type: 'string' } } },
        response: { '200': { type: 'object', properties: { data: { type: 'object' } } } },
      },
    };
    const spec = generateOpenAPI([gqlEndpoint]);
    const pathItem = spec.paths['/graphql/GetUser'];
    expect(pathItem).toBeDefined();
    expect(pathItem.post['x-shaper-synthetic']).toBe(true);
    expect(pathItem.post.operationId).toBe('GetUser');
  });
});
