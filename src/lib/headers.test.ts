import { describe, it, expect } from 'vitest';
import { filterHeaders, PRESETS } from './headers';
import type { HeaderEntry, HeaderFilterConfig } from './types';

describe('filterHeaders', () => {
  const headers: HeaderEntry[] = [
    { name: 'content-type', value: 'application/json' },
    { name: 'authorization', value: 'Bearer xxx' },
    { name: 'user-agent', value: 'Mozilla/5.0' },
    { name: 'x-request-id', value: '123' },
    { name: 'set-cookie', value: 'session=abc' },
  ];

  it('returns all headers with empty config', () => {
    const config: HeaderFilterConfig = { enabledPresets: [], customExcludes: [], customIncludes: [] };
    expect(filterHeaders(headers, config)).toHaveLength(5);
  });

  it('excludes headers from enabled preset', () => {
    const config: HeaderFilterConfig = { enabledPresets: ['browser'], customExcludes: [], customIncludes: [] };
    const result = filterHeaders(headers, config);
    expect(result.find(h => h.name === 'user-agent')).toBeUndefined();
  });

  it('custom excludes remove specific headers', () => {
    const config: HeaderFilterConfig = { enabledPresets: [], customExcludes: ['x-request-id'], customIncludes: [] };
    const result = filterHeaders(headers, config);
    expect(result.find(h => h.name === 'x-request-id')).toBeUndefined();
  });

  it('custom includes override preset exclusions', () => {
    const config: HeaderFilterConfig = { enabledPresets: ['browser'], customExcludes: [], customIncludes: ['user-agent'] };
    const result = filterHeaders(headers, config);
    expect(result.find(h => h.name === 'user-agent')).toBeDefined();
  });
});

describe('PRESETS', () => {
  it('has browser preset', () => {
    expect(PRESETS.find(p => p.id === 'browser')).toBeDefined();
  });
  it('has cookies preset', () => {
    expect(PRESETS.find(p => p.id === 'cookies')).toBeDefined();
  });
});
