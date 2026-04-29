import fs from "node:fs";
import assert from "node:assert/strict";

const visualTs = fs.readFileSync("src/visual.ts", "utf8");

assert(
  /row\.fillColor \|\| this\.settings\.area\.matchedFill/.test(visualTs),
  "Legenda deve usar row.fillColor como swatch."
);

assert(
  /legendRawKey = legendRaw\.trim\(\) \|\| rawKey/.test(visualTs),
  "buildDataMap deve preencher legendRawKey com fallback para rawKey."
);

assert(
  /const colorKey = legendRawKey \|\| rawKey/.test(visualTs),
  "colorKey deve usar legenda ou regiao, sem colorBy."
);

assert(
  /const\s+swatchColor\s*=/.test(visualTs),
  "visual.ts deve centralizar a cor da legenda em swatchColor."
);

assert(
  /background:\s*swatchColor/.test(visualTs),
  "visual.ts deve manter o preenchimento da swatch em tela."
);

assert(
  /border:\s*`1px solid \$\{swatchColor\}`/.test(visualTs),
  "visual.ts deve aplicar borda colorida na swatch para fallback de impressao."
);

assert(
  /setProperty\(\s*"-webkit-print-color-adjust"\s*,\s*"exact"\s*\)/.test(visualTs),
  "visual.ts deve forcar ajuste de cor de impressao na swatch (-webkit-print-color-adjust)."
);

assert(
  /setProperty\(\s*"print-color-adjust"\s*,\s*"exact"\s*\)/.test(visualTs),
  "visual.ts deve forcar ajuste de cor de impressao na swatch (print-color-adjust)."
);

console.log("Legend print regression checks passed.");
