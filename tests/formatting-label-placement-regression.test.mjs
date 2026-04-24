import fs from "node:fs";
import assert from "node:assert/strict";

const settingsTs = fs.readFileSync("src/settings.ts", "utf8");

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

const visualTs = fs.readFileSync("src/visual.ts", "utf8");

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
  /style\.outline\s*=\s*"none"/.test(visualTs),
  "visual.ts deve remover o outline retangular padrao dos elementos selecionaveis."
);

console.log("Formatting and label placement regression checks passed.");
