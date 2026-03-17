import type { Sample, HeaderFilterConfig } from '../types';
import { filterHeaders } from '../headers';

export function exportRaw(samples: Sample[]): Sample[] {
  return samples;
}

export function exportFiltered(samples: Sample[], config: HeaderFilterConfig) {
  return samples.map(s => ({
    ...s,
    requestHeaders: filterHeaders(s.requestHeaders, config),
    responseHeaders: filterHeaders(s.responseHeaders, config),
    responseBody: truncateBody(s.responseBody),
  }));
}

function truncateBody(body: string | null, max = 2000): string | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    const compact = JSON.stringify(parsed);
    if (compact.length <= max) return body;
    if (Array.isArray(parsed)) {
      return JSON.stringify({ _truncated: true, _totalItems: parsed.length, _sample: parsed.slice(0, 3) });
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const shape: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v)) shape[k] = `[Array(${(v as unknown[]).length})]`;
        else if (typeof v === 'object' && v !== null) shape[k] = `{${Object.keys(v).join(', ')}}`;
        else shape[k] = v;
      }
      return JSON.stringify({ _truncated: true, _shape: shape });
    }
  } catch { /* not JSON */ }
  return body.length <= max ? body : body.slice(0, max) + '...';
}
