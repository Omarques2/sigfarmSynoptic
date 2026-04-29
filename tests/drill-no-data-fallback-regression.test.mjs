import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const repoRoot = process.cwd();
const visualTs = fs.readFileSync(path.join(repoRoot, "src", "visual.ts"), "utf8");

assert(
  !/const svgText = \(map\?\.svgText \|\| defaultSvgText \|\| ""\)\.trim\(\);/.test(visualTs),
  "Quando resolveDrillMap retorna none, visual nao deve cair no defaultSvgText/base map. Deve preservar mapa atual."
);

console.log("Drill no-data fallback regression checks passed.");
