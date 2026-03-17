import type { Endpoint, Sample, UserSettings, HeaderFilterConfig } from './types';

interface SettingsData {
  settings: UserSettings;
  headerFilterConfig: HeaderFilterConfig;
  domainFilters: string[];
}

const DEFAULT_SETTINGS: SettingsData = {
  settings: { maxSamplesPerEndpoint: 200, badgeDisplay: 'endpoints', theme: 'dark' },
  headerFilterConfig: { enabledPresets: [], customExcludes: [], customIncludes: [] },
  domainFilters: [],
};

export class Storage {
  async init(): Promise<void> {
    const data = await browser.storage.local.get('shaper:version');
    if (!data['shaper:version']) {
      const old = await browser.storage.local.get('api_log');
      if (old['api_log']) {
        await browser.storage.local.remove(['api_log', 'domain_filters']);
      }
      await browser.storage.local.set({
        'shaper:version': 1,
        'shaper:endpoints': [],
      });
    }
  }

  async getEndpoints(): Promise<Endpoint[]> {
    const data = await browser.storage.local.get('shaper:endpoints');
    return (data['shaper:endpoints'] as Endpoint[]) || [];
  }

  async saveEndpoint(endpoint: Endpoint): Promise<void> {
    const endpoints = await this.getEndpoints();
    const idx = endpoints.findIndex(e => e.id === endpoint.id);
    if (idx >= 0) {
      endpoints[idx] = endpoint;
    } else {
      endpoints.push(endpoint);
    }
    await browser.storage.local.set({ 'shaper:endpoints': endpoints });
  }

  async deleteEndpoint(endpointId: string): Promise<void> {
    const endpoints = await this.getEndpoints();
    const filtered = endpoints.filter(e => e.id !== endpointId);
    await browser.storage.local.set({ 'shaper:endpoints': filtered });
    await browser.storage.local.remove(`shaper:samples:${endpointId}`);
  }

  async getSamples(endpointId: string): Promise<Sample[]> {
    const key = `shaper:samples:${endpointId}`;
    const data = await browser.storage.local.get(key);
    return (data[key] as Sample[]) || [];
  }

  async saveSamples(endpointId: string, samples: Sample[]): Promise<void> {
    await browser.storage.local.set({ [`shaper:samples:${endpointId}`]: samples });
  }

  async getSettings(): Promise<SettingsData> {
    const data = await browser.storage.local.get('shaper:settings');
    return (data['shaper:settings'] as SettingsData) || { ...DEFAULT_SETTINGS };
  }

  async saveSettings(settings: SettingsData): Promise<void> {
    await browser.storage.local.set({ 'shaper:settings': settings });
  }

  async clear(): Promise<void> {
    const endpoints = await this.getEndpoints();
    const sampleKeys = endpoints.map(e => `shaper:samples:${e.id}`);
    await browser.storage.local.remove([...sampleKeys, 'shaper:endpoints', 'shaper:settings']);
    await this.init();
  }
}
