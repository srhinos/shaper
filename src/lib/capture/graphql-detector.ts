import type { GraphQLData } from '../types';

export function detectGraphQL(method: string, url: string, body: string | null): boolean {
  if (method !== 'POST') return false;
  try {
    if (new URL(url).pathname.includes('graphql')) return true;
  } catch { /* ignore */ }
  if (!body) return false;
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.query !== 'string') return false;
    return looksLikeGraphQL(parsed.query) || 'operationName' in parsed || 'variables' in parsed;
  } catch {
    return false;
  }
}

function looksLikeGraphQL(query: string): boolean {
  const trimmed = query.trim();
  if (/^(query|mutation|subscription)\b/.test(trimmed)) return true;
  if (trimmed.includes('{') && /\w+\s*[({]/.test(trimmed)) return true;
  return false;
}

export function parseGraphQLBody(body: string): GraphQLData | null {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.query !== 'string') return null;
    if (!looksLikeGraphQL(parsed.query) && !parsed.operationName && !parsed.variables) return null;

    const opType = extractOperationType(parsed.query);
    return {
      operationName: parsed.operationName || extractOperationName(parsed.query),
      operationType: opType,
      query: parsed.query,
      variables: parsed.variables ?? null,
    };
  } catch {
    return null;
  }
}

function extractOperationType(query: string): 'query' | 'mutation' | 'subscription' | null {
  const match = query.trim().match(/^(query|mutation|subscription)\b/);
  return match ? match[1] as 'query' | 'mutation' | 'subscription' : null;
}

function extractOperationName(query: string): string | null {
  const match = query.trim().match(/^(?:query|mutation|subscription)\s+(\w+)/);
  return match ? match[1] : null;
}

export function isIntrospectionResponse(responseBody: string): boolean {
  try {
    const parsed = JSON.parse(responseBody);
    const data = parsed?.data;
    if (!data || typeof data !== 'object') return false;
    return '__schema' in data || '__type' in data;
  } catch {
    return false;
  }
}
