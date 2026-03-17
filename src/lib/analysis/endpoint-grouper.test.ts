import { describe, it, expect } from 'vitest';
import { normalizeUrl, matchEndpoint, createEndpointPattern, createGraphQLPattern } from './endpoint-grouper';

describe('normalizeUrl', () => {
  it('replaces UUIDs with :uuid', () => {
    expect(normalizeUrl('/users/550e8400-e29b-41d4-a716-446655440000'))
      .toBe('/users/:uuid');
  });

  it('replaces numeric IDs with :id', () => {
    expect(normalizeUrl('/posts/42')).toBe('/posts/:id');
  });

  it('replaces base64-like tokens with :token', () => {
    expect(normalizeUrl('/verify/aGVsbG93b3JsZDEyMzQ1Njc4OQ'))
      .toBe('/verify/:token');
  });

  it('preserves normal path segments', () => {
    expect(normalizeUrl('/api/users/search')).toBe('/api/users/search');
  });

  it('ignores query parameters entirely for pattern matching', () => {
    expect(normalizeUrl('/search?q=hello&page=2')).toBe('/search');
  });

  it('same path with different params produces same pattern', () => {
    const a = normalizeUrl('/search?class=Shaman&items=sword&overview=vaal');
    const b = normalizeUrl('/search?class=Ranger&items=bow&items=shield&skillmodes=x');
    const c = normalizeUrl('/search');
    expect(a).toBe('/search');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe('createEndpointPattern', () => {
  it('creates pattern from method and url', () => {
    expect(createEndpointPattern('GET', 'https://api.com/users/42'))
      .toBe('GET /users/:id');
  });
});

describe('matchEndpoint', () => {
  it('matches sample to existing endpoint', () => {
    const endpoints = [{ pattern: 'GET /users/:id', urlPattern: '/users/:id', method: 'GET', domain: 'api.com', protocol: 'http' as const }];
    const result = matchEndpoint(endpoints, 'GET', 'https://api.com/users/99', 'http');
    expect(result?.pattern).toBe('GET /users/:id');
  });

  it('returns null for no match', () => {
    const endpoints = [{ pattern: 'GET /users/:id', urlPattern: '/users/:id', method: 'GET', domain: 'api.com', protocol: 'http' as const }];
    const result = matchEndpoint(endpoints, 'POST', 'https://api.com/users', 'http');
    expect(result).toBeNull();
  });
});

describe('createGraphQLPattern', () => {
  it('groups by operation name when present', () => {
    expect(createGraphQLPattern('GetUser', 'query GetUser { user { id } }'))
      .toBe('POST /graphql/GetUser');
  });

  it('hashes unnamed operations', () => {
    const pattern = createGraphQLPattern(null, '{ users { id name } }');
    expect(pattern).toMatch(/^POST \/graphql\/_unnamed_/);
  });

  it('produces same hash for queries differing only in whitespace', () => {
    const a = createGraphQLPattern(null, '{ users  { id   name } }');
    const b = createGraphQLPattern(null, '{  users { id name } }');
    expect(a).toBe(b);
  });

  it('produces same hash for queries differing only in comments', () => {
    const a = createGraphQLPattern(null, '{ users { id name } }');
    const b = createGraphQLPattern(null, '# fetch users\n{ users { id name } }');
    expect(a).toBe(b);
  });
});
