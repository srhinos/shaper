import { store } from '../state';

interface ExportResponse {
  specs?: unknown;
  har?: unknown;
  proto?: string;
  data?: unknown;
}

let exportMenuBound = false;

export function initExportMenu(): void {
  if (exportMenuBound) return;
  exportMenuBound = true;

  const menu = document.getElementById('exportMenu')!;
  const btn = document.getElementById('exportBtn')!;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    rebuildMenuItems();
    menu.classList.toggle('open');
  });

  document.addEventListener('click', () => menu.classList.remove('open'));

  menu.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button[data-export]') as HTMLElement | null;
    if (!target) return;
    e.stopPropagation();

    const type = target.dataset.export!;
    const selectedOnly = target.dataset.selected === 'true';
    const state = store.getState();
    const endpointIds = selectedOnly && state.selectedEndpointId ? [state.selectedEndpointId] : undefined;

    browser.runtime.sendMessage({ type, endpointIds }).then((data: any) => {
      let content: string;
      let filename: string;
      const ts = Date.now();

      if (type === 'exportOpenAPI') {
        content = JSON.stringify(data.specs, null, 2);
        filename = `shaper-openapi-${ts}.json`;
      } else if (type === 'exportHAR') {
        content = JSON.stringify(data.har, null, 2);
        filename = `shaper-export-${ts}.har`;
      } else if (type === 'exportProto') {
        content = data.proto || '';
        filename = `shaper-export-${ts}.proto`;
      } else {
        content = JSON.stringify(data.data, null, 2);
        filename = `shaper-export-${ts}.json`;
      }

      downloadFile(content, filename);
      menu.classList.remove('open');
    });
  });
}

function rebuildMenuItems(): void {
  const menu = document.getElementById('exportMenu')!;
  const state = store.getState();
  const hasGrpc = state.endpoints.some(e => e.protocol === 'grpc-web');
  const selectedEp = state.selectedEndpointId
    ? state.endpoints.find(e => e.id === state.selectedEndpointId)
    : null;

  let html = '';
  html += `<button data-export="exportOpenAPI">Export All as OpenAPI 3.x</button>`;
  html += `<button data-export="exportHAR">Export All as HAR</button>`;
  html += `<button data-export="exportRawJSON">Export All as JSON (raw)</button>`;
  html += `<button data-export="exportFilteredJSON">Export All as JSON (filtered)</button>`;
  if (hasGrpc) {
    html += `<button data-export="exportProto">Export Proto definitions</button>`;
  }

  if (selectedEp) {
    html += '<div class="divider"></div>';
    html += `<button data-export="exportOpenAPI" data-selected="true">Export Selected as OpenAPI</button>`;
    html += `<button data-export="exportHAR" data-selected="true">Export Selected as HAR</button>`;
    if (selectedEp.protocol === 'grpc-web' && selectedEp.schema.proto) {
      html += `<button data-export="exportProto" data-selected="true">Export Selected as .proto</button>`;
    }
  }

  menu.innerHTML = html;
}

function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
