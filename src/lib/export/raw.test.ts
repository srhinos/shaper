import { describe, it, expect } from 'vitest';
import { exportRaw, exportFiltered } from './raw';
import type { Sample, HeaderFilterConfig } from '../types';

const sample: Sample = {
  id: '1', timestamp: '2026-03-16T00:00:00Z', method: 'GET',
  url: 'https://api.com/users', status: 200, protocol: 'http',
  contentType: 'application/json',
  requestHeaders: [{ name: 'user-agent', value: 'test' }, { name: 'accept', value: 'json' }],
  requestBody: null,
  responseHeaders: [{ name: 'content-type', value: 'application/json' }],
  responseBody: '{"data": "test"}',
};

describe('exportRaw', () => {
  it('returns all data unfiltered', () => {
    const result = exportRaw([sample]);
    expect(result[0].requestHeaders).toHaveLength(2);
  });
});

describe('exportFiltered', () => {
  it('applies header filters', () => {
    const config: HeaderFilterConfig = { enabledPresets: ['browser'], customExcludes: [], customIncludes: [] };
    const result = exportFiltered([sample], config);
    expect(result[0].requestHeaders.find((h: any) => h.name === 'user-agent')).toBeUndefined();
  });
});
