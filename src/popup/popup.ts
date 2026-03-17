function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

interface PopupState {
  recording: boolean;
  allTabs: boolean;
  trackedTabs: Array<{ id: number; title: string }>;
  domainFilters: string[];
  endpointCount: number;
  sampleCount: number;
}

function renderStatus(data: PopupState): void {
  const status = document.getElementById('status')!;
  const allTabsBtn = document.getElementById('allTabs')!;
  const pauseBtn = document.getElementById('pause')!;

  allTabsBtn.className = data.allTabs ? 'active' : '';
  pauseBtn.className = (!data.allTabs && data.trackedTabs.length === 0) ? 'active' : '';

  if (data.allTabs) {
    status.innerHTML = '<span class="recording">&#x25CF; Recording all tabs</span>';
  } else if (data.trackedTabs.length > 0) {
    let html = '<span class="recording">&#x25CF; Recording:</span><div class="tab-list">';
    for (const tab of data.trackedTabs) {
      html += `<span class="tab-chip">${esc(tab.title)}<span class="remove" data-tab-id="${tab.id}">&#x2715;</span></span>`;
    }
    html += '</div>';
    status.innerHTML = html;
    for (const btn of status.querySelectorAll('.remove')) {
      btn.addEventListener('click', (e) => {
        const tabId = parseInt((e.target as HTMLElement).dataset.tabId!);
        browser.runtime.sendMessage({ type: 'removeTab', tabId }).then(refresh);
      });
    }
  } else {
    status.innerHTML = '<span class="paused">&#x23F8; Paused</span>';
  }

  renderDomainChips(data.domainFilters);
  document.getElementById('summary')!.textContent = `${data.endpointCount} endpoints, ${data.sampleCount} samples`;
}

function renderDomainChips(domains: string[]): void {
  const container = document.getElementById('domainChips')!;
  if (!domains.length) { container.innerHTML = ''; return; }
  let html = '';
  for (const d of domains) {
    html += `<span class="domain-chip">${esc(d)}<span class="remove" data-domain="${esc(d)}">&#x2715;</span></span>`;
  }
  container.innerHTML = html;
  for (const btn of container.querySelectorAll('.remove')) {
    btn.addEventListener('click', (e) => {
      const domain = (e.target as HTMLElement).dataset.domain!;
      const updated = domains.filter(d => d !== domain);
      browser.runtime.sendMessage({ type: 'setDomainFilters', domains: updated }).then(refresh);
    });
  }
}

function refresh(): void {
  browser.runtime.sendMessage({ type: 'getState' }).then((data: any) => renderStatus(data as PopupState));
}

document.getElementById('thisTab')!.addEventListener('click', () => {
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs: any[]) => {
    if (tabs[0]) {
      browser.runtime.sendMessage({
        type: 'addTab',
        tabId: tabs[0].id,
        title: (tabs[0].title || tabs[0].url || '').slice(0, 30),
      }).then(refresh);
    }
  });
});

document.getElementById('allTabs')!.addEventListener('click', () => {
  browser.runtime.sendMessage({ type: 'allTabs' }).then(refresh);
});

document.getElementById('pause')!.addEventListener('click', () => {
  browser.runtime.sendMessage({ type: 'pause' }).then(refresh);
});

document.getElementById('openDashboard')!.addEventListener('click', () => {
  browser.tabs.create({ url: browser.runtime.getURL('dashboard/dashboard.html') });
  window.close();
});

document.getElementById('clear')!.addEventListener('click', () => {
  browser.runtime.sendMessage({ type: 'clear' }).then(refresh);
});

function addDomain(): void {
  const input = document.getElementById('domainInput') as HTMLInputElement;
  const domain = input.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain) return;
  input.value = '';
  browser.runtime.sendMessage({ type: 'getState' }).then((data: any) => {
    const domains = (data as PopupState).domainFilters || [];
    if (!domains.includes(domain)) domains.push(domain);
    browser.runtime.sendMessage({ type: 'setDomainFilters', domains }).then(refresh);
  });
}

document.getElementById('addDomain')!.addEventListener('click', addDomain);
document.getElementById('domainInput')!.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addDomain();
});

refresh();
setInterval(refresh, 2000);
