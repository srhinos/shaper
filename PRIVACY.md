# Privacy Policy — Shaper

**Last updated:** March 2026

## What data is collected

Shaper records HTTP request and response data from browser tabs you explicitly choose to monitor. This includes:

- Request URLs, methods, and headers
- Request bodies
- Response status codes, headers, and bodies
- Cookies present in request headers

## Where data is stored

All captured data is stored **locally** in your browser using `browser.storage.local`. No data is transmitted to any external server, analytics service, or third party. The extension makes no network requests of its own.

## How data is used

Data is stored solely for your use in inspecting, exporting, and analyzing API traffic. You control when capture starts and stops, which tabs are monitored, and which domains are included.

## Data retention

Captured data persists in browser storage until you manually clear it via the popup or dashboard. Uninstalling the extension removes all stored data.

## Request modification

To capture response bodies, the extension modifies outgoing request headers on monitored XHR requests:

- `Accept-Encoding` is set to `identity` to receive uncompressed responses
- `Cache-Control: no-cache` is added, and conditional cache headers (`If-None-Match`, `If-Modified-Since`) are removed to ensure responses pass through the network

These modifications apply **only** to XHR requests from tabs you have explicitly selected for capture.

## Permissions explained

- **`webRequest` / `webRequestBlocking`**: Required to intercept and inspect HTTP traffic, and to modify headers for response body capture.
- **`tabs`**: Required to identify and track which tabs are being monitored.
- **`storage` / `unlimitedStorage`**: Required to persist captured data locally.
- **`<all_urls>`**: Required to capture requests to any domain. Domain filtering is available to restrict capture to specific sites.

## Contact

If you have questions about this privacy policy, open an issue at: https://github.com/srhinos/shaper
