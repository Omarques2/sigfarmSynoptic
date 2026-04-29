import fs from "node:fs";
import assert from "node:assert/strict";

const capabilities = JSON.parse(fs.readFileSync("capabilities.json", "utf8"));
const areaProps = capabilities?.objects?.area?.properties ?? {};

assert(areaProps.colorMode, "capabilities.json deve expor area.colorMode.");
assert(areaProps.gradientLowFill, "capabilities.json deve expor area.gradientLowFill.");
assert(areaProps.gradientMidFill, "capabilities.json deve expor area.gradientMidFill.");
assert(areaProps.gradientHighFill, "capabilities.json deve expor area.gradientHighFill.");

assert.deepEqual(
  areaProps.colorMode?.type?.enumeration?.map((entry) => entry?.value),
  ["Theme", "Solid", "Gradient"],
  "area.colorMode deve expor Theme, Solid e Gradient."
);

const settingsTs = fs.readFileSync("src/settings.ts", "utf8");
assert(
  /public\s+colorMode:\s+string\s*=\s*"Theme";/.test(settingsTs),
  "AreaSettings deve definir colorMode com default Theme."
);
assert(
  /public\s+gradientLowFill:\s+string\s*=\s*"#FFF4B8";/.test(settingsTs),
  "AreaSettings deve definir gradientLowFill."
);
assert(
  /public\s+gradientMidFill:\s+string\s*=\s*"#B9DCFF";/.test(settingsTs),
  "AreaSettings deve definir gradientMidFill."
);
assert(
  /public\s+gradientHighFill:\s+string\s*=\s*"#1F5AA6";/.test(settingsTs),
  "AreaSettings deve definir gradientHighFill."
);
assert(
  /s\.area\.colorMode\s*=\s*normalizeAreaColorMode\(getString\(objects,\s*\["area",\s*"colorMode"\],\s*s\.area\.colorMode\)\);/.test(
    settingsTs
  ),
  "VisualSettings.parse deve ler area.colorMode."
);
assert(
  /s\.area\.gradientLowFill\s*=\s*getFill\(objects,\s*"area",\s*"gradientLowFill",\s*s\.area\.gradientLowFill\);/.test(settingsTs),
  "VisualSettings.parse deve ler area.gradientLowFill."
);
assert(
  /s\.area\.gradientMidFill\s*=\s*getFill\(objects,\s*"area",\s*"gradientMidFill",\s*s\.area\.gradientMidFill\);/.test(settingsTs),
  "VisualSettings.parse deve ler area.gradientMidFill."
);
assert(
  /s\.area\.gradientHighFill\s*=\s*getFill\(objects,\s*"area",\s*"gradientHighFill",\s*s\.area\.gradientHighFill\);/.test(settingsTs),
  "VisualSettings.parse deve ler area.gradientHighFill."
);
assert(
  /public\s+colorMode\s*=\s*new formattingSettings\.ItemDropdown\(/.test(settingsTs),
  "AreaFormattingCard deve expor o dropdown colorMode."
);
assert(
  /public\s+gradientLowFill\s*=\s*new formattingSettings\.ColorPicker\(/.test(settingsTs),
  "AreaFormattingCard deve expor gradientLowFill."
);
assert(
  /public\s+gradientMidFill\s*=\s*new formattingSettings\.ColorPicker\(/.test(settingsTs),
  "AreaFormattingCard deve expor gradientMidFill."
);
assert(
  /public\s+gradientHighFill\s*=\s*new formattingSettings\.ColorPicker\(/.test(settingsTs),
  "AreaFormattingCard deve expor gradientHighFill."
);

const visualTs = fs.readFileSync("src/visual.ts", "utf8");
assert(/colorMode/.test(visualTs), "visual.ts deve considerar colorMode.");
assert(
  /this\.settings\.area\.colorMode\s*===\s*"Gradient"/.test(visualTs),
  "visual.ts deve ter branch explicito para o modo Gradient."
);
assert(
  /this\.settings\.area\.colorMode\s*===\s*"Theme"/.test(visualTs),
  "visual.ts deve ter branch explicito para o modo Theme."
);
assert(
  /Number\.isFinite\(/.test(visualTs),
  "visual.ts deve usar Number.isFinite para estatisticas do gradiente."
);
assert(
  /min\s*===\s*max[\s\S]{0,220}gradientMidFill/.test(visualTs),
  "visual.ts deve usar gradientMidFill quando min === max."
);
assert(
  /matchedFill[\s\S]{0,220}!Number\.isFinite/.test(visualTs) ||
    /!Number\.isFinite[\s\S]{0,220}matchedFill/.test(visualTs),
  "visual.ts deve cair para matchedFill quando o valor nao for numerico no modo Gradient."
);
assert(
  /this\.settings\.area\.colorMode\s*===\s*"Gradient"[\s\S]{0,260}this\.legendHost\.style\.display\s*=\s*"none"/.test(visualTs) ||
    /this\.legendHost\.style\.display\s*=\s*"none"[\s\S]{0,260}this\.settings\.area\.colorMode\s*===\s*"Gradient"/.test(visualTs),
  "visual.ts deve esconder a legenda categórica quando colorMode = Gradient."
);
assert(
  /getBBox\(\)/.test(visualTs),
  "visual.ts deve usar getBBox() para calcular o fit real do SVG."
);
assert(
  /this\.svgHost\.clientWidth/.test(visualTs) && /this\.svgHost\.clientHeight/.test(visualTs),
  "visual.ts deve usar svgHost.clientWidth/clientHeight no fit."
);
assert(
  !/private computeFitTransform\(\)\s*\{\s*this\.fitTransform = \{ scale: 1, tx: 0, ty: 0 \};\s*\}/.test(visualTs),
  "computeFitTransform nao pode permanecer como identidade fixa."
);
assert(
  /this\.render\(svgText,\s*dv\);[\s\S]{0,260}this\.updateLegend\(dv,\s*hasSvg\);[\s\S]{0,360}this\.computeFitTransform\(\);[\s\S]{0,180}this\.scheduleFitToHost\(\);/.test(
    visualTs
  ),
  "update() deve recalcular fit apos updateLegend e delegar reset/foco para scheduleFitToHost."
);

console.log("Gradient and fit regression checks passed.");
