# SVG Synoptic Map (Power BI Custom Visual)

Power BI custom visual for SVG synoptic maps with:
- Power BI theme palette, solid fill, or gradient fill by value
- Legend grouping
- Internal labels and external callout labels
- Selection, cross-filter, zoom, and pan
- Drill-aware map registry
- Advanced map editor for supported authoring contexts
- Certified-safe SVG sanitization

## Data roles

Configure `Adicionar dados ao seu visual` with:
- `Região (ID do SVG)`: required
- `Legenda`: optional, used by legend and preferred theme color key
- `Valor`: optional, used for gradient, labels, and numeric tooltip content
- `Tooltips`: optional extra tooltip fields

There is no separate color bucket.

## Color modes

- `Theme`: uses Power BI theme palette. If `Legenda` exists, it is preferred as color key; otherwise the visual uses region key.
- `Solid`: uses configured area color and supports native Power BI `fx` conditional formatting.
- `Gradient`: uses `Valor` to interpolate low-mid-high colors.

## Security and certification constraints

- No `WebAccess`
- No `externalJS`
- No remote maps or remote images
- Scripts, event handlers, unsafe tags, and unsafe URL refs are removed from SVG
- `LocalStorage` is used only through Power BI host `storageService` for local UI state

Embedded image policy:
- Prefer no images inside SVG
- If image is truly needed, use embedded `data:image/png`
- External image URLs are blocked
- `data:image/svg+xml` is blocked

## Build and verification

```powershell
npm ci
npm run verify
```

Key commands:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm audit --audit-level=moderate`
- `npm run package:audit`
- `npm run package`

Generated package:
- `dist/*.pbiviz`

## Sample file

Sample report must:
- use same production package version as submitted `.pbiviz`
- work offline
- include final `Hints & Tips` page inside PBIX

Source content for that page lives in:
- [`docs/sample-hints-and-tips.md`](./docs/sample-hints-and-tips.md)

Security-focused SVG samples live in:
- [`samples/certificacao`](./samples/certificacao)

## Help and tutorial

Visual includes local `i` tutorial overlay as complementary guidance.

Important:
- tutorial does not replace `Hints & Tips` page inside sample PBIX
- tutorial uses local content only
- no remote assets are required for onboarding

## Compatibility

Backward-compatibility notes for update from certified package:
- [`docs/compatibility-matrix.md`](./docs/compatibility-matrix.md)

## Support

- [`SUPPORT.md`](./SUPPORT.md)

## Security

- [`SECURITY.md`](./SECURITY.md)
