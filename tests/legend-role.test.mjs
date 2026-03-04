import fs from "node:fs";
import assert from "node:assert/strict";

const capabilities = JSON.parse(fs.readFileSync("capabilities.json", "utf8"));
const roles = Array.isArray(capabilities.dataRoles) ? capabilities.dataRoles.map((r) => r?.name) : [];
assert(roles.includes("legend"), "capabilities.json deve expor o dataRole 'legend'.");

const categorySelect = capabilities?.dataViewMappings?.[0]?.categorical?.categories?.select ?? [];
assert(
  categorySelect.some((entry) => entry?.for?.in === "legend"),
  "capabilities.json deve mapear o dataRole 'legend' em categorical.categories.select."
);

const visualTs = fs.readFileSync("src/visual.ts", "utf8");
assert(/roles\?\.legend/.test(visualTs), "visual.ts deve buscar a coluna com role 'legend'.");
assert(/legendRawKey/.test(visualTs), "visual.ts deve manter o texto da legenda por linha (legendRawKey).");
assert(
  /label\.textContent\s*=\s*row\.legendRawKey/.test(visualTs),
  "visual.ts deve usar legendRawKey para o texto exibido na legenda."
);
assert(
  /const\s+uniqueLegendRows\s*=\s*new\s+Map<\s*string\s*,\s*CatRow\s*>\(\)/.test(visualTs),
  "visual.ts deve criar agrupamento de itens únicos de legenda."
);
assert(
  /if\s*\(\s*!uniqueLegendRows\.has\(legendKey\)\s*\)\s*\{\s*uniqueLegendRows\.set\(legendKey,\s*row\)/s.test(visualTs),
  "visual.ts deve deduplicar itens por texto da legenda."
);
assert(
  /for\s*\(\s*const\s+row\s+of\s+uniqueLegendRows\.values\(\)\s*\)/.test(visualTs),
  "visual.ts deve renderizar legenda usando apenas itens únicos."
);

console.log("Legend role regression checks passed.");
