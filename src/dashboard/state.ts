import type { Endpoint, Sample, UserSettings, HeaderFilterConfig } from '../lib/types';

export interface DashboardState {
  endpoints: Endpoint[];
  selectedEndpointId: string | null;
  selectedDetail: { endpoint: Endpoint; samples: Sample[] } | null;
  recording: boolean;
  trackedTabs: Array<{ id: number; title: string }>;
  settings: UserSettings;
  headerFilterConfig: HeaderFilterConfig;
  domainFilters: string[];
  searchQuery: string;
  showSettings: boolean;
}

type Listener = (state: DashboardState) => void;

class Store {
  private state: DashboardState = {
    endpoints: [],
    selectedEndpointId: null,
    selectedDetail: null,
    recording: false,
    trackedTabs: [],
    settings: { maxSamplesPerEndpoint: 50, badgeDisplay: 'endpoints', theme: 'dark' },
    headerFilterConfig: { enabledPresets: [], customExcludes: [], customIncludes: [] },
    domainFilters: [],
    searchQuery: '',
    showSettings: false,
  };

  private listeners: Listener[] = [];

  subscribe(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  setState(partial: Partial<DashboardState>): void {
    Object.assign(this.state, partial);
    for (const fn of this.listeners) fn(this.state);
  }

  getState(): DashboardState { return this.state; }
}

export const store = new Store();
