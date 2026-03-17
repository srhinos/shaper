import { describe, it, expect } from 'vitest';
import { toHAR } from './har';
import type { Sample } from '../types';

describe('toHAR', () => {
  const sample: Sample = {
    id: '1', timestamp: '2026-03-16T00:00:00Z', method: 'GET',
    url: 'https://api.com/users?page=1', status: 200, protocol: 'http',
    contentType: 'application/json',
    requestHeaders: [{ name: 'Accept', value: 'application/json' }],
    requestBody: null,
    responseHeaders: [{ name: 'content-type', value: 'application/json' }],
    responseBody: '{"users":[]}',
  };

  it('produces valid HAR structure', () => {
    const har = toHAR([sample]);
    expect(har.log.version).toBe('1.2');
    expect(har.log.creator.name).toBe('Shaper');
    expect(har.log.entries).toHaveLength(1);
  });

  it('maps sample fields correctly', () => {
    const entry = toHAR([sample]).log.entries[0];
    expect(entry.request.method).toBe('GET');
    expect(entry.request.url).toBe('https://api.com/users?page=1');
    expect(entry.response.status).toBe(200);
  });

  it('handles request body', () => {
    const postSample = { ...sample, method: 'POST', requestBody: '{"name":"test"}' };
    const entry = toHAR([postSample]).log.entries[0];
    expect(entry.request.postData?.text).toBe('{"name":"test"}');
  });
});
