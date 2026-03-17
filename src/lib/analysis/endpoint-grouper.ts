import type { Protocol } from '../types';

interface EndpointMatcher {
  pattern: string;
  urlPattern: string;
  method: string;
  domain: string;
  protocol: Protocol;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_RE = /\/\d+(?=\/|$)/g;
const BASE64_RE = /\/[A-Za-z0-9_-]{20,}(?=\/|$)/g;

export function normalizeUrl(pathAndQuery: string): string {
  const pathname = pathAndQuery.split('?')[0];
  return pathname
    .replace(UUID_RE, ':uuid')
    .replace(NUMERIC_RE, '/:id')
    .replace(BASE64_RE, '/:token');
}

export function createEndpointPattern(method: string, fullUrl: string): string {
  const url = new URL(fullUrl);
  return `${method} ${normalizeUrl(url.pathname + url.search)}`;
}

export function matchEndpoint(
  endpoints: EndpointMatcher[],
  method: string,
  fullUrl: string,
  protocol: Protocol,
): EndpointMatcher | null {
  const url = new URL(fullUrl);
  const domain = url.hostname;
  const normalized = normalizeUrl(url.pathname + url.search);

  for (const ep of endpoints) {
    if (ep.method === method && ep.domain === domain && ep.urlPattern === normalized && ep.protocol === protocol) {
      return ep;
    }
  }
  return null;
}

export function createGraphQLPattern(operationName: string | null, query: string): string {
  if (operationName) return `POST /graphql/${operationName}`;
  const normalized = query.replace(/#[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  const hash = simpleHash(normalized);
  return `POST /graphql/_unnamed_${hash}`;
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
