# Certification Notes - SVG Synoptic Map 1.0.0.12

Use the text below in Partner Center `Notes for certification`.

---

This submission is an update for the existing certified Power BI visual.

Visual identity:
- Name: `SVG Synoptic Map`
- Internal name: `geosynoptic`
- GUID: `SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01`
- Version: `1.0.0.12`

Source code repository:
- Public repository: `https://github.com/Omarques2/sigfarmSynoptic`
- Certification branch: `https://github.com/Omarques2/sigfarmSynoptic/tree/certification`

Source code access:
- No credentials are required. The repository is public.

Sample report:
- Sample file name: `SVGSynopticMapSample.pbix`
- The sample PBIX is fully offline and does not require external services, remote files, or machine-specific paths.
- The sample includes a final `Hints & Tips` page as requested for certification guidance.

Test credentials / license keys / purchases:
- No test account is required.
- No service purchase is required.
- No in-app purchases exist.
- No license key or token is required.

Security and runtime notes:
- The visual does not use `WebAccess`.
- The visual does not use `externalJS`.
- The visual does not call external services to render.
- The visual does not collect telemetry.
- `LocalStorage` is used only through Power BI host `storageService` for local UI state.
- SVG content is sanitized. Scripts, unsafe handlers, unsafe tags, external resources, and `data:image/svg+xml` are blocked.

Suggested validation flow:
1. Import/open the submitted `.pbiviz` package version `1.0.0.12`.
2. Open `SVGSynopticMapSample.pbix`.
3. Validate the main sample page and the final `Hints & Tips` page.
4. Validate drill behavior:
   - when a drill target map exists, the visual drills to that map;
   - when no further drill target exists, the visual keeps the current map and only focuses/zooms on the clicked region.
5. Validate context menu on both:
   - a data region;
   - empty space.
6. Validate keyboard focus and navigation.
7. Validate export scenarios used by certification, including PDF/PowerPoint if applicable in your checklist.

Build verification used before submission:
- `npm ci`
- `npm run verify`

If Microsoft needs any additional clarification during certification, please contact:
- `contato@sigfarmintelligence.com`
- `otavio.marques@sigfarmintelligence.com`

---

Shorter version, if the field needs a compact note:

Public source repository:
`https://github.com/Omarques2/sigfarmSynoptic`

Certification branch:
`https://github.com/Omarques2/sigfarmSynoptic/tree/certification`

This is an update for the certified visual GUID `SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01`, version `1.0.0.12`.

Sample file:
`SVGSynopticMapSample.pbix`

The sample works fully offline, includes a final `Hints & Tips` page, and does not require credentials, license keys, purchases, or external services. The repository is public and requires no credentials. The visual does not use WebAccess or externalJS, does not collect telemetry, and sanitizes SVG content before rendering.
