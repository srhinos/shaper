import type { HeaderEntry, HeaderFilterConfig, HeaderPreset } from './types';

export const PRESETS: HeaderPreset[] = [
  {
    id: 'browser',
    name: 'Browser Headers',
    description: 'Auto-generated browser headers',
    headers: ['user-agent', 'accept-language', 'accept-encoding', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 'sec-fetch-user', 'dnt', 'upgrade-insecure-requests', 'connection', 'host'],
  },
  {
    id: 'security',
    name: 'Security Headers',
    description: 'Security policy response headers',
    headers: ['strict-transport-security', 'content-security-policy', 'content-security-policy-report-only', 'x-frame-options', 'x-content-type-options', 'x-xss-protection', 'permissions-policy', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy'],
  },
  {
    id: 'cdn',
    name: 'CDN/Proxy Headers',
    description: 'CDN and proxy infrastructure headers',
    headers: ['cf-ray', 'cf-cache-status', 'x-cache', 'x-served-by', 'x-timer', 'via', 'x-cdn', 'server-timing', 'alt-svc', 'server', 'x-powered-by'],
  },
  {
    id: 'cookies',
    name: 'Cookie Headers',
    description: 'Cookie request and response headers',
    headers: ['cookie', 'set-cookie'],
  },
];

export function filterHeaders(headers: HeaderEntry[], config: HeaderFilterConfig): HeaderEntry[] {
  const includeSet = new Set(config.customIncludes.map(h => h.toLowerCase()));
  const excludeSet = new Set(config.customExcludes.map(h => h.toLowerCase()));

  for (const presetId of config.enabledPresets) {
    const preset = PRESETS.find(p => p.id === presetId);
    if (preset) {
      for (const h of preset.headers) excludeSet.add(h);
    }
  }

  for (const h of includeSet) excludeSet.delete(h);

  return headers.filter(h => !excludeSet.has(h.name.toLowerCase()));
}
