import type { Sample } from '../types';

export function toHAR(samples: Sample[]) {
  return {
    log: {
      version: '1.2',
      creator: { name: 'Shaper', version: '0.1.0' },
      entries: samples.map(s => ({
        startedDateTime: s.timestamp,
        time: 0,
        request: {
          method: s.method,
          url: s.url,
          httpVersion: 'HTTP/2',
          cookies: [],
          headers: s.requestHeaders.map(h => ({ name: h.name, value: h.value })),
          queryString: (() => {
            try {
              return [...new URL(s.url).searchParams].map(([name, value]) => ({ name, value }));
            } catch { return []; }
          })(),
          postData: s.requestBody ? {
            mimeType: s.requestHeaders.find(h => h.name.toLowerCase() === 'content-type')?.value || 'application/octet-stream',
            text: s.requestBody,
          } : undefined,
          headersSize: -1,
          bodySize: s.requestBody ? s.requestBody.length : 0,
        },
        response: {
          status: s.status || 0,
          statusText: '',
          httpVersion: 'HTTP/2',
          cookies: [],
          headers: s.responseHeaders.map(h => ({ name: h.name, value: h.value })),
          content: {
            size: s.responseBody ? s.responseBody.length : 0,
            mimeType: s.responseHeaders.find(h => h.name.toLowerCase() === 'content-type')?.value || 'application/octet-stream',
            text: s.responseBody || '',
          },
          redirectURL: '',
          headersSize: -1,
          bodySize: s.responseBody ? s.responseBody.length : 0,
        },
        cache: {},
        timings: { send: 0, wait: 0, receive: 0 },
      })),
    },
  };
}
