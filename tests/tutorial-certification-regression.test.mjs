import assert from "node:assert/strict";
import fs from "node:fs";

const visualTs = fs.readFileSync("src/visual.ts", "utf8");
const visualLess = fs.readFileSync("style/visual.less", "utf8");
const settingsTs = fs.readFileSync("src/settings.ts", "utf8");

assert(/createHelpOverlay/.test(visualTs), "visual.ts deve manter overlay de tutorial/ajuda.");
assert(/helpEl/.test(visualTs), "visual.ts deve manter host de tutorial/ajuda.");
assert(/getHelpPages/.test(visualTs), "visual.ts deve manter paginas de tutorial.");
assert(/showEditorButton/.test(settingsTs), "settings.ts deve manter botao Editor.");
assert(/sp-help/.test(visualLess), "style deve manter estilos do overlay de ajuda.");

console.log("Tutorial certification regression checks passed.");
