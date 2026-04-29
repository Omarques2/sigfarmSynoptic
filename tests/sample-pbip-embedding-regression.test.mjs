import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const repoRoot = process.cwd();
const sampleRoot = path.join(repoRoot, "samples");
const sampleReadmePath = path.join(sampleRoot, "README.md");
const sampleReadme = fs.existsSync(sampleReadmePath) ? fs.readFileSync(sampleReadmePath, "utf8") : "";
const samplePbixPath = path.join(sampleRoot, "SVGSynopticMapSample.pbix");
const samplePbipPath = path.join(sampleRoot, "SVGSynopticMapSample.pbip");
const flatReportRoot = path.join(sampleRoot, "SVGSynopticMapSample.Report");
const nestedReportRoot = path.join(sampleRoot, "SVGSynopticMapSample", "SVGSynopticMapSample.Report");
const flatSemanticRoot = path.join(sampleRoot, "SVGSynopticMapSample.SemanticModel");
const nestedSemanticRoot = path.join(sampleRoot, "SVGSynopticMapSample", "SVGSynopticMapSample.SemanticModel");

assert(fs.existsSync(samplePbixPath), "Sample final deve incluir SVGSynopticMapSample.pbix.");
assert(fs.statSync(samplePbixPath).size > 100000, "Sample PBIX final nao deve ser arquivo vazio ou placeholder.");
assert(
  /same production package version as submitted `?\.pbiviz`?/i.test(sampleReadme),
  "README do sample deve registrar que o PBIX final precisa usar a mesma versao do .pbiviz submetido."
);
assert(
  /final validated `?\.pbix`/i.test(sampleReadme) && /work offline/i.test(sampleReadme),
  "README do sample deve deixar claro que o artefato final de submissao e o PBIX offline validado."
);

const hasPbipSource = fs.existsSync(samplePbipPath) || fs.existsSync(flatReportRoot) || fs.existsSync(nestedReportRoot);

if (hasPbipSource) {
  const reportRoot = fs.existsSync(flatReportRoot) ? flatReportRoot : nestedReportRoot;
  const reportJsonPath = path.join(reportRoot, "definition", "report.json");
  const reportJson = JSON.parse(fs.readFileSync(reportJsonPath, "utf8"));
  const customVisualRoot = path.join(
    reportRoot,
    "CustomVisuals",
    "SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01"
  );
  const customVisualPackagePath = path.join(customVisualRoot, "package.json");
  const customVisualMetadataPath = path.join(
    customVisualRoot,
    "resources",
    "SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01.pbiviz.json"
  );
  const semanticModelRoot = fs.existsSync(flatSemanticRoot) ? flatSemanticRoot : nestedSemanticRoot;
  const drillTablePath = path.join(semanticModelRoot, "definition", "tables", "DrillTeste.tmdl");
  const drillTable = fs.existsSync(drillTablePath) ? fs.readFileSync(drillTablePath, "utf8") : "";

  const customVisualResourcePackage = (reportJson.resourcePackages || []).find(
    (pkg) =>
      pkg?.type === "CustomVisual" &&
      pkg?.name === "SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01"
  );

  if (customVisualResourcePackage) {
    assert(
      fs.existsSync(customVisualPackagePath),
      "Sample PBIP embutido deve conter package.json do custom visual."
    );
    assert(
      fs.existsSync(customVisualMetadataPath),
      "Sample PBIP embutido deve conter metadata .pbiviz.json do custom visual."
    );
    const customVisualPkg = JSON.parse(fs.readFileSync(customVisualPackagePath, "utf8"));
    assert.equal(
      customVisualPkg.version,
      "1.0.0.12",
      "Sample PBIP embutido deve usar package local na versao 1.0.0.12."
    );
  } else {
    assert(
      (reportJson.publicCustomVisuals || []).includes("SynopticPanelE2B5B9B6B0B14B8C8B0E6C0A7D6A1F01"),
      "Sample PBIP sem pacote embutido deve ao menos referenciar GUID publico correto."
    );
  }

  assert(
    !/File\.Contents\("([A-Za-z]:\\\\|\/)/.test(drillTable),
    "Sample PBIP source nao deve depender de caminho absoluto local para dados."
  );
}

console.log("Sample PBIP embedding regression checks passed.");
