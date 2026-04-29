import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";

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
const capabilitiesText = fs.readFileSync("capabilities.json", "utf8");
assert.equal(capabilities.supportsKeyboardFocus, true, "capabilities.json deve habilitar supportsKeyboardFocus.");
const roleNames = Array.isArray(capabilities.dataRoles) ? capabilities.dataRoles.map((role) => role?.name) : [];
assert(roleNames.includes("category"), "capabilities.json deve expor o dataRole 'category'.");
assert(roleNames.includes("legend"), "capabilities.json deve expor o dataRole 'legend'.");
assert(roleNames.includes("measure"), "capabilities.json deve expor o dataRole 'measure'.");
assert(roleNames.includes("tooltips"), "capabilities.json deve expor o dataRole 'tooltips'.");
assert(!roleNames.includes("colorBy"), "capabilities.json nao deve expor o dataRole 'colorBy'.");
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
assert(
  Array.isArray(capabilities.privileges) &&
    !capabilities.privileges.some((p) => p?.name === "ExportContent"),
  "capabilities.json nao deve declarar o privilegio ExportContent."
);
assert(/displayNameKey/.test(capabilitiesText), "capabilities.json deve expor chaves de localizacao (displayNameKey).");

const visualTs = fs.readFileSync("src/visual.ts", "utf8");
assert(!/localStorage\./.test(visualTs), "visual.ts nao deve acessar localStorage diretamente.");
assert(/storageService/.test(visualTs), "visual.ts deve usar storageService do host.");
assert(!/fetch\s*\(/.test(visualTs), "visual.ts nao deve usar fetch.");
assert(!/XMLHttpRequest/.test(visualTs), "visual.ts nao deve usar XMLHttpRequest.");
assert(/addEventListener\(\s*"keydown"/.test(visualTs), "visual.ts deve ter suporte de teclado para interacao.");
assert(/setAttribute\(\s*"tabindex"\s*,\s*"0"\s*\)/.test(visualTs), "visual.ts deve expor elementos focaveis via teclado.");
assert(/isHighContrast/.test(visualTs), "visual.ts deve tratar modo de alto contraste.");
assert(/sanitizeSvgDocument/.test(visualTs), "visual.ts deve manter sanitizacao SVG.");
assert(/sanitizeSvgElement/.test(visualTs), "visual.ts deve manter sanitizacao de elementos SVG.");
assert(/renderingStarted/.test(visualTs), "visual.ts deve manter renderingStarted.");
assert(/renderingFinished/.test(visualTs), "visual.ts deve manter renderingFinished.");
assert(/renderingFailed/.test(visualTs), "visual.ts deve manter renderingFailed.");
assert(/showContextMenu/.test(visualTs), "visual.ts deve manter supporte a context menu.");
assert(/data:image\/png/.test(visualTs), "visual.ts deve manter politica explicita para data:image/png.");
assert(/removedTags/.test(visualTs) && /removedAttrs/.test(visualTs), "SanitizationReport deve seguir rastreando remocoes.");
assert(!/Aviso: SVG sanitizado/.test(visualTs), "visual.ts nao deve mostrar aviso de SVG sanitizado.");
assert(!/Warning: SVG sanitized/.test(visualTs), "visual.ts nao deve mostrar warning de SVG sanitized.");
assert(!/svgWarning\.style\.display\s*=\s*"block"/.test(visualTs), "warning de sanitizacao nao deve ser exibido.");
assert(!/warning appears/.test(visualTs), "ajuda nao deve prometer warning visual de sanitizacao.");
assert(!/Quando algo inseguro e removido, um aviso aparece/.test(visualTs), "ajuda nao deve prometer aviso visual de sanitizacao.");

const pbiviz = JSON.parse(fs.readFileSync("pbiviz.json", "utf8"));
assert.deepEqual(pbiviz.externalJS, [], "pbiviz.json deve manter externalJS vazio.");
assert.equal(pbiviz.visual.name, "geosynoptic", "pbiviz.json deve voltar ao visual.name de producao.");
assert.equal(pbiviz.visual.displayName, "SVG Synoptic Map", "pbiviz.json deve expor nome publico final.");
assert.equal(
  pbiviz.visual.guid,
  "SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01",
  "pbiviz.json deve usar GUID de producao."
);
assert(!/Dev/i.test(pbiviz.visual.displayName), "pbiviz.json nao deve manter displayName Dev.");
assert(!/Dev/i.test(pbiviz.visual.name), "pbiviz.json nao deve manter visual.name Dev.");
assert(!/blob\/main\/SUPPORT\.md/.test(pbiviz.visual.supportUrl), "supportUrl nao deve apontar para blob/main.");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const packageText = fs.readFileSync("package.json", "utf8");
assert(!/default_template_value/.test(packageText), "package.json nao deve conter placeholders default_template_value.");
assert(packageJson.devDependencies?.["powerbi-visuals-tools"], "package.json deve declarar powerbi-visuals-tools.");
assert(packageJson.scripts?.eslint, "package.json deve manter script eslint.");
assert(packageJson.scripts?.verify, "package.json deve manter script verify.");
assert(/npm audit --audit-level=moderate/.test(packageJson.scripts.verify), "verify deve incluir npm audit.");

assert(fs.existsSync(path.join("stringResources", "en-US", "resources.resjson")), "Projeto deve ter stringResources en-US.");
assert(fs.existsSync(path.join("stringResources", "pt-BR", "resources.resjson")), "Projeto deve ter stringResources pt-BR.");
assert(fs.existsSync(path.join(".github", "workflows", "ci.yml")), "Projeto deve ter workflow CI.");
assert(fs.existsSync(path.join("docs", "compatibility-matrix.md")), "Projeto deve documentar matriz de compatibilidade.");
assert(fs.existsSync(path.join("docs", "sample-hints-and-tips.md")), "Projeto deve documentar conteudo da pagina Hints & Tips do sample.");

const size = readPngSize("assets/icon.png");
assert.equal(size.width, 20, "assets/icon.png deve ter largura 20px.");
assert.equal(size.height, 20, "assets/icon.png deve ter altura 20px.");

console.log("Certification readiness regression checks passed.");
