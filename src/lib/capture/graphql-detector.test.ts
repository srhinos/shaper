import { describe, it, expect } from 'vitest';
import { detectGraphQL, parseGraphQLBody, isIntrospectionResponse } from './graphql-detector';

describe('detectGraphQL', () => {
  it('detects by URL path', () => {
    expect(detectGraphQL('POST', 'https://api.com/graphql', null)).toBe(true);
  });

  it('detects by body with query field', () => {
    const body = JSON.stringify({ query: '{ users { id name } }' });
    expect(detectGraphQL('POST', 'https://api.com/api', body)).toBe(true);
  });

  it('rejects GET requests', () => {
    expect(detectGraphQL('GET', 'https://api.com/graphql', null)).toBe(false);
  });

  it('rejects POST without graphql indicators', () => {
    const body = JSON.stringify({ data: 'hello' });
    expect(detectGraphQL('POST', 'https://api.com/api', body)).toBe(false);
  });
});

describe('parseGraphQLBody', () => {
  it('extracts operation name and type', () => {
    const body = JSON.stringify({
      query: 'query GetUser($id: ID!) { user(id: $id) { name } }',
      operationName: 'GetUser',
      variables: { id: '1' },
    });
    const result = parseGraphQLBody(body);
    expect(result?.operationName).toBe('GetUser');
    expect(result?.operationType).toBe('query');
    expect(result?.variables).toEqual({ id: '1' });
  });

  it('handles mutation', () => {
    const body = JSON.stringify({ query: 'mutation CreateUser { createUser { id } }' });
    const result = parseGraphQLBody(body);
    expect(result?.operationType).toBe('mutation');
  });

  it('returns null for non-GraphQL body', () => {
    expect(parseGraphQLBody('not json')).toBeNull();
    expect(parseGraphQLBody(JSON.stringify({ foo: 'bar' }))).toBeNull();
  });

  it('handles subscription type', () => {
    const body = JSON.stringify({ query: 'subscription OnMessage { messages { text } }' });
    const result = parseGraphQLBody(body);
    expect(result?.operationType).toBe('subscription');
  });
});

describe('isIntrospectionResponse', () => {
  it('detects __schema in response', () => {
    expect(isIntrospectionResponse('{"data":{"__schema":{"types":[]}}}')).toBe(true);
  });

  it('detects __type in response', () => {
    expect(isIntrospectionResponse('{"data":{"__type":{"name":"User"}}}')).toBe(true);
  });

  it('returns false for normal response', () => {
    expect(isIntrospectionResponse('{"data":{"users":[]}}')).toBe(false);
  });
});
