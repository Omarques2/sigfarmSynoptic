# Sample PBIX - Hints & Tips Page Content

Use this file as source content for final `Hints & Tips` page inside sample PBIX.

## Title

`Hints & Tips`

## Sections

### 1. Prepare SVG correctly
- Each interactive area needs unique, stable `id`
- IDs in data must match SVG IDs exactly
- Avoid duplicate IDs
- Prefer clean SVG exported without scripts or external resources

### 2. Buckets
- `Região (ID do SVG)`: required key used to map data to areas
- `Legenda`: optional grouping and theme color key
- `Valor`: optional numeric value for color, labels, tooltip
- `Tooltips`: optional extra tooltip fields

### 3. Color modes
- `Tema do Power BI`: uses legend when present, otherwise region key
- `Cor simples`: uses configured area color / conditional formatting
- `Gradiente por valor`: uses measure value for low-mid-high scale

### 4. Labels and callouts
- Internal labels work better on larger areas
- External callouts help in dense maps
- Keep label text concise for crowded SVGs

### 5. Editor and Drill Path
- Editor available only in supported authoring context
- Drill Path maps must be explicitly configured
- Areas without target drill map should not drill down

### 6. Security and certification limits
- No scripts in SVG
- No external URLs or images
- No `data:image/svg+xml`
- Prefer embedded PNG only when image is truly required

### 7. Performance
- Large SVGs should avoid unnecessary nodes/groups
- Hide decorative layers that do not need data binding
- Prefer fewer labels in dense maps

### 8. Extra help
- Visual includes `i` tutorial button as complementary help
- Tutorial does not replace this sample page
