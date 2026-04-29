import fs from "node:fs";
import assert from "node:assert/strict";

function readPngSize(path) {
  const buf = fs.readFileSync(path);
  const signature = buf.subarray(0, 8).toString("hex");
  assert.equal(signature, "89504e470d0a1a0a", "icon.png deve ser um PNG valido.");
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

assert(fs.existsSync("README.md"), "README.md deve existir na raiz do projeto.");
assert(fs.existsSync("SECURITY.md"), "SECURITY.md deve existir na raiz do projeto.");

const capabilities = JSON.parse(fs.readFileSync("capabilities.json", "utf8"));
assert.equal(capabilities.supportsKeyboardFocus, true, "capabilities.json deve habilitar supportsKeyboardFocus.");
assert(
  Array.isArray(capabilities.privileges) &&
    capabilities.privileges.some((p) => p?.name === "LocalStorage"),
  "capabilities.json deve declarar o privilegio LocalStorage."
);
assert(
  Array.isArray(capabilities.privileges) &&
    !capabilities.privileges.some((p) => p?.name === "WebAccess"),
  "capabilities.json nao deve declarar o privilegio WebAccess."
);

const visualTs = fs.readFileSync("src/visual.ts", "utf8");
assert(!/localStorage\./.test(visualTs), "visual.ts nao deve acessar localStorage diretamente.");
assert(/storageService/.test(visualTs), "visual.ts deve usar storageService do host.");
assert(/addEventListener\(\s*"keydown"/.test(visualTs), "visual.ts deve ter suporte de teclado para interacao.");
assert(/setAttribute\(\s*"tabindex"\s*,\s*"0"\s*\)/.test(visualTs), "visual.ts deve expor elementos focaveis via teclado.");
assert(/isHighContrast/.test(visualTs), "visual.ts deve tratar modo de alto contraste.");
assert(/sanitizeSvgDocument/.test(visualTs), "visual.ts deve manter sanitizacao SVG.");
assert(/sanitizeSvgElement/.test(visualTs), "visual.ts deve manter sanitizacao de elementos SVG.");
assert(/removedTags/.test(visualTs) && /removedAttrs/.test(visualTs), "SanitizationReport deve seguir rastreando remocoes.");
assert(!/Aviso: SVG sanitizado/.test(visualTs), "visual.ts nao deve mostrar aviso de SVG sanitizado.");
assert(!/Warning: SVG sanitized/.test(visualTs), "visual.ts nao deve mostrar warning de SVG sanitized.");
assert(!/svgWarning\.style\.display\s*=\s*"block"/.test(visualTs), "warning de sanitizacao nao deve ser exibido.");
assert(!/warning appears/.test(visualTs), "ajuda nao deve prometer warning visual de sanitizacao.");
assert(!/Quando algo inseguro e removido, um aviso aparece/.test(visualTs), "ajuda nao deve prometer aviso visual de sanitizacao.");

const pbiviz = JSON.parse(fs.readFileSync("pbiviz.json", "utf8"));
assert.deepEqual(pbiviz.externalJS, [], "pbiviz.json deve manter externalJS vazio.");

const size = readPngSize("assets/icon.png");
assert.equal(size.width, 20, "assets/icon.png deve ter largura 20px.");
assert.equal(size.height, 20, "assets/icon.png deve ter altura 20px.");

console.log("Certification readiness regression checks passed.");
