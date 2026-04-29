import fs from "node:fs";
import assert from "node:assert/strict";

const visualTs = fs.readFileSync("src/visual.ts", "utf8");

assert(
  /private shouldFocusRegionWithoutSelection\([\s\S]*?if \(multiSelect\) return false;[\s\S]*?if \(drillRoute\) return false;[\s\S]*?return this\.getCurrentResolvedLevel\(\) > 0;[\s\S]*?\}/.test(
    visualTs
  ),
  "Clique em nivel terminal sem proximo drill deve usar helper explicito para foco sem selecao."
);

assert(
  /if \(kind === "click"\) \{[\s\S]*?const multiSelect = mouseEv\.ctrlKey \|\| mouseEv\.metaKey;[\s\S]*?const drillRoute = row \? this\.getDrillRouteForRow\(row\) : null;[\s\S]*?if \(this\.shouldFocusRegionWithoutSelection\(drillRoute, multiSelect\)\) \{[\s\S]*?this\.focusRegionWithoutSelection\(el\);[\s\S]*?return;[\s\S]*?\}[\s\S]*?if \(!row\) return;/.test(
    visualTs
  ),
  "Clique simples em area sem proximo drill deve focar area antes da saida por row ausente."
);

assert(
  /private clearLocalSelectionWithoutFitReset\(\): void \{[\s\S]*?this\.selectedKeys\.clear\(\);[\s\S]*?this\.selectionSource = "none";[\s\S]*?this\.applySelectionVisualState\(\);[\s\S]*?\}/.test(
    visualTs
  ),
  "Foco sem selecao deve limpar selecao local sem resetar zoom para fit."
);

assert(
  /private focusRegionWithoutSelection\(el: SVGElement\): void \{[\s\S]*?this\.clearLocalSelectionWithoutFitReset\(\);[\s\S]*?this\.focusElements\(\[el\]\);[\s\S]*?\}/.test(
    visualTs
  ),
  "Foco leaf/no-drill deve limpar selecao local e aplicar zoom apenas na area clicada."
);

console.log("Leaf focus without selection regression checks passed.");
