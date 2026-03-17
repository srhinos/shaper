import type { Endpoint, Sample, SchemaObject } from '../../lib/types';
import { toProtoFile } from '../../lib/export/proto-file';
import { store } from '../state';

export function renderDetailView(detail: { endpoint: Endpoint; samples: Sample[] } | null): void {
  const panel = document.getElementById('detailPanel')!;
  if (!detail) {
    panel.innerHTML = '<div class="detail-empty">Select an endpoint to view details</div>';
    return;
  }

  const { endpoint: ep, samples } = detail;
  let html = '';

  const fullUrl = `https://${ep.domain}${ep.urlPattern}`;
  html += `<div class="detail-header">`;
  html += `<h2><span class="method-badge method-${ep.method}">${ep.method}</span> ${escHtml(ep.urlPattern)} <button class="copy-btn" data-copy="${escAttr(fullUrl)}">Copy URL</button></h2>`;
  html += `<div class="meta">${escHtml(ep.domain)} &middot; ${ep.protocol} &middot; ${ep.sampleCount} samples</div>`;
  html += `</div>`;

  const latestSample = samples[samples.length - 1];
  html += `<div class="quick-actions">`;
  html += `<button class="copy-btn-action" data-delete-endpoint="${ep.id}" style="color:#f38ba8;border-color:#f38ba844">Delete Endpoint</button>`;
  if (latestSample) {
    html += `<button class="copy-btn-action" data-copy-curl="${samples.length - 1}">Copy curl (latest)</button>`;
  }
  if (ep.schema.response) {
    html += `<button class="copy-btn-action" data-copy-schema="response">Copy Response Schema</button>`;
  }
  if (ep.schema.request) {
    html += `<button class="copy-btn-action" data-copy-schema="request">Copy Request Schema</button>`;
  }
  if (ep.schema.proto) {
    html += `<button class="copy-btn-action" data-copy-proto="true">Copy .proto</button>`;
  }
  html += `<button class="copy-btn-action" data-export-endpoint="openapi">Copy as OpenAPI</button>`;
  html += `<button class="copy-btn-action" data-export-endpoint="har">Copy as HAR</button>`;
  html += `</div>`;

  if (ep.schema.queryParams && ep.schema.queryParams.length > 0) {
    const qpText = ep.schema.queryParams.map(p => {
      const presence = (p.seenCount || 0) < ep.sampleCount ? 'optional' : 'required';
      return `${p.name}: ${p.inferredType} (${presence}) [${p.observedValues.join(', ')}]`;
    }).join('\n');
    html += `<div class="section"><div class="section-header">Query Parameters <button class="copy-btn" data-copy="${escAttr(qpText)}">Copy</button></div>`;
    html += `<div class="section-body"><div class="schema-tree">`;
    for (const p of ep.schema.queryParams) {
      const isRequired = (p.seenCount || 0) >= ep.sampleCount;
      const presenceTag = isRequired
        ? '<span class="schema-required"> required</span>'
        : `<span class="schema-optional"> optional (${p.seenCount || 0}/${ep.sampleCount})</span>`;
      html += `<div><span class="schema-key">${escHtml(p.name)}</span>: <span class="schema-type">${p.inferredType}</span>${presenceTag}`;
      if (p.observedValues.length > 0) {
        const vals = p.observedValues.length <= 5
          ? p.observedValues.map(v => `"${escHtml(v)}"`).join(', ')
          : p.observedValues.slice(0, 3).map(v => `"${escHtml(v)}"`).join(', ') + `, ... +${p.observedValues.length - 3} more`;
        html += ` <span class="schema-optional">values: [${vals}]</span>`;
      }
      html += `</div>`;
    }
    html += `</div></div></div>`;
  }

  if (ep.schema.pathParams && ep.schema.pathParams.length > 0) {
    const ppText = ep.schema.pathParams.map(p => `${p.name}: ${p.inferredType} [${p.observedValues.join(', ')}]`).join('\n');
    html += `<div class="section"><div class="section-header">Path Parameters <button class="copy-btn" data-copy="${escAttr(ppText)}">Copy</button></div>`;
    html += `<div class="section-body"><div class="schema-tree">`;
    for (const p of ep.schema.pathParams) {
      html += `<div><span class="schema-key">${escHtml(p.name)}</span>: <span class="schema-type">${p.inferredType}</span>`;
      if (p.observedValues.length > 0) {
        html += ` <span class="schema-optional">values: [${p.observedValues.map(v => `"${escHtml(v)}"`).join(', ')}]</span>`;
      }
      html += `</div>`;
    }
    html += `</div></div></div>`;
  }

  if (samples.length > 0) {
    const aggReqHeaders = aggregateHeaders(samples.map(s => s.requestHeaders));
    if (aggReqHeaders.length > 0) {
      const reqHdrText = aggReqHeaders.map(h => `${h.name}: ${h.examples[0] || ''}`).join('\n');
      html += `<div class="section"><div class="section-header">Request Headers (${samples.length} samples) <button class="copy-btn" data-copy="${escAttr(reqHdrText)}">Copy</button></div>`;
      html += `<div class="section-body">${renderAggregatedHeaders(aggReqHeaders, samples.length)}</div></div>`;
    }

    const aggResHeaders = aggregateHeaders(samples.map(s => s.responseHeaders));
    if (aggResHeaders.length > 0) {
      const resHdrText = aggResHeaders.map(h => `${h.name}: ${h.examples[0] || ''}`).join('\n');
      html += `<div class="section"><div class="section-header">Response Headers <button class="copy-btn" data-copy="${escAttr(resHdrText)}">Copy</button></div>`;
      html += `<div class="section-body">${renderAggregatedHeaders(aggResHeaders, samples.length)}</div></div>`;
    }
  }

  if (ep.schema.request) {
    const reqSchemaJson = JSON.stringify(ep.schema.request, null, 2);
    html += `<div class="section"><div class="section-header">Request Body Schema <button class="copy-btn" data-copy="${escAttr(reqSchemaJson)}">Copy JSON Schema</button></div>`;
    html += `<div class="section-body"><div class="schema-tree">${renderSchema(ep.schema.request)}</div></div></div>`;
  }

  if (ep.schema.response) {
    for (const [status, schema] of Object.entries(ep.schema.response)) {
      const resSchemaJson = JSON.stringify(schema, null, 2);
      html += `<div class="section"><div class="section-header">Response ${status} Schema <button class="copy-btn" data-copy="${escAttr(resSchemaJson)}">Copy JSON Schema</button></div>`;
      html += `<div class="section-body"><div class="schema-tree">${renderSchema(schema)}</div></div></div>`;
    }
  }

  if (ep.schema.proto) {
    const protoText = renderProtoInline(ep);
    html += `<div class="section"><div class="section-header">Proto Definition <button class="copy-btn" data-copy="${escAttr(protoText)}">Copy .proto</button></div>`;
    html += `<div class="section-body"><pre>${escHtml(protoText)}</pre></div></div>`;
  }

  if (samples.length > 0) {
    html += `<div class="section"><div class="section-header">Samples (${samples.length})</div>`;
    html += `<div class="section-body">`;
    for (let i = 0; i < Math.min(samples.length, 20); i++) {
      html += renderSample(samples[i], i);
    }
    if (samples.length > 20) {
      html += `<div style="color:#6c7086;text-align:center;padding:8px">${samples.length - 20} more samples not shown</div>`;
    }
    html += `</div></div>`;
  }

  panel.innerHTML = html;
  bindAllCopyActions(panel, ep, samples);
  bindSampleTabs(panel);
}

interface AggHeader {
  name: string;
  count: number;
  examples: string[];
}

function aggregateHeaders(headerSets: Array<Array<{ name: string; value: string }>>): AggHeader[] {
  const map = new Map<string, { count: number; examples: Set<string> }>();
  for (const headers of headerSets) {
    for (const h of headers) {
      const lower = h.name.toLowerCase();
      let entry = map.get(lower);
      if (!entry) {
        entry = { count: 0, examples: new Set() };
        map.set(lower, entry);
      }
      entry.count++;
      if (entry.examples.size < 3) entry.examples.add(h.value);
    }
  }
  return [...map.entries()]
    .map(([name, data]) => ({ name, count: data.count, examples: [...data.examples] }))
    .sort((a, b) => b.count - a.count);
}

function renderAggregatedHeaders(headers: AggHeader[], totalSamples: number): string {
  let html = '<pre class="header-pre">';
  for (const h of headers) {
    const freq = h.count === totalSamples ? 'always' : `${h.count}/${totalSamples}`;
    const value = h.examples[0] || '';
    const truncated = value.length > 80 ? value.slice(0, 80) + '...' : value;
    html += `<span class="agg-header-name">${escHtml(h.name)}</span>: ${escHtml(truncated)} <span class="agg-header-count">${freq}</span>\n`;
  }
  html += '</pre>';
  return html;
}

function renderSchema(schema: SchemaObject, depth = 0, inlineLabel?: string): string {
  if (!schema) return '';
  const indent = depth > 0 ? ' class="schema-indent"' : '';

  if (schema.oneOf) {
    let html = `<div${indent}>`;
    if (inlineLabel) html += inlineLabel;
    html += `<span class="schema-type">oneOf</span>`;
    for (const variant of schema.oneOf) {
      html += renderSchema(variant, depth + 1);
    }
    html += `</div>`;
    return html;
  }

  if (schema.type === 'object' && schema.properties) {
    return renderObjectSchema(schema, depth, inlineLabel);
  }

  if (schema.type === 'array') {
    return renderArraySchema(schema, depth, inlineLabel);
  }

  let html = `<div${indent}>`;
  if (inlineLabel) html += inlineLabel;
  html += `<span class="schema-type">${escHtml(schema.type || 'unknown')}</span>`;
  html += renderEnumOrExample(schema);
  html += `</div>`;
  return html;
}

function renderObjectSchema(schema: SchemaObject, depth: number, inlineLabel?: string): string {
  const indent = depth > 0 ? ' class="schema-indent"' : '';
  const required = new Set(schema.required || []);
  let html = `<div${indent}>`;
  if (inlineLabel) html += inlineLabel;
  html += `<span style="color:#585b70">{</span>`;

  for (const [key, prop] of Object.entries(schema.properties!)) {
    const req = required.has(key)
      ? '<span class="schema-required"> required</span>'
      : '<span class="schema-optional"> optional</span>';
    const label = `<span class="schema-key">${escHtml(key)}</span>${req}: `;

    if (prop.type === 'object' && prop.properties) {
      html += renderObjectSchema(prop, depth + 1, `<div class="schema-indent">${label}</div>`);
    } else if (prop.type === 'array') {
      html += renderArraySchema(prop, depth + 1, `<div class="schema-indent">${label}</div>`);
    } else if (prop.oneOf) {
      html += renderSchema(prop, depth + 1, `<div class="schema-indent">${label}</div>`);
    } else {
      html += `<div class="schema-indent">${label}`;
      html += `<span class="schema-type">${escHtml(prop.type || 'unknown')}</span>`;
      html += renderEnumOrExample(prop);
      html += `</div>`;
    }
  }

  html += `<div class="schema-indent"><span style="color:#585b70">}</span></div>`;
  html += `</div>`;
  return html;
}

function renderArraySchema(schema: SchemaObject, depth: number, inlineLabel?: string): string {
  const indent = depth > 0 ? ' class="schema-indent"' : '';
  const items = schema.items;

  if (items && items.type && items.type !== 'object' && items.type !== 'array' && !items.oneOf) {
    let html = `<div${indent}>`;
    if (inlineLabel) html += inlineLabel;
    html += `<span class="schema-type">${escHtml(items.type)}[]</span>`;
    html += renderEnumOrExample(items);
    html += `</div>`;
    return html;
  }

  let html = `<div${indent}>`;
  if (inlineLabel) html += inlineLabel;
  html += `<span class="schema-type">array</span> <span style="color:#585b70">of:</span>`;
  if (items) {
    html += renderSchema(items, depth + 1);
  }
  html += `</div>`;
  return html;
}

function renderEnumOrExample(schema: SchemaObject): string {
  let html = '';
  if (schema.enum) {
    const vals = schema.enum.map(v => JSON.stringify(v));
    if (vals.length <= 5) {
      html += ` <span class="schema-optional">enum: [${vals.join(', ')}]</span>`;
    } else {
      html += ` <span class="schema-optional">enum: [${vals.slice(0, 3).join(', ')}, ... +${vals.length - 3} more]</span>`;
    }
  } else if (schema.example !== undefined) {
    const ex = JSON.stringify(schema.example);
    html += ` <span class="schema-optional">e.g. ${ex.length > 60 ? ex.slice(0, 60) + '...' : ex}</span>`;
  }
  return html;
}

function renderSample(s: Sample, idx: number): string {
  const curl = buildCurl(s);
  const sid = `sample-${idx}`;
  let html = `<details class="sample-item">`;
  html += `<summary class="sample-summary">`;
  html += `<span style="color:#6c7086">${s.timestamp.slice(0, 19)}</span>`;
  html += `<span style="color:${s.status >= 400 ? '#f38ba8' : '#a6e3a1'}">${s.status}</span>`;
  html += `<span style="color:#a6adc8">${escHtml(s.url.length > 60 ? s.url.slice(0, 60) + '...' : s.url)}</span>`;
  html += `</summary>`;
  html += `<div class="sample-detail">`;

  html += `<div class="sample-tabs" data-sample="${sid}">`;
  html += `<button class="sample-tab active" data-tab="${sid}-reqheaders">Req Headers</button>`;
  html += `<button class="sample-tab" data-tab="${sid}-reqbody">Req Body</button>`;
  html += `<button class="sample-tab" data-tab="${sid}-resheaders">Res Headers</button>`;
  html += `<button class="sample-tab" data-tab="${sid}-resbody">Res Body</button>`;
  html += `<button class="sample-tab" data-tab="${sid}-curl">curl</button>`;
  html += `</div>`;

  html += `<div class="sample-tab-content active" id="${sid}-reqheaders">`;
  html += renderHeaderTable(s.requestHeaders);
  html += `</div>`;

  html += `<div class="sample-tab-content" id="${sid}-reqbody">`;
  if (s.requestBody) {
    html += `<pre>${escHtml(formatBody(s.requestBody))}</pre>`;
  } else {
    html += `<span style="color:#6c7086">No request body</span>`;
  }
  html += `</div>`;

  html += `<div class="sample-tab-content" id="${sid}-resheaders">`;
  html += renderHeaderTable(s.responseHeaders);
  html += `</div>`;

  html += `<div class="sample-tab-content" id="${sid}-resbody">`;
  if (s.protobuf && s.protobuf.fields.length > 0) {
    html += `<div style="margin-bottom:6px"><button class="raw-toggle" data-target="${sid}-resbody-raw" style="background:#45475a;color:#a6adc8;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-family:monospace;font-size:9px">Show raw</button></div>`;
    html += `<pre id="${sid}-resbody-decoded">${renderDecodedProto(s.protobuf.fields, 0)}</pre>`;
    html += `<pre id="${sid}-resbody-raw" style="display:none">${escHtml(truncate(s.responseBody || '', 5000))}</pre>`;
  } else if (s.responseBody) {
    html += `<pre>${escHtml(formatBody(truncate(s.responseBody, 5000)))}</pre>`;
  } else {
    html += `<span style="color:#6c7086">No response body</span>`;
  }
  html += `</div>`;

  html += `<div class="sample-tab-content" id="${sid}-curl">`;
  html += `<div style="margin-bottom:4px"><button class="curl-copy" data-curl="${escAttr(curl)}">Copy curl</button></div>`;
  html += `<pre>${escHtml(curl)}</pre>`;
  html += `</div>`;

  html += `</div></details>`;
  return html;
}

function renderDecodedProto(fields: import('../../lib/types').ProtoField[], depth: number): string {
  const indent = '  '.repeat(depth);
  let out = '';
  for (const f of fields) {
    const label = `<span class="schema-key">field_${f.number}</span>`;
    const type = `<span class="schema-type">${f.inferredType}</span>`;
    if (f.nested && f.nested.fields.length > 0) {
      out += `${indent}${label} (${type}) {\n`;
      out += renderDecodedProto(f.nested.fields, depth + 1);
      out += `${indent}}\n`;
    } else if (f.exampleValue !== undefined) {
      const val = typeof f.exampleValue === 'string'
        ? `<span style="color:#a6e3a1">"${escHtml(f.exampleValue)}"</span>`
        : `<span style="color:#f9e2af">${f.exampleValue}</span>`;
      out += `${indent}${label}: ${val}  <span style="color:#585b70">// ${f.inferredType}</span>\n`;
    } else {
      out += `${indent}${label}: <span style="color:#585b70">(${f.inferredType})</span>\n`;
    }
  }
  return out;
}

function renderHeaderTable(headers: Array<{ name: string; value: string }>): string {
  if (headers.length === 0) return '<span style="color:#6c7086">No headers</span>';
  let html = '<pre class="header-pre">';
  for (const h of headers) {
    html += `<span class="agg-header-name">${escHtml(h.name)}</span>: ${escHtml(h.value)}\n`;
  }
  html += '</pre>';
  return html;
}

function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function bindSampleTabs(container: HTMLElement): void {
  for (const tabBar of container.querySelectorAll('.sample-tabs')) {
    for (const tab of tabBar.querySelectorAll('.sample-tab')) {
      tab.addEventListener('click', () => {
        const targetId = (tab as HTMLElement).dataset.tab!;
        for (const t of tabBar.querySelectorAll('.sample-tab')) t.classList.remove('active');
        tab.classList.add('active');
        const sid = (tabBar as HTMLElement).dataset.sample!;
        const panel = container;
        for (const content of panel.querySelectorAll(`[id^="${sid}-"]`)) {
          (content as HTMLElement).classList.remove('active');
        }
        document.getElementById(targetId)?.classList.add('active');
      });
    }
  }

  for (const btn of container.querySelectorAll('.raw-toggle')) {
    btn.addEventListener('click', () => {
      const rawId = (btn as HTMLElement).dataset.target!;
      const decodedId = rawId.replace('-raw', '-decoded');
      const rawEl = document.getElementById(rawId);
      const decodedEl = document.getElementById(decodedId);
      if (!rawEl || !decodedEl) return;
      const showingRaw = rawEl.style.display !== 'none';
      rawEl.style.display = showingRaw ? 'none' : 'block';
      decodedEl.style.display = showingRaw ? 'block' : 'none';
      (btn as HTMLElement).textContent = showingRaw ? 'Show raw' : 'Show decoded';
    });
  }
}

function buildCurl(s: Sample): string {
  let curl = `curl '${s.url}'`;
  if (s.method !== 'GET') curl += ` -X ${s.method}`;
  for (const h of s.requestHeaders) {
    if (/^(host|connection|accept-encoding)$/i.test(h.name)) continue;
    curl += ` \\\n  -H '${h.name}: ${h.value}'`;
  }
  if (s.requestBody) {
    const escaped = s.requestBody.replace(/'/g, "'\\''");
    curl += ` \\\n  --data-raw '${escaped}'`;
  }
  return curl;
}

function renderProtoInline(ep: Endpoint): string {
  if (!ep.schema.proto) return '';
  return toProtoFile([{ schema: ep.schema.proto, source: ep.pattern, sampleCount: ep.sampleCount }]);
}

function copyAndFlash(btn: HTMLElement, text: string): void {
  const original = btn.textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 1500);
  });
}

function bindAllCopyActions(container: HTMLElement, ep: Endpoint, samples: Sample[]): void {
  for (const btn of container.querySelectorAll('.curl-copy')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyAndFlash(btn as HTMLElement, (btn as HTMLElement).dataset.curl || '');
    });
  }

  for (const btn of container.querySelectorAll('.copy-btn')) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyAndFlash(btn as HTMLElement, (btn as HTMLElement).dataset.copy || '');
    });
  }

  for (const btn of container.querySelectorAll('.copy-btn-action[data-copy-curl]')) {
    btn.addEventListener('click', () => {
      const idx = parseInt((btn as HTMLElement).dataset.copyCurl || '0');
      if (samples[idx]) copyAndFlash(btn as HTMLElement, buildCurl(samples[idx]));
    });
  }

  for (const btn of container.querySelectorAll('.copy-btn-action[data-copy-schema]')) {
    btn.addEventListener('click', () => {
      const which = (btn as HTMLElement).dataset.copySchema;
      if (which === 'response' && ep.schema.response) {
        copyAndFlash(btn as HTMLElement, JSON.stringify(ep.schema.response, null, 2));
      } else if (which === 'request' && ep.schema.request) {
        copyAndFlash(btn as HTMLElement, JSON.stringify(ep.schema.request, null, 2));
      }
    });
  }

  for (const btn of container.querySelectorAll('.copy-btn-action[data-copy-proto]')) {
    btn.addEventListener('click', () => {
      const text = renderProtoInline(ep);
      if (text) copyAndFlash(btn as HTMLElement, text);
    });
  }

  for (const btn of container.querySelectorAll('.copy-btn-action[data-delete-endpoint]')) {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.deleteEndpoint!;
      if (confirm('Delete this endpoint and its samples?')) {
        browser.runtime.sendMessage({ type: 'deleteEndpoint', endpointId: id }).then(() => {
          const state = store.getState();
          store.setState({
            endpoints: state.endpoints.filter(e => e.id !== id),
            selectedEndpointId: null,
            selectedDetail: null,
          });
        });
      }
    });
  }

  for (const btn of container.querySelectorAll('.copy-btn-action[data-export-endpoint]')) {
    btn.addEventListener('click', () => {
      const format = (btn as HTMLElement).dataset.exportEndpoint;
      const type = format === 'openapi' ? 'exportOpenAPI' : 'exportHAR';
      browser.runtime.sendMessage({ type, endpointIds: [ep.id] }).then((data: any) => {
        const text = format === 'openapi'
          ? JSON.stringify(data.specs, null, 2)
          : JSON.stringify(data.har, null, 2);
        copyAndFlash(btn as HTMLElement, text);
      });
    });
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '\n... truncated';
}

function escHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
