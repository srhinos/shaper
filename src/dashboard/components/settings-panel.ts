import { store } from '../state';
import { PRESETS } from '../../lib/headers';

export function renderSettingsPanel(): void {
  const panel = document.getElementById('settingsPanel')!;
  const state = store.getState();

  let html = '<h2>Settings</h2>';

  html += '<div class="settings-section"><h3>Header Filter Presets</h3>';
  for (const preset of PRESETS) {
    const checked = state.headerFilterConfig.enabledPresets.includes(preset.id) ? 'checked' : '';
    html += `<div class="preset-card">`;
    html += `<input type="checkbox" data-preset="${preset.id}" ${checked}>`;
    html += `<label>${preset.name}<br><span style="color:#6c7086;font-size:10px">${preset.description}</span></label>`;
    html += `</div>`;
  }
  html += '</div>';

  html += '<div class="settings-section"><h3>Domain Filters</h3>';
  for (const d of state.domainFilters) {
    html += `<div style="display:flex;gap:4px;margin-bottom:4px"><span style="flex:1;padding:4px;background:#313244;border-radius:3px">${d}</span><button class="domain-remove" data-domain="${d}" style="color:#f38ba8;background:none;border:1px solid #f38ba844;padding:2px 8px;cursor:pointer;font-family:monospace;font-size:10px">Remove</button></div>`;
  }
  html += '</div>';

  html += `<div class="settings-section"><h3>Max Samples Per Endpoint</h3>`;
  html += `<input type="number" id="maxSamples" value="${state.settings.maxSamplesPerEndpoint}" min="10" max="200" style="background:#313244;color:#cdd6f4;border:1px solid #45475a;border-radius:4px;padding:4px 8px;font-family:monospace;width:80px">`;
  html += `</div>`;

  html += `<div class="settings-section"><h3>Storage</h3>`;
  html += `<div style="color:#a6adc8;margin-bottom:8px">${state.endpoints.length} endpoints</div>`;
  html += `<button id="clearAllData" style="color:#f38ba8;background:none;border:1px solid #f38ba844;padding:4px 12px;cursor:pointer;font-family:monospace">Clear All Data</button>`;
  html += `</div>`;

  html += `<div style="text-align:right;margin-top:16px"><button id="closeSettings" style="background:#89b4fa;color:#1e1e2e;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-family:monospace;font-weight:bold">Close</button></div>`;

  panel.innerHTML = html;

  document.getElementById('closeSettings')!.addEventListener('click', () => {
    store.setState({ showSettings: false });
  });

  document.getElementById('clearAllData')?.addEventListener('click', () => {
    browser.runtime.sendMessage({ type: 'clear' }).then(() => {
      store.setState({ endpoints: [], selectedEndpointId: null, selectedDetail: null });
    });
  });

  const maxInput = document.getElementById('maxSamples') as HTMLInputElement;
  maxInput?.addEventListener('change', () => {
    const val = Math.max(10, Math.min(200, parseInt(maxInput.value) || 50));
    const newSettings = { ...state.settings, maxSamplesPerEndpoint: val };
    browser.runtime.sendMessage({ type: 'updateSettings', settings: newSettings });
    store.setState({ settings: newSettings });
  });

  for (const cb of panel.querySelectorAll('input[data-preset]')) {
    cb.addEventListener('change', () => {
      const presetId = (cb as HTMLElement).dataset.preset!;
      const enabled = (cb as HTMLInputElement).checked;
      const presets = state.headerFilterConfig.enabledPresets.filter(p => p !== presetId);
      if (enabled) presets.push(presetId);
      const newConfig = { ...state.headerFilterConfig, enabledPresets: presets };
      browser.runtime.sendMessage({ type: 'updateHeaderFilters', headerFilterConfig: newConfig });
      store.setState({ headerFilterConfig: newConfig });
    });
  }

  for (const btn of panel.querySelectorAll('.domain-remove')) {
    btn.addEventListener('click', () => {
      const domain = (btn as HTMLElement).dataset.domain!;
      const updated = state.domainFilters.filter(d => d !== domain);
      browser.runtime.sendMessage({ type: 'setDomainFilters', domains: updated });
      store.setState({ domainFilters: updated });
    });
  }
}
