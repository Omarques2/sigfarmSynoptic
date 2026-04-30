import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, "src", "drillHierarchyState.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
    strict: true
  }
}).outputText;

const tmpPath = path.join(os.tmpdir(), `drillHierarchyState-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
fs.writeFileSync(tmpPath, compiled, "utf8");

try {
  const {
    getEffectiveCategoryColumns,
    getEffectiveCurrentLevel,
    getEffectiveCurrentCategory,
    getConfiguredCategoryColumns
  } = await import(pathToFileURL(tmpPath).href);

  const category = (queryName, values) => ({
    source: {
      queryName,
      displayName: queryName.split(".").at(-1),
      roles: { category: true }
    },
    values
  });

  {
    const columns = [
      category("DrillPathGrande.Estado", ["SP", "MG", "GO"]),
      category("DrillPathGrande.Municipio", ["Barretos_SP", "Uberaba_MG", "Goiânia_GO"])
    ];
    const projections = [
      { queryRef: "DrillPathGrande.Estado", active: true },
      { queryRef: "DrillPathGrande.Municipio", active: false }
    ];

    const configured = getConfiguredCategoryColumns(columns);
    const effective = getEffectiveCategoryColumns(columns, projections);
    const currentLevel = getEffectiveCurrentLevel(columns, projections);
    const currentCategory = getEffectiveCurrentCategory(columns, projections);

    assert.equal(configured.length, 2, "hierarquia configurada deve manter 2 colunas.");
    assert.equal(effective.length, 1, "hierarquia efetiva deve ignorar projeção inativa.");
    assert.equal(currentLevel, 0, "nivel atual deve ficar na raiz.");
    assert.equal(currentCategory?.source?.queryName, "DrillPathGrande.Estado");
  }

  {
    const columns = [
      category("DrillPathGrande.Estado", ["SP", "SP", "SP"]),
      category("DrillPathGrande.Municipio", ["Barretos_SP", "Guaíra_SP", "Colina_SP"])
    ];
    const projections = [
      { queryRef: "DrillPathGrande.Estado", active: true },
      { queryRef: "DrillPathGrande.Municipio", active: true }
    ];

    const effective = getEffectiveCategoryColumns(columns, projections);
    const currentLevel = getEffectiveCurrentLevel(columns, projections);
    const currentCategory = getEffectiveCurrentCategory(columns, projections);

    assert.equal(effective.length, 2, "drill real deve manter colunas ativas.");
    assert.equal(currentLevel, 1, "nivel atual deve avançar para municipio.");
    assert.equal(currentCategory?.source?.queryName, "DrillPathGrande.Municipio");
  }

  {
    const columns = [
      category("DrillPathGrande.Estado", ["SP", "MG", "GO"]),
      category("DrillPathGrande.Municipio", ["Barretos_SP", "Uberaba_MG", "Goiânia_GO"])
    ];

    const effective = getEffectiveCategoryColumns(columns, []);
    const currentLevel = getEffectiveCurrentLevel(columns, []);
    const currentCategory = getEffectiveCurrentCategory(columns, []);

    assert.equal(effective.length, 1, "fallback legado deve usar primeira coluna variando.");
    assert.equal(currentLevel, 0, "sem metadata active, raiz com estados variados deve continuar raiz.");
    assert.equal(currentCategory?.source?.queryName, "DrillPathGrande.Estado");
  }

  console.log("Inactive hierarchy drill regression checks passed.");
} finally {
  fs.unlinkSync(tmpPath);
}
