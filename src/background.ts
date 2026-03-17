import { Storage } from './lib/storage';
import { startInterceptor } from './lib/capture/http-interceptor';
import { normalizeUrl, createEndpointPattern, matchEndpoint, createGraphQLPattern } from './lib/analysis/endpoint-grouper';
import { inferSchema } from './lib/analysis/schema-inferrer';
import { mergeSchemas } from './lib/analysis/merge';
import { inferProtoSchema, mergeProtoSchemas } from './lib/analysis/proto-inferrer';
import { decodeProtobuf } from './lib/capture/protobuf-decoder';
import { unwrapGrpcWeb } from './lib/capture/grpc-web';
import { generateOpenAPI, generateOpenAPIPerDomain } from './lib/export/openapi';
import { toProtoFile } from './lib/export/proto-file';
import { toHAR } from './lib/export/har';
import { exportRaw, exportFiltered } from './lib/export/raw';
import { filterHeaders } from './lib/headers';
import type { Endpoint, Sample, InferredSchema, SchemaObject, UserSettings, HeaderFilterConfig, Protocol } from './lib/types';

const storage = new Storage();
let endpoints: Endpoint[] = [];
const trackedTabs = new Map<number, string>();
let allTabs = false;
let domainFilters: string[] = [];
let settings: UserSettings = { maxSamplesPerEndpoint: 200, badgeDisplay: 'endpoints', theme: 'dark' };
let headerFilterConfig: HeaderFilterConfig = { enabledPresets: [], customExcludes: [], customIncludes: [] };
const dashboardPorts: Set<any> = new Set();

function isRecording(): boolean {
  return allTabs || trackedTabs.size > 0;
}

function shouldCapture(tabId: number): boolean {
  if (tabId < 0) return false;
  return allTabs || trackedTabs.has(tabId);
}

function matchesDomainFilter(url: string): boolean {
  if (domainFilters.length === 0) return true;
  try {
    const hostname = new URL(url).hostname;
    return domainFilters.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

let badgeInterval: ReturnType<typeof setInterval> | null = null;
let badgeFlashUntil = 0;
let badgeBright = true;

function updateBadge(): void {
  const count = settings.badgeDisplay === 'endpoints' ? endpoints.length : endpoints.reduce((s, e) => s + e.sampleCount, 0);
  if (count > 0) {
    browser.browserAction.setBadgeText({ text: String(count) });
  } else if (isRecording()) {
    browser.browserAction.setBadgeText({ text: '0' });
  } else {
    browser.browserAction.setBadgeText({ text: '' });
  }
  startOrStopBadgeLoop();
}

function startOrStopBadgeLoop(): void {
  if (isRecording() && !badgeInterval) {
    badgeBright = true;
    badgeInterval = setInterval(tickBadge, 800);
    tickBadge();
  } else if (!isRecording() && badgeInterval) {
    clearInterval(badgeInterval);
    badgeInterval = null;
    browser.browserAction.setBadgeBackgroundColor({ color: '#6c7086' });
  }
}

function tickBadge(): void {
  if (Date.now() < badgeFlashUntil) {
    browser.browserAction.setBadgeBackgroundColor({ color: '#f9e2af' });
    return;
  }

  badgeBright = !badgeBright;

  browser.tabs.query({ active: true, currentWindow: true }).then((tabs: any[]) => {
    if (!tabs[0]) return;
    const thisTabRecording = allTabs || trackedTabs.has(tabs[0].id);
    if (!thisTabRecording) {
      browser.browserAction.setBadgeBackgroundColor({ color: '#6c7086' });
      return;
    }
    browser.browserAction.setBadgeBackgroundColor({ color: badgeBright ? '#a6e3a1' : '#313244' });
  }).catch(() => {});
}

function flashBadgeForHit(_tabId: number): void {
  badgeFlashUntil = Date.now() + 400;
}

function notifyDashboard(msg: any): void {
  for (const port of dashboardPorts) {
    try { port.postMessage(msg); } catch { dashboardPorts.delete(port); }
  }
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function deduplicateCheck(endpointId: string, sample: Sample, existingSamples: Sample[]): boolean {
  const bodyHash = sample.responseBody ? simpleHash(sample.responseBody) : '';
  const key = `${sample.method}|${sample.url}|${sample.requestBody || ''}|${sample.status}|${bodyHash}`;
  for (const s of existingSamples) {
    const existingHash = s.responseBody ? simpleHash(s.responseBody) : '';
    const existingKey = `${s.method}|${s.url}|${s.requestBody || ''}|${s.status}|${existingHash}`;
    if (key === existingKey) return true;
  }
  return false;
}

function deriveProtoMessageName(urlPattern: string): string {
  const path = urlPattern.split('?')[0];
  const segments = path.split('/').filter(s => s && !s.startsWith(':'));
  if (segments.length === 0) return 'Response';
  const last = segments[segments.length - 1];
  return last.replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase())
    .replace(/_/g, '') || 'Response';
}

function extractProtobufBytes(body: string): Uint8Array | null {
  const match = body.match(/\[protobuf: \d+ bytes, base64:(.+)\]/);
  if (!match) return null;
  try {
    const binary = atob(match[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch { return null; }
}

async function processSample(sample: Sample, tabId: number): Promise<void> {
  try {
    let pattern: string;
    let domain: string;

    try { domain = new URL(sample.url).hostname; } catch { return; }

    if (sample.protocol === 'graphql' && sample.graphql) {
      pattern = createGraphQLPattern(sample.graphql.operationName, sample.graphql.query);
    } else {
      pattern = createEndpointPattern(sample.method, sample.url);
    }

    const urlPattern = pattern.replace(/^\w+\s+/, '');
    const existing = endpoints.find(
      e => e.pattern === pattern && e.domain === domain && e.protocol === sample.protocol
    );

    let endpoint: Endpoint;
    let isNew = false;

    if (existing) {
      endpoint = existing;
    } else {
      isNew = true;
      endpoint = {
        id: crypto.randomUUID(),
        pattern,
        method: sample.method,
        urlPattern,
        domain,
        protocol: sample.protocol,
        sampleCount: 0,
        schema: {},
      };
      endpoints.push(endpoint);
    }

    const samples = await storage.getSamples(endpoint.id);
    if (deduplicateCheck(endpoint.id, sample, samples)) return;

    flashBadgeForHit(tabId);
    samples.push(sample);
    if (samples.length > settings.maxSamplesPerEndpoint) {
      samples.shift();
    }
    endpoint.sampleCount++;

    if (sample.responseBody && sample.protocol !== 'grpc-web') {
      try {
        const parsed = JSON.parse(sample.responseBody);
        const responseSchema = inferSchema(parsed);
        const statusKey = String(sample.status);
        if (!endpoint.schema.response) endpoint.schema.response = {};
        if (endpoint.schema.response[statusKey]) {
          endpoint.schema.response[statusKey] = mergeSchemas(endpoint.schema.response[statusKey], responseSchema);
        } else {
          endpoint.schema.response[statusKey] = responseSchema;
        }
      } catch { /* not JSON */ }
    }

    try {
      const sampleUrl = new URL(sample.url);
      if (!endpoint.schema.queryParams) endpoint.schema.queryParams = [];
      const seenKeysThisSample = new Set<string>();
      for (const [key, value] of sampleUrl.searchParams) {
        seenKeysThisSample.add(key);
        let param = endpoint.schema.queryParams.find(p => p.name === key);
        if (!param) {
          param = { name: key, observedValues: [], inferredType: 'string', seenCount: 0 };
          endpoint.schema.queryParams.push(param);
        }
        if (value && !param.observedValues.includes(value) && param.observedValues.length < 20) {
          param.observedValues.push(value);
        }
        if (param.observedValues.every(v => /^\d+$/.test(v))) param.inferredType = 'integer';
        else if (param.observedValues.every(v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))) param.inferredType = 'uuid';
        else param.inferredType = 'string';
      }
      for (const p of endpoint.schema.queryParams) {
        if (seenKeysThisSample.has(p.name)) p.seenCount = (p.seenCount || 0) + 1;
      }

      const pathSegments = sampleUrl.pathname.split('/');
      const patternSegments = endpoint.urlPattern.split('?')[0].split('/');
      if (!endpoint.schema.pathParams) endpoint.schema.pathParams = [];
      for (let i = 0; i < patternSegments.length; i++) {
        if (patternSegments[i].startsWith(':')) {
          const paramName = patternSegments[i];
          const value = pathSegments[i] || '';
          let param = endpoint.schema.pathParams.find(p => p.name === paramName);
          if (!param) {
            param = { name: paramName, observedValues: [], inferredType: 'string' };
            endpoint.schema.pathParams.push(param);
          }
          if (value && !param.observedValues.includes(value) && param.observedValues.length < 20) {
            param.observedValues.push(value);
          }
          if (param.observedValues.every(v => /^\d+$/.test(v))) param.inferredType = 'integer';
          else if (param.observedValues.every(v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))) param.inferredType = 'uuid';
          else param.inferredType = 'string';
        }
      }
    } catch { /* URL parse error */ }

    if (sample.requestBody && sample.protocol !== 'grpc-web') {
      try {
        const parsed = JSON.parse(sample.requestBody);
        const requestSchema = inferSchema(parsed);
        if (endpoint.schema.request) {
          endpoint.schema.request = mergeSchemas(endpoint.schema.request, requestSchema);
        } else {
          endpoint.schema.request = requestSchema;
        }
      } catch { /* not JSON */ }
    }

    if (sample.protocol === 'grpc-web' && sample.responseBody) {
      try {
        const raw = extractProtobufBytes(sample.responseBody);
        if (raw) {
          const frames = unwrapGrpcWeb(raw);
          for (const frame of frames) {
            const decoded = decodeProtobuf(frame);
            if (decoded.fields.length > 0) {
              sample.protobuf = decoded;
              const protoSchema = inferProtoSchema(
                deriveProtoMessageName(endpoint.urlPattern),
                [decoded],
              );
              if (endpoint.schema.proto) {
                endpoint.schema.proto = mergeProtoSchemas(endpoint.schema.proto, protoSchema);
              } else {
                endpoint.schema.proto = protoSchema;
              }
              break;
            }
          }
          if (!sample.protobuf && raw.length > 0) {
            const decoded = decodeProtobuf(raw);
            if (decoded.fields.length > 0) {
              sample.protobuf = decoded;
              const protoSchema = inferProtoSchema(
                deriveProtoMessageName(endpoint.urlPattern),
                [decoded],
              );
              if (endpoint.schema.proto) {
                endpoint.schema.proto = mergeProtoSchemas(endpoint.schema.proto, protoSchema);
              } else {
                endpoint.schema.proto = protoSchema;
              }
            }
          }
        }
      } catch (e) { console.error('Shaper: protobuf decode error', e); }
    }

    await storage.saveSamples(endpoint.id, samples);
    await storage.saveEndpoint(endpoint);
    updateBadge();

    if (isNew) {
      notifyDashboard({ type: 'endpointCreated', endpoint });
    } else {
      notifyDashboard({ type: 'endpointUpdated', endpointId: endpoint.id, sampleCount: endpoint.sampleCount, schema: endpoint.schema });
    }
  } catch (e) {
    console.error('Shaper: processSample error', e);
  }
}

async function init(): Promise<void> {
  await storage.init();
  endpoints = await storage.getEndpoints();
  const settingsData = await storage.getSettings();
  settings = settingsData.settings;
  headerFilterConfig = settingsData.headerFilterConfig;
  domainFilters = settingsData.domainFilters;

  startInterceptor({
    shouldCapture,
    matchesDomainFilter,
    onSampleComplete: processSample,
  });

  updateBadge();
}

browser.runtime.onConnect.addListener((port: any) => {
  if (port.name === 'dashboard') {
    dashboardPorts.add(port);
    port.onDisconnect.addListener(() => dashboardPorts.delete(port));
  }
});

browser.tabs.onRemoved.addListener((tabId: number) => {
  trackedTabs.delete(tabId);
  updateBadge();
});

browser.tabs.onActivated.addListener(() => {
  tickBadge();
});

browser.commands.onCommand.addListener((command: string) => {
  if (command === 'toggle-capture') {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs: any[]) => {
      if (!tabs[0]) return;
      const tabId = tabs[0].id!;
      if (trackedTabs.has(tabId)) {
        trackedTabs.delete(tabId);
      } else {
        allTabs = false;
        trackedTabs.set(tabId, (tabs[0].title || tabs[0].url || '').slice(0, 30));
      }
      updateBadge();
      notifyDashboard({ type: 'captureStateChanged', recording: isRecording(), trackedTabs: [...trackedTabs.entries()].map(([id, title]) => ({ id, title })) });
    });
  }
});

browser.runtime.onMessage.addListener(((msg: any, sender: any, sendResponse: any) => {
  switch (msg.type) {
    case 'getState':
      sendResponse({
        recording: isRecording(),
        allTabs,
        trackedTabs: [...trackedTabs.entries()].map(([id, title]) => ({ id, title })),
        domainFilters,
        endpointCount: endpoints.length,
        sampleCount: endpoints.reduce((s, e) => s + e.sampleCount, 0),
      });
      break;

    case 'addTab':
      trackedTabs.set(msg.tabId, msg.title || `Tab ${msg.tabId}`);
      allTabs = false;
      updateBadge();
      notifyDashboard({ type: 'captureStateChanged', recording: isRecording(), trackedTabs: [...trackedTabs.entries()].map(([id, title]) => ({ id, title })) });
      sendResponse({ ok: true });
      break;

    case 'removeTab':
      trackedTabs.delete(msg.tabId);
      updateBadge();
      notifyDashboard({ type: 'captureStateChanged', recording: isRecording(), trackedTabs: [...trackedTabs.entries()].map(([id, title]) => ({ id, title })) });
      sendResponse({ ok: true });
      break;

    case 'allTabs':
      allTabs = true;
      trackedTabs.clear();
      updateBadge();
      notifyDashboard({ type: 'captureStateChanged', recording: isRecording(), trackedTabs: [] });
      sendResponse({ ok: true });
      break;

    case 'pause':
      allTabs = false;
      trackedTabs.clear();
      updateBadge();
      notifyDashboard({ type: 'captureStateChanged', recording: isRecording(), trackedTabs: [] });
      sendResponse({ ok: true });
      break;

    case 'getEndpoints':
      sendResponse({ endpoints });
      break;

    case 'getEndpointDetail':
      (async () => {
        const ep = endpoints.find(e => e.id === msg.endpointId);
        const samples = ep ? await storage.getSamples(ep.id) : [];
        sendResponse({ endpoint: ep || null, samples });
      })();
      return true;

    case 'deleteEndpoint':
      (async () => {
        endpoints = endpoints.filter(e => e.id !== msg.endpointId);
        await storage.deleteEndpoint(msg.endpointId);
        updateBadge();
        sendResponse({ ok: true });
      })();
      return true;

    case 'clear':
      (async () => {
        endpoints = [];
        await storage.clear();
        updateBadge();
        sendResponse({ ok: true });
      })();
      return true;

    case 'exportOpenAPI':
      sendResponse({ specs: generateOpenAPIPerDomain(
        msg.endpointIds ? endpoints.filter(e => msg.endpointIds.includes(e.id)) : endpoints
      )});
      break;

    case 'exportProto': {
      const grpcEndpoints = (msg.endpointIds ? endpoints.filter(e => msg.endpointIds.includes(e.id)) : endpoints)
        .filter(e => e.protocol === 'grpc-web' && e.schema.proto);
      const proto = toProtoFile(grpcEndpoints.map(e => ({
        schema: e.schema.proto!,
        source: e.pattern,
        sampleCount: e.sampleCount,
      })));
      sendResponse({ proto });
      break;
    }

    case 'exportHAR':
      (async () => {
        const eps = msg.endpointIds ? endpoints.filter(e => msg.endpointIds.includes(e.id)) : endpoints;
        const allSamples: Sample[] = [];
        for (const ep of eps) {
          const s = await storage.getSamples(ep.id);
          allSamples.push(...s);
        }
        sendResponse({ har: toHAR(allSamples) });
      })();
      return true;

    case 'exportRawJSON':
      (async () => {
        const eps = msg.endpointIds ? endpoints.filter(e => msg.endpointIds.includes(e.id)) : endpoints;
        const allSamples: Sample[] = [];
        for (const ep of eps) {
          const s = await storage.getSamples(ep.id);
          allSamples.push(...s);
        }
        sendResponse({ data: exportRaw(allSamples) });
      })();
      return true;

    case 'exportFilteredJSON':
      (async () => {
        const eps = msg.endpointIds ? endpoints.filter(e => msg.endpointIds.includes(e.id)) : endpoints;
        const allSamples: Sample[] = [];
        for (const ep of eps) {
          const s = await storage.getSamples(ep.id);
          allSamples.push(...s);
        }
        sendResponse({ data: exportFiltered(allSamples, headerFilterConfig) });
      })();
      return true;

    case 'getSettings':
      sendResponse({ settings, headerFilterConfig, domainFilters });
      break;

    case 'updateSettings':
      settings = msg.settings;
      (async () => {
        await storage.saveSettings({ settings, headerFilterConfig, domainFilters });
        sendResponse({ ok: true });
      })();
      return true;

    case 'updateHeaderFilters':
      headerFilterConfig = msg.headerFilterConfig;
      (async () => {
        await storage.saveSettings({ settings, headerFilterConfig, domainFilters });
        sendResponse({ ok: true });
      })();
      return true;

    case 'setDomainFilters':
      domainFilters = msg.domains;
      (async () => {
        await storage.saveSettings({ settings, headerFilterConfig, domainFilters });
        sendResponse({ ok: true });
      })();
      return true;
  }
}) as any);

init();
