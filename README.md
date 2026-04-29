# Sigfarm Geosynoptic (Power BI Custom Visual)

Custom visual for Power BI that renders SVG synoptic panels with:
- Conditional coloring by category
- Power BI theme palette, solid fill or gradient fill by measure
- Value labels
- Selection and cross-filter interaction
- Zoom and pan
- Legend grouping
- Auto-fit based on the real SVG content bounds
- Sanitization of SVG input
- Auto-focus on selected areas
- External callout labels
- Advanced edit mode for map bindings, aliases, metadata and manifest JSON
- Drill-aware map registry

## Color Modes

The visual supports three area color modes in the format pane:
- `Theme`: uses the current Power BI theme palette by category/area. This is the default so the visual follows the report theme and other visuals.
- `Solid`: applies "Cor das areas" to matched areas. This picker exposes the native Power BI `fx` button, so rules, gradients and field-value/DAX conditional colors can resolve per area.
- `Gradient`: uses the current measure to interpolate a three-color continuous scale from low to mid to high.

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

## Interaction and Labels

The interaction card can automatically focus the selected area by fitting the selected SVG geometry to the visual viewport. External cross-filter focus is disabled by default to avoid unexpected map jumps when another visual filters this one.

When an area is selected, other labels stay visible with reduced opacity instead of disappearing. Label mode can be changed from internal labels to external callouts with leader lines. Callouts can show value, category, or category plus value, and still respect high contrast mode.

## SVG Fit and Centering

The visual now computes fit and centering from the real `getBBox()` bounds of the rendered SVG content instead of relying only on the root `viewBox`. This keeps offset drawings centered more accurately, including when the visual is shown alone in focus mode or fullscreen inside Power BI.

## Advanced Editor and Map Registry

The visual supports Power BI Advanced Edit Mode in focus mode. The editor is binding-first: it is intended for SVG IDs, virtual IDs, binding overrides, aliases, per-area metadata, drill map associations and label overrides. It does not edit SVG geometry in this version.

The map registry is a versioned JSON manifest persisted in the report. Multiple maps can be associated with drill levels or drill paths. Import uses a local JSON file or pasted text; export is done by selecting/copying the JSON. No remote maps, web access or external resources are used.

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
