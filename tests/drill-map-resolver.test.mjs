import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, "src", "drillMapResolver.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
    strict: true
  }
}).outputText;

const tmpPath = path.join(os.tmpdir(), `drillMapResolver-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
fs.writeFileSync(tmpPath, compiled, "utf8");

try {
  const { resolveDrillMap, validateMapRegistryManifestIssues, validateDrillMapGraphIssues } = await import(pathToFileURL(tmpPath).href);

  const baseMaps = [
    { mapId: "default", name: "Default", svgText: "<svg><path id='BR'/></svg>" },
    { mapId: "path", name: "Path", level: 1, drillPath: ["Estado", "Municipio"], svgText: "<svg><path id='CidadeA'/></svg>" },
    { mapId: "level", name: "Level", level: 1, svgText: "<svg><path id='Nivel'/></svg>" },
    { mapId: "auto", name: "Auto", svgText: "<svg><path id='Auto'/></svg>" },
    { mapId: "override", name: "Override", svgText: "<svg><path id='Override'/></svg>" }
  ];

  const options = { enabled: true, fallbackToDefaultMap: true };

  {
    const result = resolveDrillMap(
      { defaultMapId: "default", maps: baseMaps },
      {
        currentDrillPath: ["Estado", "Municipio"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Municipio"],
        pendingDrillSource: {
          sourceMapId: "default",
          sourceAreaId: "BR-SP",
          targetMapId: "override",
          sourceLevel: 0,
          sourcePath: ["Estado"]
        },
        categoryMatchScores: { auto: { score: 100, categoryName: "Municipio" } }
      },
      options
    );
    assert.equal(result.mapId, "override");
    assert.equal(result.reason, "areaOverride");
  }

  {
    const result = resolveDrillMap(
      { defaultMapId: "default", maps: baseMaps },
      {
        currentDrillPath: ["Estado", "Municipio"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Municipio"],
        pendingDrillSource: {
          sourceMapId: "default",
          sourceAreaId: "BR-SP",
          targetMapId: "override",
          sourceLevel: 0,
          sourcePath: ["Estado"]
        }
      },
      options
    );
    assert.equal(result.mapId, "override");
    assert.equal(result.reason, "areaOverride");
    assert.equal(result.map.level, undefined);
  }

  {
    const result = resolveDrillMap(
      { defaultMapId: "default", maps: baseMaps },
      {
        currentDrillPath: ["Estado"],
        currentLevel: 0,
        categoryFieldNames: ["Estado"],
        pendingDrillSource: {
          sourceMapId: "path",
          sourceAreaId: "CidadeA",
          targetMapId: "override",
          sourceLevel: 1,
          sourcePath: ["Estado", "Municipio"]
        }
      },
      options
    );
    assert.notEqual(result.mapId, "override");
    assert.equal(result.mapId, "default");
  }

  {
    const result = resolveDrillMap(
      { defaultMapId: "default", maps: baseMaps },
      {
        currentDrillPath: ["Estado", "Municipio", "Bairro"],
        currentLevel: 2,
        categoryFieldNames: ["Estado", "Municipio", "Bairro"],
        pendingDrillSource: {
          sourceMapId: "default",
          sourceAreaId: "BR-SP",
          targetMapId: "override",
          sourceLevel: 0,
          sourcePath: ["Estado"]
        }
      },
      options
    );
    assert.notEqual(result.mapId, "override");
  }

  {
    const maps = [
      { mapId: "first_added", name: "Primeiro adicionado", level: 0, svgText: "<svg><path id='SP'/></svg>" },
      { mapId: "chosen_root", name: "Mapa raiz escolhido", level: 0, svgText: "<svg><path id='MG'/></svg>" }
    ];
    const result = resolveDrillMap(
      { defaultMapId: "chosen_root", maps },
      {
        currentDrillPath: ["Estado"],
        currentLevel: 0,
        categoryFieldNames: ["Estado"],
        categoryMatchScores: {
          first_added: { score: 100, categoryName: "Estado" },
          chosen_root: { score: 1, categoryName: "Estado" }
        }
      },
      options
    );
    assert.equal(result.mapId, "chosen_root");
    assert.equal(result.reason, "default");
  }

  {
    const maps = [
      {
        mapId: "estados",
        name: "Estados",
        level: 0,
        svgText: "<svg><path id='SP'/></svg>",
        areas: {
          SP: { drillMode: "manual", drillToMapId: "municipios_sp" }
        }
      },
      {
        mapId: "municipios_sp",
        name: "Municipios SP",
        level: 1,
        svgText: "<svg><path id='Barretos_SP'/></svg>",
        areas: {
          Barretos_SP: { drillMode: "manual", drillToMapId: "bairros_barretos" }
        }
      },
      {
        mapId: "bairros_barretos",
        name: "Bairros Barretos",
        level: 2,
        svgText: "<svg><path id='Centro_Barretos_SP'/></svg>"
      }
    ];

    const result = resolveDrillMap(
      { defaultMapId: "estados", maps },
      {
        currentDrillPath: ["Estado", "Municipio", "Bairro"],
        currentLevel: 2,
        categoryFieldNames: ["Estado", "Municipio", "Bairro"],
        pendingDrillSource: {
          sourceMapId: "municipios_sp",
          sourceAreaId: "Barretos_SP",
          targetMapId: "bairros_barretos",
          sourceLevel: 1,
          sourcePath: ["Estado", "Municipio"]
        }
      },
      options
    );

    assert.equal(result.mapId, "bairros_barretos");
    assert.equal(result.reason, "areaOverride");
  }

  {
    const result = resolveDrillMap(
      { defaultMapId: "default", maps: baseMaps },
      {
        currentDrillPath: ["Estado", "Municipio"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Municipio"],
        categoryMatchScores: { auto: { score: 100, categoryName: "Municipio" } }
      },
      options
    );
    assert.equal(result.mapId, "path");
    assert.equal(result.reason, "drillPath");
  }

  {
    const maps = baseMaps.filter((map) => map.mapId !== "path");
    const result = resolveDrillMap(
      { defaultMapId: "default", maps },
      {
        currentDrillPath: ["Estado", "Outro"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Outro"],
        categoryMatchScores: { auto: { score: 100, categoryName: "Outro" } }
      },
      options
    );
    assert.equal(result.mapId, "level");
    assert.equal(result.reason, "level");
  }

  {
    const maps = [
      { mapId: "default", level: 0, svgText: "<svg><path id='SP'/><path id='GO'/><path id='MG'/></svg>" },
      { mapId: "Brasil_municipios_SP", level: 1, drillPath: ["SP"], svgText: "<svg><path id='Barretos_SP'/><path id='Guaíra_SP'/></svg>" },
      { mapId: "Brasil_municipios_MG", level: 1, drillPath: ["MG"], svgText: "<svg><path id='Planura_MG'/><path id='Conceição_das_Alagoas_MG'/></svg>" },
      { mapId: "Brasil_municipios_GO", level: 1, drillPath: ["GO"], svgText: "<svg><path id='Goiânia_GO'/></svg>" }
    ];

    const result = resolveDrillMap(
      { defaultMapId: "default", maps },
      {
        currentDrillPath: ["Estado", "Municipio"],
        currentDrillValuePath: ["GO"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Municipio"],
        categoryMatchScores: {
          Brasil_municipios_SP: { score: 0, categoryName: "Municipio" },
          Brasil_municipios_MG: { score: 0, categoryName: "Municipio" },
          Brasil_municipios_GO: { score: 1, categoryName: "Municipio" }
        }
      },
      options
    );
    assert.equal(result.mapId, "Brasil_municipios_GO");
    assert.equal(result.reason, "drillPath");
  }

  {
    const maps = [
      { mapId: "default", level: 0, svgText: "<svg><path id='SP'/><path id='GO'/><path id='MG'/></svg>" },
      { mapId: "Brasil_municipios_SP", level: 1, drillPath: ["SP"], svgText: "<svg><path id='Barretos_SP'/></svg>" },
      { mapId: "Brasil_municipios_MG", level: 1, drillPath: ["MG"], svgText: "<svg><path id='Planura_MG'/></svg>" },
      { mapId: "Brasil_municipios_GO", level: 1, drillPath: ["GO"], svgText: "<svg><path id='Goiânia_GO'/></svg>" }
    ];
    const result = resolveDrillMap(
      { defaultMapId: "default", maps },
      {
        currentDrillPath: ["Estado", "Municipio"],
        currentDrillValuePath: ["MG"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Municipio"],
        categoryMatchScores: {
          Brasil_municipios_SP: { score: 0, categoryName: "Municipio" },
          Brasil_municipios_MG: { score: 1, categoryName: "Municipio" },
          Brasil_municipios_GO: { score: 0, categoryName: "Municipio" }
        }
      },
      options
    );
    assert.equal(result.mapId, "Brasil_municipios_MG");
    assert.equal(result.reason, "drillPath");
  }

  {
    const maps = [
      { mapId: "default", level: 0, svgText: "<svg><path id='SP'/><path id='GO'/><path id='MG'/></svg>" },
      { mapId: "Brasil_municipios_SP", level: 1, drillPath: ["SP"], svgText: "<svg><path id='Barretos_SP'/></svg>" },
      { mapId: "Brasil_municipios_MG", level: 1, drillPath: ["MG"], svgText: "<svg><path id='Planura_MG'/></svg>" },
      { mapId: "Brasil_municipios_GO", level: 1, drillPath: ["GO"], svgText: "<svg><path id='Goiânia_GO'/></svg>" }
    ];
    const result = resolveDrillMap(
      { defaultMapId: "default", maps },
      {
        currentDrillPath: ["Estado", "Municipio"],
        currentDrillValuePath: ["SP"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Municipio"]
      },
      options
    );
    assert.equal(result.mapId, "Brasil_municipios_SP");
    assert.equal(result.reason, "drillPath");
  }

  {
    const maps = [
      { mapId: "default", level: 0, svgText: "<svg><path id='SP'/><path id='GO'/><path id='MG'/></svg>" },
      { mapId: "Brasil_municipios_SP", level: 1, svgText: "<svg><path id='Barretos_SP'/></svg>" },
      { mapId: "Brasil_municipios_MG", level: 1, svgText: "<svg><path id='Planura_MG'/></svg>" },
      { mapId: "Brasil_municipios_GO", level: 1, svgText: "<svg><path id='Goiânia_GO'/></svg>" }
    ];
    const result = resolveDrillMap(
      { defaultMapId: "default", maps },
      {
        currentDrillPath: ["Estado", "Municipio"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Municipio"],
        categoryMatchScores: {
          Brasil_municipios_SP: { score: 0, categoryName: "Municipio" },
          Brasil_municipios_MG: { score: 0, categoryName: "Municipio" },
          Brasil_municipios_GO: { score: 10, categoryName: "Municipio" }
        }
      },
      options
    );
    assert.equal(result.mapId, "Brasil_municipios_GO");
    assert.equal(result.reason, "automatch");
  }

  {
    const maps = [
      { mapId: "default", level: 0, svgText: "<svg></svg>" },
      { mapId: "Brasil_municipios_SP", level: 1, svgText: "<svg></svg>" },
      { mapId: "Brasil_municipios_MG", level: 1, svgText: "<svg></svg>" }
    ];
    const result = resolveDrillMap(
      { defaultMapId: "default", maps },
      {
        currentDrillPath: ["Estado", "Municipio"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Municipio"]
      },
      options
    );
    assert.equal(result.mapId, "Brasil_municipios_SP");
    assert.equal(result.reason, "level");
    assert.ok(result.warnings.some((warning) => warning.includes("sem desempate por dados")));
  }

  {
    const maps = [
      { mapId: "default", level: 0, svgText: "<svg><path id='SP'/></svg>" },
      {
        mapId: "Brasil_municipios_SP",
        level: 1,
        drillPath: ["SP"],
        svgText: "<svg><path id='Barretos_SP'/></svg>"
      },
      {
        mapId: "Barretos_SP_bairros",
        level: 2,
        drillPath: ["SP", "Barretos_SP"],
        svgText: "<svg><path id='Centro_Barretos_SP'/><path id='Outro_Bairro_SP'/></svg>",
        areas: {
          Centro_Barretos_SP: { drillMode: "manual", drillToMapId: "Centro_Barretos_SP_casas" }
        }
      },
      {
        mapId: "Centro_Barretos_SP_casas",
        level: 3,
        drillPath: ["SP", "Barretos_SP", "Centro_Barretos_SP"],
        svgText: "<svg><path id='Casa_1'/></svg>"
      },
      {
        mapId: "America_Barretos_SP_casas",
        level: 3,
        drillPath: ["SP", "Barretos_SP", "America_Barretos_SP"],
        svgText: "<svg><path id='Casa_2'/></svg>"
      }
    ];

    const unmapped = resolveDrillMap(
      { defaultMapId: "default", maps },
      {
        currentDrillPath: ["Estado", "Municipio", "Bairro", "Casa"],
        currentDrillValuePath: ["SP", "Barretos_SP", "Outro_Bairro_SP"],
        currentLevel: 3,
        categoryFieldNames: ["Estado", "Municipio", "Bairro", "Casa"],
        requireExplicitDrillPath: true
      },
      options
    );
    assert.equal(unmapped.mapId, null);
    assert.equal(unmapped.reason, "none");
    assert.notEqual(unmapped.mapId, "Centro_Barretos_SP_casas");
    assert.notEqual(unmapped.mapId, "America_Barretos_SP_casas");

    const mapped = resolveDrillMap(
      { defaultMapId: "default", maps },
      {
        currentDrillPath: ["Estado", "Municipio", "Bairro", "Casa"],
        currentDrillValuePath: ["SP", "Barretos_SP", "Centro_Barretos_SP"],
        currentLevel: 3,
        categoryFieldNames: ["Estado", "Municipio", "Bairro", "Casa"],
        requireExplicitDrillPath: true
      },
      options
    );
    assert.equal(mapped.mapId, "Centro_Barretos_SP_casas");
    assert.equal(mapped.reason, "drillPath");

    const legacy = resolveDrillMap(
      { defaultMapId: "default", maps },
      {
        currentDrillPath: ["Estado", "Municipio", "Bairro", "Casa"],
        currentDrillValuePath: ["SP", "Barretos_SP", "Outro_Bairro_SP"],
        currentLevel: 3,
        categoryFieldNames: ["Estado", "Municipio", "Bairro", "Casa"],
        requireExplicitDrillPath: false
      },
      options
    );
    assert.notEqual(legacy.reason, "none");
  }

  {
    const maps = [
      { mapId: "default", level: 0, svgText: "<svg><path id='SP'/><path id='MG'/></svg>" },
      {
        mapId: "Brasil_municipios_MG",
        level: 1,
        drillPath: ["MG"],
        svgText: "<svg><path id='Planura_MG'/><path id='Conceição_das_Alagoas_MG'/></svg>"
      },
      {
        mapId: "Planura_MG_bairros",
        level: 2,
        drillPath: ["MG", "Planura_MG"],
        svgText: "<svg><path id='Centro_Planura_MG'/><path id='Bairro_sem_dados'/></svg>"
      }
    ];

    const unresolved = resolveDrillMap(
      { defaultMapId: "default", maps },
      {
        currentDrillPath: ["Estado", "Municipio", "Bairro", "Casa"],
        currentDrillValuePath: ["MG", "Planura_MG", "Bairro_sem_dados"],
        currentLevel: 3,
        categoryFieldNames: ["Estado", "Municipio", "Bairro", "Casa"],
        requireExplicitDrillPath: true
      },
      options
    );

    assert.equal(unresolved.mapId, null);
    assert.equal(unresolved.reason, "none");
    assert.notEqual(unresolved.mapId, "default");
  }

  {
    const maps = [
      {
        mapId: "default",
        level: 0,
        svgText: "<svg><path id='GO'/><path id='MG'/></svg>",
        areas: {
          GO: { drillMode: "manual", drillToMapId: "brasil_municipios_go" },
          MG: { drillMode: "manual", drillToMapId: "brasil_municipios_mg" }
        }
      },
      {
        mapId: "brasil_municipios_go",
        svgText: "<svg><path id='Goiânia_GO'/><path id='Anápolis_GO'/></svg>",
        areas: {
          Goiânia_GO: { drillMode: "manual", drillToMapId: "goiania_go_bairros" }
        }
      },
      {
        mapId: "brasil_municipios_mg",
        svgText: "<svg><path id='Planura_MG'/><path id='Conceição_das_Alagoas_MG'/></svg>",
        areas: {
          Planura_MG: { drillMode: "manual", drillToMapId: "planura_mg_bairros" }
        }
      },
      {
        mapId: "goiania_go_bairros",
        svgText: "<svg><path id='Centro_Goiânia_GO'/></svg>"
      },
      {
        mapId: "planura_mg_bairros",
        svgText: "<svg><path id='Centro_Planura_MG'/></svg>"
      }
    ];

    const result = resolveDrillMap(
      { defaultMapId: "default", maps },
      {
        currentDrillPath: ["Estado", "Municipio"],
        currentDrillValuePath: ["GO"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Municipio"],
        previousMapId: "goiania_go_bairros",
        requireExplicitDrillPath: true,
        categoryMatchScores: {
          brasil_municipios_go: { score: 1, categoryName: "Municipio" },
          brasil_municipios_mg: { score: 0, categoryName: "Municipio" },
          goiania_go_bairros: { score: 0, categoryName: "Municipio" }
        }
      },
      options
    );

    assert.equal(result.mapId, "brasil_municipios_go");
    assert.equal(result.reason, "parentEdge");
    assert.notEqual(result.mapId, "goiania_go_bairros");
  }

  {
    const maps = baseMaps.filter((map) => !["path", "level", "override"].includes(map.mapId));
    const result = resolveDrillMap(
      { defaultMapId: "default", maps },
      {
        currentDrillPath: ["Estado", "Municipio"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Municipio"],
        categoryMatchScores: { auto: { score: 5, categoryName: "Municipio" } }
      },
      options
    );
    assert.equal(result.mapId, "auto");
    assert.equal(result.reason, "automatch");
  }

  {
    const result = resolveDrillMap(
      { defaultMapId: "default", maps: baseMaps },
      {
        currentDrillPath: ["Estado", "Municipio"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Municipio"],
        pendingDrillSource: {
          sourceMapId: "default",
          sourceAreaId: "BR-SP",
          targetMapId: "missing",
          sourceLevel: 0,
          sourcePath: ["Estado"]
        }
      },
      options
    );
    assert.equal(result.mapId, "path");
    assert.equal(result.reason, "drillPath");
    assert.ok(result.warnings.some((warning) => warning.includes("mapa inexistente")));
  }

  {
    const result = resolveDrillMap(
      { defaultMapId: "default", maps: [{ ...baseMaps[1], mapId: "path-a" }, { ...baseMaps[1], mapId: "path-b" }] },
      {
        currentDrillPath: ["Estado", "Municipio"],
        currentLevel: 1,
        categoryFieldNames: ["Estado", "Municipio"]
      },
      options
    );
    assert.equal(result.mapId, "path-a");
    assert.equal(result.reason, "drillPath");
    assert.ok(result.warnings.some((warning) => warning.includes("drillPath atual")));
  }

  {
    const issues = validateMapRegistryManifestIssues({
      defaultMapId: "a",
      maps: [
        { mapId: "a", svgText: "<svg><path id='ok'/></svg>", areas: { ok: {}, missing: { drillToMapId: "z" } } },
        { mapId: "a", svgText: "" },
        { mapId: "b", svgText: "<svg><path id='self'/><path id='empty'/></svg>", areas: { self: { drillToMapId: "b" }, empty: { drillToMapId: "c" } } },
        { mapId: "c", svgText: "" }
      ]
    });
    assert.ok(issues.some((issue) => issue.code === "MAP_ID_DUPLICATE" && issue.severity === "error"));
    assert.ok(issues.some((issue) => issue.code === "AREA_DRILL_TARGET_MISSING" && issue.severity === "warning"));
    assert.ok(issues.some((issue) => issue.code === "MAP_WITHOUT_SVG" && issue.severity === "warning"));
    assert.ok(issues.some((issue) => issue.code === "AREA_DRILL_TARGET_SELF" && issue.severity === "warning"));
    assert.ok(issues.some((issue) => issue.code === "AREA_DRILL_TARGET_WITHOUT_SVG" && issue.severity === "warning"));
  }

  {
    const issues = validateDrillMapGraphIssues({
      defaultMapId: "a",
      maps: [
        { mapId: "a", svgText: "<svg></svg>", areas: { x: { drillToMapId: "b" } } },
        { mapId: "b", svgText: "<svg></svg>", areas: { y: { drillToMapId: "c" } } },
        { mapId: "c", svgText: "<svg></svg>", areas: { z: { drillToMapId: "a" } } },
        { mapId: "d", svgText: "", areas: { bad: { drillToMapId: "missing" } } },
        { mapId: "e", svgText: "<svg></svg>", areas: { bad: { drillToMapId: "d" } } }
      ]
    });
    assert.ok(issues.some((issue) => issue.code === "DRILL_GRAPH_CYCLE" && issue.severity === "error"));
    assert.ok(issues.some((issue) => issue.code === "DRILL_GRAPH_TARGET_MISSING" && issue.severity === "error"));
    assert.ok(issues.some((issue) => issue.code === "DRILL_GRAPH_TARGET_WITHOUT_SVG" && issue.severity === "warning"));
  }

  console.log("drill-map-resolver tests passed");
} finally {
  fs.rmSync(tmpPath, { force: true });
}
