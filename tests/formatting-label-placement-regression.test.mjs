import fs from "node:fs";
import assert from "node:assert/strict";

const settingsTs = fs.readFileSync("src/settings.ts", "utf8");
const visualTs = fs.readFileSync("src/visual.ts", "utf8");
const capabilities = JSON.parse(fs.readFileSync("capabilities.json", "utf8"));

const publicCardsMatch = settingsTs.match(/public cards = \[([\s\S]*?)\];/);
assert(publicCardsMatch, "VisualFormattingSettingsModel deve declarar public cards.");
const publicCardsBlock = publicCardsMatch[1];

assert(publicCardsBlock.includes("this.area"), "Painel deve expor card Mapa/area.");
assert(publicCardsBlock.includes("this.outline"), "Painel deve expor card Contorno/outline.");
assert(publicCardsBlock.includes("this.svgSettings"), "Painel deve expor card Rotulos/svgSettings.");
assert(publicCardsBlock.includes("this.labels"), "Painel deve expor card Rotulos externos/labels.");
assert(publicCardsBlock.includes("this.legend"), "Painel deve expor card Legenda.");
assert(publicCardsBlock.includes("this.interaction"), "Painel deve expor card Interacao.");
assert(publicCardsBlock.includes("this.drillMaps"), "Painel deve expor card Drill Path.");
assert(publicCardsBlock.includes("this.editor"), "Painel deve expor card Editor de mapas.");

assert(!publicCardsBlock.includes("this.mapRegistry"), "mapRegistry nao deve aparecer no painel publico.");
assert(!publicCardsBlock.includes("this.labelOverrides"), "labelOverrides nao deve aparecer no painel publico.");
assert(!publicCardsBlock.includes("this.performance"), "performance nao deve aparecer no painel publico.");
assert(!publicCardsBlock.includes("this.help"), "help nao deve aparecer no painel publico.");
assert(!publicCardsBlock.includes("this.warning"), "warning nao deve aparecer no painel publico.");
assert(!publicCardsBlock.includes("this.ui"), "ui nao deve aparecer no painel publico.");

const svgCardMatch = settingsTs.match(/class SvgFormattingCard[\s\S]*?public slices = \[([\s\S]*?)\];/);
assert(svgCardMatch, "SvgFormattingCard deve declarar slices.");
const svgSlices = svgCardMatch[1];

assert(!svgSlices.includes("this.svgText"), "svgText nao deve aparecer no card publico de Rotulos.");
assert(!svgSlices.includes("this.defaultFill"), "defaultFill legado nao deve aparecer no card publico de Rotulos.");
assert(!svgSlices.includes("this.alwaysShowWarning"), "alwaysShowWarning nao deve aparecer no card publico de Rotulos.");

assert(
  /calloutAllowRight/.test(settingsTs) &&
    /calloutAllowLeft/.test(settingsTs) &&
    /calloutAllowTop/.test(settingsTs) &&
    /calloutAllowBottom/.test(settingsTs),
  "Rótulos externos devem manter toggles de direção."
);

const labelsCardMatch = settingsTs.match(/export class LabelsFormattingCard[\s\S]*?public slices = \[([\s\S]*?)\];/);
assert(labelsCardMatch, "LabelsFormattingCard deve declarar slices.");
const labelsSlices = labelsCardMatch[1];

assert(labelsSlices.includes("this.calloutAllowRight"), "Rótulos externos deve expor direção Direita.");
assert(labelsSlices.includes("this.calloutAllowLeft"), "Rótulos externos deve expor direção Esquerda.");
assert(labelsSlices.includes("this.calloutAllowTop"), "Rótulos externos deve expor direção Cima.");
assert(labelsSlices.includes("this.calloutAllowBottom"), "Rótulos externos deve expor direção Baixo.");
assert(!labelsSlices.includes("this.calloutSideMode"), "calloutSideMode deve continuar oculto no painel público.");

assert(
  /class LabelsFormattingCard[\s\S]*?public slices = \[\s*this\.labelMode,\s*this\.labelContent,\s*this\.calloutDistance,\s*this\.calloutLineColor,\s*this\.calloutTextColor,\s*this\.calloutLineWidth,\s*this\.calloutRouteStyle,\s*this\.calloutAllowRight,\s*this\.calloutAllowLeft,\s*this\.calloutAllowTop,\s*this\.calloutAllowBottom\s*\];/s.test(
    settingsTs
  ),
  "LabelsFormattingCard deve expor apenas slices publicos simplificados."
);

assert(/hasObjectProperty/.test(settingsTs), "Settings deve detectar propriedades persistidas para compatibilidade.");
assert(
  /applyLegacyCalloutSideModeToAllowedSides/.test(settingsTs),
  "Settings deve migrar calloutSideMode legado para toggles."
);

const labelsProps = capabilities?.objects?.labels?.properties || {};
assert(labelsProps.calloutAllowRight?.displayName === "Direita", "Schema deve expor calloutAllowRight como Direita.");
assert(labelsProps.calloutAllowLeft?.displayName === "Esquerda", "Schema deve expor calloutAllowLeft como Esquerda.");
assert(labelsProps.calloutAllowTop?.displayName === "Cima", "Schema deve expor calloutAllowTop como Cima.");
assert(labelsProps.calloutAllowBottom?.displayName === "Baixo", "Schema deve expor calloutAllowBottom como Baixo.");

assert(
  /public slices = \[\s*this\.enabled,\s*this\.noDataBehavior,\s*this\.focusDataAreas\s*\]/.test(settingsTs),
  "DrillMapsFormattingCard deve expor apenas enabled, noDataBehavior e focusDataAreas."
);

assert(
  /class EditorFormattingCard[\s\S]*?public slices = \[\s*this\.showEditorButton\s*\];/s.test(settingsTs),
  "EditorFormattingCard deve expor apenas showEditorButton."
);

assert(
  /applyAreaFormattingVisibility\s*\(\s*colorMode:\s*string\s*,\s*nativeFallbackFill:\s*string\s*\)/.test(settingsTs),
  "settings.ts deve expor applyAreaFormattingVisibility(colorMode, nativeFallbackFill)."
);
assert(
  /this\.unmatchedFill\.visible\s*=\s*true;/.test(settingsTs),
  "applyAreaFormattingVisibility deve manter unmatchedFill sempre visivel."
);
assert(
  /this\.matchedFill\.visible\s*=\s*mode\s*===\s*"Solid";/.test(settingsTs),
  "applyAreaFormattingVisibility deve mostrar matchedFill apenas em Solid."
);
assert(
  /this\.gradientLowFill\.visible\s*=\s*mode\s*===\s*"Gradient";/.test(settingsTs) &&
    /this\.gradientMidFill\.visible\s*=\s*mode\s*===\s*"Gradient";/.test(settingsTs) &&
    /this\.gradientHighFill\.visible\s*=\s*mode\s*===\s*"Gradient";/.test(settingsTs),
  "applyAreaFormattingVisibility deve mostrar as cores de gradiente apenas em Gradient."
);
assert(
  /public\s+colorMode:\s+string\s*=\s*"Theme";/.test(settingsTs),
  "AreaSettings deve usar Theme como modo padrão."
);
assert(
  /Tema do Power BI/.test(settingsTs) && /value:\s*"Theme"/.test(settingsTs),
  "Dropdown de cores deve expor Tema do Power BI."
);

assert(
  /this\.formattingSettingsModel\.area\.applyAreaFormattingVisibility\(\s*this\.settings\.area\.colorMode,\s*this\.settings\.area\.matchedFill\s*\);/.test(
    visualTs
  ),
  "visual.ts deve sincronizar a visibilidade do pane com o colorMode atual."
);
assert(
  /function\s+regionContainsPoint\s*\(/.test(visualTs),
  "visual.ts deve expor helper regionContainsPoint para testar pontos dentro da geometria."
);
assert(
  /function\s+regionContainsPointStrict\s*\(/.test(visualTs),
  "Polylabel deve usar um teste estrito de geometria, sem aceitar bbox como area real."
);
assert(
  /function\s+pointInPolygon\s*\(/.test(visualTs),
  "Polylabel deve ter fallback por ray casting no contorno amostrado quando necessario."
);
assert(
  /createPolylabelCell[\s\S]{0,360}regionContainsPointStrict\s*\(/.test(visualTs),
  "Polylabel deve avaliar celulas com teste estrito de geometria, nao com bbox permissivo."
);
assert(
  !/function\s+regionContainsPoint\s*\([\s\S]{0,900}getGeometryBBox\(geometry\)[\s\S]{0,260}return\s+true;/.test(
    visualTs
  ),
  "regionContainsPoint nao deve aceitar pontos apenas por estarem dentro do bbox da geometria."
);
assert(
  /function\s+labelRectFitsRegion\s*\(/.test(visualTs),
  "visual.ts deve expor helper labelRectFitsRegion para validar se o texto cabe na geometria."
);
assert(
  /function\s+findLabelPlacement\s*\(/.test(visualTs),
  "visual.ts deve expor helper findLabelPlacement para escolher ancora dentro da geometria."
);
assert(
  /\.isPointInFill\s*\(/.test(visualTs),
  "visual.ts deve usar isPointInFill() para posicionar rótulos pela geometria real."
);
assert(
  /const\s+placement\s*=\s*findLabelPlacement\s*\(/.test(visualTs),
  "upsertLabel deve usar findLabelPlacement em vez de centro puro do bbox."
);
assert(
  /function\s+findInteriorLabelAnchor\s*\(/.test(visualTs),
  "visual.ts deve expor um helper para encontrar uma ancora realmente dentro da geometria."
);
assert(
  /function\s+findPolylabelAnchor\s*\(/.test(visualTs),
  "visual.ts deve implementar Polylabel para posicionar labels no ponto interno mais distante das bordas."
);
assert(
  /const\s+POLYLABEL_ANCHOR_VERSION\s*=/.test(visualTs) && /data-sp-label-anchor-version/.test(visualTs),
  "cache de ancora deve ser versionado para nao reaproveitar centroides antigos apos ativar Polylabel."
);
assert(
  /cachedVersion\s*===\s*POLYLABEL_ANCHOR_VERSION/.test(visualTs),
  "getInteriorLabelAnchor deve aceitar cache apenas quando a versao for a versao atual do Polylabel."
);
assert(
  /matches\s*\(\s*SVG_GEOMETRY_SELECTOR\s*\)/.test(visualTs),
  "getRegionGeometryElements deve considerar o proprio elemento quando a regiao SVG ja e um path/polygon/shape."
);
assert(
  /getPointAtLength\s*\(/.test(visualTs) && /getTotalLength\s*\(/.test(visualTs),
  "Polylabel deve amostrar o contorno real do SVG para calcular distancia ate as bordas."
);
assert(
  /pointToSegmentDistanceSq\s*\(/.test(visualTs),
  "Polylabel deve medir distancia do ponto candidato ao segmento de borda mais proximo."
);
assert(
  /cell\.max\s*-\s*best\.distance\s*<=\s*precision/.test(visualTs),
  "Polylabel deve parar refinamento por precisao, como no algoritmo original."
);
assert(
  /data-sp-label-anchor-x/.test(visualTs) && /data-sp-label-anchor-y/.test(visualTs),
  "ancoras internas de label devem ser cacheadas por elemento para mapas densos."
);
assert(
  /const\s+anchor\s*=\s*findPolylabelAnchor\s*\(el\)\s*\|\|\s*findInteriorLabelAnchor\s*\(el\)/.test(visualTs),
  "cache de ancora deve preferir Polylabel e usar a heuristica antiga apenas como fallback."
);
assert(
  /const\s+interiorFallback\s*=\s*getInteriorLabelAnchor\s*\(/.test(visualTs),
  "findLabelPlacement deve usar ancora interna como fallback antes do centro bruto do bbox."
);
assert(
  /if\s*\(simplePlacement\)\s*\{[\s\S]{0,360}getInteriorLabelAnchor\s*\(/.test(visualTs),
  "o posicionamento simples usado em mapas densos tambem deve usar ancora interna da geometria."
);
assert(
  /style\.outline\s*=\s*"none"/.test(visualTs),
  "visual.ts deve remover o outline retangular padrao dos elementos selecionaveis."
);

console.log("Formatting and label placement regression checks passed.");
