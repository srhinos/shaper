import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Storage } from './storage';

const mockStorage: Record<string, unknown> = {};
const mockBrowser = {
  storage: {
    local: {
      get: vi.fn((keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const k of keyList) if (k in mockStorage) result[k] = mockStorage[k];
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
      remove: vi.fn((keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) delete mockStorage[k];
        return Promise.resolve();
      }),
    },
  },
};

(globalThis as any).browser = mockBrowser;

beforeEach(() => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  vi.clearAllMocks();
});

describe('Storage', () => {
  it('initializes with version key', async () => {
    const storage = new Storage();
    await storage.init();
    expect(mockStorage['shaper:version']).toBe(1);
  });

  it('saves and retrieves endpoints', async () => {
    const storage = new Storage();
    await storage.init();
    const ep = { id: '1', pattern: 'GET /test', method: 'GET', urlPattern: '/test', domain: 'test.com', protocol: 'http' as const, sampleCount: 0, schema: {} };
    await storage.saveEndpoint(ep);
    const endpoints = await storage.getEndpoints();
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].id).toBe('1');
  });

  it('saves and retrieves samples', async () => {
    const storage = new Storage();
    await storage.init();
    const sample = { id: 's1', timestamp: '', method: 'GET', url: 'https://test.com/test', requestHeaders: [], requestBody: null, responseHeaders: [], responseBody: null, status: 200, protocol: 'http' as const, contentType: null };
    await storage.saveSamples('ep1', [sample]);
    const samples = await storage.getSamples('ep1');
    expect(samples).toHaveLength(1);
  });

  it('migrates from old api_log format', async () => {
    mockStorage['api_log'] = [{ method: 'GET', url: 'test' }];
    const storage = new Storage();
    await storage.init();
    expect(mockStorage['shaper:version']).toBe(1);
    expect(mockStorage['api_log']).toBeUndefined();
  });

  it('saves and retrieves settings', async () => {
    const storage = new Storage();
    await storage.init();
    const settings = {
      settings: { maxSamplesPerEndpoint: 50, badgeDisplay: 'endpoints' as const, theme: 'dark' as const },
      headerFilterConfig: { enabledPresets: ['browser'], customExcludes: [], customIncludes: [] },
      domainFilters: ['api.com'],
    };
    await storage.saveSettings(settings);
    const retrieved = await storage.getSettings();
    expect(retrieved.settings.maxSamplesPerEndpoint).toBe(50);
    expect(retrieved.headerFilterConfig.enabledPresets).toContain('browser');
    expect(retrieved.domainFilters).toContain('api.com');
  });
});
