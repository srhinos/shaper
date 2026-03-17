import type { Sample, HeaderEntry, Protocol } from '../types';
import { detectGraphQL, parseGraphQLBody } from './graphql-detector';
import { SseParser } from './sse-handler';

interface InterceptorConfig {
  shouldCapture: (tabId: number) => boolean;
  matchesDomainFilter: (url: string) => boolean;
  onSampleComplete: (sample: Sample, tabId: number) => void;
}

interface PendingEntry {
  requestId: string;
  tabId: number;
  timestamp: string;
  method: string;
  url: string;
  requestHeaders: HeaderEntry[];
  requestBody: string | null;
  responseHeaders: HeaderEntry[];
  responseBody: string | null;
  status: number;
  contentType: string | null;
  sseParser?: SseParser;
  sseDebounce?: ReturnType<typeof setTimeout>;
  sseSampleEmitted?: boolean;
}

const TEXT_TYPES = /^(text\/|application\/json|application\/xml|application\/javascript|application\/.*\+json|application\/.*\+xml)/i;
const GRPC_TYPES = /^application\/(grpc-web|x-protobuf|protobuf)/i;
const GZIP_MAGIC = [0x1f, 0x8b];
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];
const SSE_DEBOUNCE_MS = 5000;

export function startInterceptor(config: InterceptorConfig): void {
  const pending = new Map<string, PendingEntry>();
  const filter = { urls: ['<all_urls>'] as string[] };

  function emitSseSample(entry: PendingEntry): void {
    if (!entry.sseParser || entry.sseParser.events.length === 0) return;
    const sample = buildSample(entry);
    sample.sse = { events: [...entry.sseParser.events] };
    sample.responseBody = JSON.stringify(entry.sseParser.events.slice(-20));
    entry.sseSampleEmitted = true;
    config.onSampleComplete(sample, entry.tabId);
  }

  browser.webRequest.onBeforeRequest.addListener(
    (details: any) => {
      try {
        if (!config.shouldCapture(details.tabId)) return;
        if (details.type !== 'xmlhttprequest') return;
        if (!config.matchesDomainFilter(details.url)) return;

        const entry: PendingEntry = {
          requestId: details.requestId,
          tabId: details.tabId,
          timestamp: new Date(details.timeStamp).toISOString(),
          method: details.method,
          url: details.url,
          requestHeaders: [],
          requestBody: null,
          responseHeaders: [],
          responseBody: null,
          status: 0,
          contentType: null,
        };

        if (details.requestBody) {
          if (details.requestBody.raw?.length) {
            try {
              const decoder = new TextDecoder();
              entry.requestBody = details.requestBody.raw
                .map((part: any) => part.bytes ? decoder.decode(part.bytes) : '')
                .join('');
            } catch (e) { console.error('Shaper: request body decode error', e); }
          } else if (details.requestBody.formData) {
            entry.requestBody = JSON.stringify(details.requestBody.formData);
          }
        }

        pending.set(details.requestId, entry);

        const f = browser.webRequest.filterResponseData(details.requestId);
        const chunks: Uint8Array[] = [];

        f.ondata = (event: any) => {
          try {
            const data = new Uint8Array(event.data);
            f.write(event.data);

            if (entry.contentType?.includes('text/event-stream')) {
              if (!entry.sseParser) entry.sseParser = new SseParser();
              const text = new TextDecoder().decode(data);
              entry.sseParser.feed(text);

              if (entry.sseDebounce) clearTimeout(entry.sseDebounce);
              entry.sseDebounce = setTimeout(() => emitSseSample(entry), SSE_DEBOUNCE_MS);
            } else {
              chunks.push(data);
            }
          } catch (e) { console.error('Shaper: filter ondata error', e); }
        };

        f.onstop = () => {
          try {
            if (entry.sseParser) {
              if (entry.sseDebounce) clearTimeout(entry.sseDebounce);
              emitSseSample(entry);
            } else {
              const total = concatBuffers(chunks);
              entry.responseBody = decodeBody(total, entry.contentType);
            }
          } catch (e) { console.error('Shaper: filter onstop error', e); }
          f.close();
        };

        f.onerror = () => {
          try {
            if (entry.sseParser) {
              if (entry.sseDebounce) clearTimeout(entry.sseDebounce);
              emitSseSample(entry);
            }
            f.close();
          } catch { /* ignore */ }
        };
      } catch (e) { console.error('Shaper: onBeforeRequest error', e); }
    },
    filter,
    ['requestBody'],
  );

  browser.webRequest.onBeforeSendHeaders.addListener(
    (details: any) => {
      try {
        if (!pending.has(details.requestId)) return;
        const headers = details.requestHeaders.filter((h: any) => {
          const l = h.name.toLowerCase();
          return l !== 'accept-encoding' && l !== 'if-none-match' && l !== 'if-modified-since';
        });
        headers.push({ name: 'Accept-Encoding', value: 'identity' });
        headers.push({ name: 'Cache-Control', value: 'no-cache' });
        return { requestHeaders: headers };
      } catch (e) { console.error('Shaper: onBeforeSendHeaders error', e); }
    },
    filter,
    ['blocking', 'requestHeaders'],
  );

  browser.webRequest.onSendHeaders.addListener(
    (details: any) => {
      try {
        const pe = pending.get(details.requestId);
        if (!pe) return;
        pe.requestHeaders = (details.requestHeaders || []).map((h: any) => ({ name: h.name, value: h.value || '' }));
      } catch (e) { console.error('Shaper: onSendHeaders error', e); }
    },
    filter,
    ['requestHeaders'],
  );

  browser.webRequest.onHeadersReceived.addListener(
    (details: any) => {
      try {
        const pe = pending.get(details.requestId);
        if (!pe) return;
        pe.status = details.statusCode;
        pe.responseHeaders = (details.responseHeaders || []).map((h: any) => ({ name: h.name, value: h.value || '' }));
        const ct = pe.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
        pe.contentType = ct?.value || null;
      } catch (e) { console.error('Shaper: onHeadersReceived error', e); }
    },
    filter,
    ['responseHeaders'],
  );

  browser.webRequest.onCompleted.addListener((details: any) => {
    try {
      const pe = pending.get(details.requestId);
      if (!pe) return;
      pending.delete(details.requestId);
      if (pe.sseParser) return;
      setTimeout(() => {
        try {
          const sample = buildSample(pe);
          config.onSampleComplete(sample, pe.tabId);
        } catch (e) { console.error('Shaper: sample build error', e); }
      }, 500);
    } catch (e) { console.error('Shaper: onCompleted error', e); }
  }, filter);

  browser.webRequest.onErrorOccurred.addListener((details: any) => {
    try {
      const pe = pending.get(details.requestId);
      if (!pe) return;
      pending.delete(details.requestId);
      if (pe.sseParser) return;
      const error = (details as any).error || '';
      if (error === 'NS_BINDING_ABORTED' || error === 'NS_ERROR_ABORT') return;
      pe.status = 0;
      pe.responseBody = `ERROR: ${error}`;
      const sample = buildSample(pe);
      config.onSampleComplete(sample, pe.tabId);
    } catch (e) { console.error('Shaper: onErrorOccurred error', e); }
  }, filter);
}

function concatBuffers(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { result.set(c, offset); offset += c.length; }
  return result;
}

function decodeBody(buf: Uint8Array, contentType: string | null): string {
  if (buf.length === 0) return '';
  if (buf.length >= 2 && buf[0] === GZIP_MAGIC[0] && buf[1] === GZIP_MAGIC[1]) {
    return `[binary: ${buf.length} bytes, gzip-compressed]`;
  }
  if (buf.length >= 4 && buf[0] === ZSTD_MAGIC[0] && buf[1] === ZSTD_MAGIC[1] && buf[2] === ZSTD_MAGIC[2] && buf[3] === ZSTD_MAGIC[3]) {
    return `[binary: ${buf.length} bytes, zstd-compressed]`;
  }
  if (contentType && GRPC_TYPES.test(contentType)) {
    return `[protobuf: ${buf.length} bytes, base64:${uint8ToBase64(buf)}]`;
  }
  if (!contentType || TEXT_TYPES.test(contentType)) {
    return new TextDecoder().decode(buf);
  }
  return `[binary: ${buf.length} bytes, ${contentType}]`;
}

function detectProtocol(entry: PendingEntry): Protocol {
  if (entry.contentType && GRPC_TYPES.test(entry.contentType)) return 'grpc-web';
  if (detectGraphQL(entry.method, entry.url, entry.requestBody)) return 'graphql';
  if (entry.contentType?.includes('text/event-stream')) return 'sse';
  return 'http';
}

function buildSample(entry: PendingEntry): Sample {
  const protocol = detectProtocol(entry);
  const sample: Sample = {
    id: crypto.randomUUID(),
    timestamp: entry.timestamp,
    method: entry.method,
    url: entry.url,
    requestHeaders: entry.requestHeaders,
    requestBody: entry.requestBody,
    responseHeaders: entry.responseHeaders,
    responseBody: entry.responseBody,
    status: entry.status,
    protocol,
    contentType: entry.contentType,
  };

  if (protocol === 'graphql' && entry.requestBody) {
    sample.graphql = parseGraphQLBody(entry.requestBody) ?? undefined;
  }

  return sample;
}

function uint8ToBase64(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary);
}
