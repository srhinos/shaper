import type { Endpoint } from '../../lib/types';
import { store } from '../state';

export function renderEndpointTree(endpoints: Endpoint[], searchQuery: string, selectedId: string | null): void {
  const container = document.getElementById('endpointList')!;
  const filtered = searchQuery
    ? endpoints.filter(e => e.pattern.toLowerCase().includes(searchQuery.toLowerCase()) || e.domain.toLowerCase().includes(searchQuery.toLowerCase()))
    : endpoints;

  const byDomain = new Map<string, Endpoint[]>();
  for (const ep of filtered) {
    const list = byDomain.get(ep.domain) || [];
    list.push(ep);
    byDomain.set(ep.domain, list);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#6c7086">No endpoints captured yet</div>';
    return;
  }

  let html = '';
  if (filtered.length > 500) {
    html += '<div class="warning">500+ endpoints captured. Consider exporting and clearing for better performance.</div>';
  }

  for (const [domain, eps] of byDomain) {
    html += `<div class="domain-group">`;
    html += `<div class="domain-header">${escHtml(domain)} (${eps.length})</div>`;
    for (const ep of eps) {
      const selected = ep.id === selectedId ? ' selected' : '';
      const proto = ep.protocol !== 'http' ? `<span class="protocol-badge">${ep.protocol}</span>` : '';
      html += `<div class="endpoint-item${selected}" data-id="${ep.id}">`;
      html += `<span class="method-badge method-${ep.method}">${ep.method}</span>`;
      html += `<span class="endpoint-path">${escHtml(ep.urlPattern)}</span>`;
      html += proto;
      html += `<span class="endpoint-count">${ep.sampleCount}</span>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  for (const item of container.querySelectorAll('.endpoint-item')) {
    item.addEventListener('click', () => {
      const id = (item as HTMLElement).dataset.id!;
      store.setState({ selectedEndpointId: id });
      browser.runtime.sendMessage({ type: 'getEndpointDetail', endpointId: id }).then((data: any) => {
        store.setState({ selectedDetail: data as ReturnType<typeof store.getState>['selectedDetail'] });
      });
    });
  }
}

function escHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
