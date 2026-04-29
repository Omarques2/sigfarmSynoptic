import assert from "node:assert/strict";
import fs from "node:fs";

const visualTs = fs.readFileSync("src/visual.ts", "utf8");

assert(/"clippath"/.test(visualTs), "Sanitizer deve permitir clippath em lowercase.");
assert(/"lineargradient"/.test(visualTs), "Sanitizer deve permitir lineargradient em lowercase.");
assert(/"radialgradient"/.test(visualTs), "Sanitizer deve permitir radialgradient em lowercase.");
assert(/data:image\/png/.test(visualTs), "Sanitizer deve explicitar suporte a data:image/png.");
assert(!/"clipPath"/.test(visualTs), "Allowlist nao deve depender de clipPath camelCase.");
assert(!/"linearGradient"/.test(visualTs), "Allowlist nao deve depender de linearGradient camelCase.");
assert(!/"radialGradient"/.test(visualTs), "Allowlist nao deve depender de radialGradient camelCase.");

console.log("Sanitizer certification regression checks passed.");
