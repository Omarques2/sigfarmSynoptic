import fs from "node:fs";
import assert from "node:assert/strict";

const capabilities = JSON.parse(fs.readFileSync("capabilities.json", "utf8"));
const roles = Array.isArray(capabilities.dataRoles) ? capabilities.dataRoles.map((r) => r?.name) : [];
assert(roles.includes("category"), "capabilities.json deve expor o dataRole 'category'.");
assert(roles.includes("legend"), "capabilities.json deve expor o dataRole 'legend'.");
assert(roles.includes("measure"), "capabilities.json deve expor o dataRole 'measure'.");
assert(roles.includes("tooltips"), "capabilities.json deve expor o dataRole 'tooltips'.");
assert(!roles.includes("colorBy"), "capabilities.json nao deve mais expor o dataRole 'colorBy'.");

const categorySelect = capabilities?.dataViewMappings?.[0]?.categorical?.categories?.select ?? [];
assert(
  categorySelect.some((entry) => entry?.for?.in === "category"),
  "capabilities.json deve mapear o dataRole 'category' em categorical.categories.select."
);
assert(
  categorySelect.some((entry) => entry?.for?.in === "legend"),
  "capabilities.json deve mapear o dataRole 'legend' em categorical.categories.select."
);
assert(
  !categorySelect.some((entry) => entry?.for?.in === "colorBy"),
  "capabilities.json nao deve mapear o dataRole 'colorBy' em categorical.categories.select."
);

const visualTs = fs.readFileSync("src/visual.ts", "utf8");
assert(/roles\?\.legend/.test(visualTs), "visual.ts deve buscar a coluna com role 'legend'.");
assert(/legendRawKey/.test(visualTs), "visual.ts deve manter o texto da legenda por linha (legendRawKey).");
assert(/private getLegendLabelForRow/.test(visualTs), "Legenda deve ter helper de label com fallback.");
assert(/private getLegendGroupKeyForRow/.test(visualTs), "Legenda deve ter helper de agrupamento com fallback.");
assert(
  !/this\.settings\.area\.colorMode === "Gradient"[\s\S]{0,600}this\.legendHost\.style\.display = "none"/.test(visualTs),
  "Legenda nao deve ser escondida automaticamente no modo Gradient."
);
assert(
  /const legendLabel = this\.getLegendLabelForRow\(row\)/.test(visualTs) &&
    /label\.textContent\s*=\s*legendLabel/.test(visualTs),
  "visual.ts deve usar helper de fallback para o texto exibido na legenda."
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
