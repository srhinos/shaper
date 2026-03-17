# Shaper

A Firefox extension that captures API traffic as you browse, infers schemas from what it sees, and exports structured documentation. Supports HTTP, GraphQL, gRPC-Web/Protobuf, and SSE.
<p align="center">
<img width="800" height="605" alt="zen_xPcBpnCzqP" src="https://github.com/user-attachments/assets/5a4b2e84-b870-473e-95df-6924f2fa5f13" />
</p>

## Install

```bash
npm install
npm run build
```

Load `dist/` as a temporary add-on in `about:debugging`.

## Usage

1. Click the Shaper icon, hit **All Tabs** or **+ This Tab**
2. Browse — the badge pulses green and counts endpoints as they're captured
3. Click **Open Dashboard** to see everything Shaper has learned
4. Export as OpenAPI, HAR, `.proto`, or JSON from the dashboard

**Alt+Shift+C** toggles capture on the active tab.

## What it does

- Groups raw requests into endpoint patterns automatically
- Infers request/response JSON schemas, refined with every new sample
- Decodes protobuf wire format without a schema, infers `.proto` definitions
- Tracks query parameter values and marks which are optional vs required
- Generates curl commands, copyable headers, and structured exports

## Development

```bash
npm run watch   # rebuild on changes
npm test        # 91 vitest tests
```

Firefox Manifest V2 — required for `filterResponseData`, which has no MV3 equivalent.

## License

GPL-3.0
