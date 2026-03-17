import { store } from './state';
import { renderEndpointTree } from './components/endpoint-tree';
import { renderDetailView } from './components/detail-view';
import { initExportMenu } from './components/export-menu';
import { renderSettingsPanel } from './components/settings-panel';
import type { Endpoint, Sample, UserSettings, HeaderFilterConfig } from '../lib/types';

interface EndpointMessage {
  type: 'endpointCreated';
  endpoint: Endpoint;
}

interface EndpointUpdatedMessage {
  type: 'endpointUpdated';
  endpointId: string;
  sampleCount: number;
  schema: Endpoint['schema'];
}

interface CaptureStateMessage {
  type: 'captureStateChanged';
  recording: boolean;
  trackedTabs: Array<{ id: number; title: string }>;
}

type DashboardMessage = EndpointMessage | EndpointUpdatedMessage | CaptureStateMessage;

function render(state: ReturnType<typeof store.getState>): void {
  renderEndpointTree(state.endpoints, state.searchQuery, state.selectedEndpointId);
  renderDetailView(state.selectedDetail);

  const overlay = document.getElementById('settingsOverlay')!;
  if (state.showSettings) {
    overlay.classList.add('open');
    renderSettingsPanel();
  } else {
    overlay.classList.remove('open');
  }

  const allTabsBtn = document.getElementById('dashAllTabs')!;
  const pauseBtn = document.getElementById('dashPause')!;
  allTabsBtn.className = state.recording && state.trackedTabs.length === 0 ? 'active' : '';
  pauseBtn.className = !state.recording ? 'active' : '';

  const chipsContainer = document.getElementById('dashDomainChips')!;
  if (state.domainFilters.length > 0) {
    chipsContainer.innerHTML = state.domainFilters.map(d =>
      `<span class="domain-chip">${d}<span class="remove" data-domain="${d}">&#x2715;</span></span>`
    ).join('');
    for (const btn of chipsContainer.querySelectorAll('.remove')) {
      btn.addEventListener('click', () => {
        const domain = (btn as HTMLElement).dataset.domain!;
        const updated = state.domainFilters.filter(dd => dd !== domain);
        browser.runtime.sendMessage({ type: 'setDomainFilters', domains: updated });
        store.setState({ domainFilters: updated });
      });
    }
  } else {
    chipsContainer.innerHTML = '<span style="font-size:9px;color:#585b70">all domains</span>';
  }

  const statusBar = document.getElementById('statusBar')!;
  const totalSamples = state.endpoints.reduce((s, e) => s + e.sampleCount, 0);
  const recText = state.recording ? '<span class="recording-dot">&#x25CF;</span> Recording' : 'Paused';
  const tabInfo = state.trackedTabs.length > 0 ? ` (${state.trackedTabs.map(t => t.title).join(', ')})` : '';
  statusBar.innerHTML = `${state.endpoints.length} endpoints, ${totalSamples} samples &middot; ${recText}${tabInfo}`;
}

store.subscribe(render);

document.getElementById('searchInput')!.addEventListener('input', (e) => {
  store.setState({ searchQuery: (e.target as HTMLInputElement).value });
});

document.getElementById('settingsBtn')!.addEventListener('click', () => {
  store.setState({ showSettings: true });
});

document.getElementById('dashAllTabs')!.addEventListener('click', () => {
  browser.runtime.sendMessage({ type: 'allTabs' });
});

document.getElementById('dashPause')!.addEventListener('click', () => {
  browser.runtime.sendMessage({ type: 'pause' });
});

document.getElementById('dashClear')!.addEventListener('click', () => {
  if (confirm('Clear all captured data?')) {
    browser.runtime.sendMessage({ type: 'clear' }).then(() => {
      store.setState({ endpoints: [], selectedEndpointId: null, selectedDetail: null });
    });
  }
});

function addDashDomain(): void {
  const input = document.getElementById('dashDomainInput') as HTMLInputElement;
  const domain = input.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain) return;
  input.value = '';
  const state = store.getState();
  const domains = [...state.domainFilters];
  if (!domains.includes(domain)) domains.push(domain);
  browser.runtime.sendMessage({ type: 'setDomainFilters', domains });
  store.setState({ domainFilters: domains });
}

document.getElementById('dashAddDomain')!.addEventListener('click', addDashDomain);
document.getElementById('dashDomainInput')!.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addDashDomain();
});

const port = browser.runtime.connect({ name: 'dashboard' });
port.onMessage.addListener((msg: unknown) => {
  const message = msg as DashboardMessage;
  const state = store.getState();
  switch (message.type) {
    case 'endpointCreated':
      store.setState({ endpoints: [...state.endpoints, message.endpoint] });
      break;
    case 'endpointUpdated': {
      const eps = state.endpoints.map(e =>
        e.id === message.endpointId ? { ...e, sampleCount: message.sampleCount, schema: message.schema } : e
      );
      store.setState({ endpoints: eps });
      if (state.selectedEndpointId === message.endpointId) {
        browser.runtime.sendMessage({ type: 'getEndpointDetail', endpointId: message.endpointId }).then((data: any) => {
          store.setState({ selectedDetail: data as { endpoint: Endpoint; samples: Sample[] } });
        });
      }
      break;
    }
    case 'captureStateChanged':
      store.setState({ recording: message.recording, trackedTabs: message.trackedTabs });
      break;
  }
});

async function init(): Promise<void> {
  const [endpointData, settingsData] = await Promise.all([
    browser.runtime.sendMessage({ type: 'getEndpoints' }) as Promise<{ endpoints: Endpoint[] }>,
    browser.runtime.sendMessage({ type: 'getSettings' }) as Promise<{ settings: UserSettings; headerFilterConfig: HeaderFilterConfig; domainFilters: string[] }>,
  ]);

  store.setState({
    endpoints: endpointData.endpoints,
    settings: settingsData.settings,
    headerFilterConfig: settingsData.headerFilterConfig,
    domainFilters: settingsData.domainFilters,
    recording: false,
  });

  const stateData = await browser.runtime.sendMessage({ type: 'getState' }) as { recording: boolean; trackedTabs: Array<{ id: number; title: string }> };
  store.setState({ recording: stateData.recording, trackedTabs: stateData.trackedTabs });

  initExportMenu();
  checkForUpdates();
}

const REPO = 'srhinos/shaper';
const CURRENT_VERSION = '0.1.3';

async function checkForUpdates(): Promise<void> {
  try {
    const resp = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!resp.ok) return;
    const data = await resp.json();
    const latest = (data.tag_name || '').replace(/^v/, '');
    if (!latest || latest === CURRENT_VERSION) return;
    if (compareVersions(latest, CURRENT_VERSION) <= 0) return;

    const asset = data.assets?.find((a: any) => a.name.endsWith('.zip'));
    const downloadUrl = asset?.browser_download_url || data.html_url;

    const banner = document.getElementById('updateBanner')!;
    banner.innerHTML = `Shaper ${latest} is available (you have ${CURRENT_VERSION}). <a href="${downloadUrl}" target="_blank">Download</a> <button class="dismiss">&times;</button>`;
    banner.classList.add('visible');
    banner.querySelector('.dismiss')!.addEventListener('click', () => banner.classList.remove('visible'));
  } catch { /* network error, no GitHub access, etc — silently skip */ }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

init();
