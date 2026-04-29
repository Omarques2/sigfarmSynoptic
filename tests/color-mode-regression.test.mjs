import fs from "node:fs";
import assert from "node:assert/strict";

const capabilities = JSON.parse(fs.readFileSync("capabilities.json", "utf8"));
const settingsTs = fs.readFileSync("src/settings.ts", "utf8");
const visualTs = fs.readFileSync("src/visual.ts", "utf8");

const areaEnum =
  capabilities?.objects?.area?.properties?.colorMode?.type?.enumeration?.map((item) => item.value) || [];

assert.deepEqual(
  areaEnum,
  ["Theme", "Solid", "Gradient"],
  "area.colorMode deve expor Theme, Solid e Gradient, nessa ordem."
);

assert(
  capabilities?.objects?.nativeAreaColors?.properties?.fill?.type?.fill?.solid?.color === true,
  "capabilities.json deve manter nativeAreaColors.fill para o fx nativo."
);

assert(
  /class\s+ObjectBoundColorPicker/.test(settingsTs) &&
    /public\s+matchedFill\s*=\s*new ObjectBoundColorPicker/.test(settingsTs) &&
    /objectNameOverride:\s*"nativeAreaColors"/.test(settingsTs) &&
    /displayName:\s*"Cor das areas"/.test(settingsTs) &&
    /instanceKind:\s*powerbi\.VisualEnumerationInstanceKinds\.ConstantOrRule/.test(settingsTs),
  "settings.ts deve ligar Cor das areas ao objeto nativeAreaColors com fx."
);

assert(
  /public\s+colorMode\s*=\s*new formattingSettings\.ItemDropdown\(/.test(settingsTs) &&
    /Tema do Power BI/.test(settingsTs) &&
    /Cor simples/.test(settingsTs) &&
    /Gradiente/.test(settingsTs) &&
    !/ConditionalFormattingNative/.test(settingsTs),
  "settings.ts deve listar Tema do Power BI, Cor simples e Gradiente no dropdown."
);

assert(
  /displayName:\s*"Valor baixo"/.test(settingsTs) &&
    /displayName:\s*"Valor medio"/.test(settingsTs) &&
    /displayName:\s*"Valor alto"/.test(settingsTs),
  "as opções de gradiente não devem mais ter o prefixo 'Gradiente:'."
);

assert(
  /this\.matchedFill\.visible\s*=\s*mode\s*===\s*"Solid";/.test(settingsTs),
  "Cor das areas deve aparecer apenas no modo Solid."
);

assert(
  /categories?\[0\]\.objects|regionCol\.objects/.test(visualTs),
  "visual.ts deve continuar lendo os objetos por instância da categoria."
);

assert(
  /altConstantValueSelector:\s*null as any/.test(visualTs),
  "enumerateObjectInstances deve expor um único fx estático com fallback constante."
);

assert(
  !/ConditionalFormattingNative/.test(visualTs),
  "visual.ts não deve mais depender do modo ConditionalFormattingNative."
);

assert(
  /public\s+colorMode:\s+string\s*=\s*"Theme";/.test(settingsTs) &&
    /ThemeOrMatched/.test(settingsTs) &&
    /return\s+"Theme";/.test(settingsTs),
  "settings.ts deve usar Theme como default e fallback compatível."
);

assert(
  /getPowerBIThemeColor/.test(visualTs) &&
    /colorPalette\.getColor/.test(visualTs) &&
    /this\.settings\.area\.colorMode\s*===\s*"Theme"/.test(visualTs),
  "visual.ts deve resolver cores pelo tema do Power BI quando colorMode = Theme."
);

assert(
  /if\s*\(mode\s*===\s*"Gradient"\)/.test(visualTs),
  "visual.ts deve manter branch explícito para Gradient."
);

assert(
  /return\s+row\.nativeFill\s*\|\|\s*nativeFallbackFill\s*\|\|\s*matchedFill;/.test(visualTs),
  "modo Solid deve usar cor resolvida por área, depois fallback estático e por fim matchedFill."
);

console.log("Color mode regression checks passed.");
