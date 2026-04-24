# Sigfarm Geosynoptic (Power BI Custom Visual)

Custom visual for Power BI that renders SVG synoptic panels with:
- Conditional coloring by category
- Optional solid fill or gradient fill by measure
- Value labels
- Selection and cross-filter interaction
- Zoom and pan
- Legend grouping
- Auto-fit based on the real SVG content bounds
- Sanitization of SVG input

## Color Modes

The visual supports four area color modes in the format pane:
- `ThemeOrMatched`: preserves the existing behavior, using theme colors when available and `matchedFill` as fallback.
- `Solid`: forces the configured `matchedFill` for every matched area.
- `Gradient`: uses the current measure to interpolate a three-color continuous scale from low to mid to high.
- `ConditionalFormattingNative`: exposes one native `fx` color entry per matched area so Power BI can apply rules, gradients, or field-value/DAX colors per area.

Gradient defaults:
- Low: `#FFF4B8`
- Mid: `#B9DCFF`
- High: `#1F5AA6`

Gradient behavior:
- Unmatched areas still use `unmatchedFill`.
- Matched areas with missing or non-numeric values fall back to `matchedFill`.
- When all numeric values are equal, matched areas use the mid gradient color.
- The categorical legend is hidden while gradient mode is active to avoid a misleading discrete legend.

Native conditional formatting behavior:
- Unmatched areas still use `unmatchedFill`.
- Matched areas first use the color resolved by Power BI for that area.
- If Power BI doesn't resolve a color for a matched area, the visual falls back to `matchedFill`.
- The categorical legend is hidden while native conditional formatting is active, because colors can vary per area and filter context.

## SVG Fit and Centering

The visual now computes fit and centering from the real `getBBox()` bounds of the rendered SVG content instead of relying only on the root `viewBox`. This keeps offset drawings centered more accurately, including when the visual is shown alone in focus mode or fullscreen inside Power BI.

## Repository Scope

This repository contains the source code for the `Sigfarm Geosynoptic` custom visual package (`.pbiviz`).

## Build

```powershell
npm install
npm run package
```

Generated package output:
- `dist/*.pbiviz`

## Support

Support details are available at:
- [`SUPPORT.md`](./SUPPORT.md)

## Security

Security policy and reporting instructions are available at:
- [`SECURITY.md`](./SECURITY.md)
