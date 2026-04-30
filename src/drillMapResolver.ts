export type DrillMode = "manual" | "automatic" | "none";

export type DrillMapArea = {
  drillToMapId?: string;
  drillMode?: DrillMode;
};

export type DrillMapCandidateMap = {
  mapId: string;
  name?: string;
  svgText?: string;
  level?: number;
  drillPath?: string[];
  areas?: Record<string, DrillMapArea>;
};

export type DrillMapManifestLike = {
  defaultMapId?: string;
  maps: DrillMapCandidateMap[];
};

export type PendingDrillSource = {
  sourceMapId: string;
  sourceAreaId: string;
  targetMapId?: string;
  sourceLevel: number;
  sourcePath: string[];
};

export type DrillMapContext = {
  currentDrillPath: string[];
  currentDrillValuePath?: string[];
  currentLevel: number;
  categoryFieldNames: string[];
  activeCategoryQueryName?: string | null;
  previousMapId?: string | null;
  pendingDrillSource?: PendingDrillSource | null;
  categoryMatchScores?: Record<string, { score: number; categoryName?: string | null }>;
  requireExplicitDrillPath?: boolean;
};

export type DrillMapOptions = {
  enabled: boolean;
  fallbackToDefaultMap: boolean;
};

export type DrillMapResolutionReason =
  | "areaOverride"
  | "drillPath"
  | "level"
  | "parentEdge"
  | "automatch"
  | "default"
  | "none";

export type DrillMapCandidateTrace = {
  mapId: string;
  name?: string;
  hasSvg: boolean;
  level?: number;
  drillPath?: string[];
  autoMatchScore: number;
  autoMatchCategoryName?: string | null;
  status: "selected" | "candidate" | "ignored";
  reason?: DrillMapResolutionReason;
  warnings?: string[];
};

export type DrillMapResolutionTrace = {
  map: DrillMapCandidateMap | null;
  mapId: string | null;
  reason: DrillMapResolutionReason;
  candidates: DrillMapCandidateTrace[];
  warnings: string[];
};

export type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  mapId?: string;
  areaId?: string;
};

function norm(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizePath(path?: string[] | null): string[] {
  return Array.isArray(path)
    ? path.map((part) => norm(part)).filter((part) => !!part)
    : [];
}

function hasSvg(map: DrillMapCandidateMap | null | undefined): boolean {
  return !!map?.svgText?.trim();
}

function extractSvgAreaIds(svgText?: string): Set<string> {
  const ids = new Set<string>();
  const text = svgText || "";
  const idRegex = /\bid\s*=\s*(["'])(.*?)\1/gi;
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(text)) !== null) {
    const id = norm(match[2]);
    if (id) ids.add(id);
  }
  return ids;
}

function createCandidateTrace(
  manifest: DrillMapManifestLike,
  context: DrillMapContext
): DrillMapCandidateTrace[] {
  return manifest.maps.map((map) => {
    const score = context.categoryMatchScores?.[map.mapId];
    return {
      mapId: map.mapId,
      name: map.name,
      hasSvg: hasSvg(map),
      level: Number.isFinite(map.level) ? map.level : undefined,
      drillPath: map.drillPath,
      autoMatchScore: score?.score ?? 0,
      autoMatchCategoryName: score?.categoryName ?? null,
      status: hasSvg(map) ? "candidate" : "ignored"
    };
  });
}

function selectTrace(
  traces: DrillMapCandidateTrace[],
  selectedMapId: string | null,
  reason: DrillMapResolutionReason
): void {
  traces.forEach((trace) => {
    if (selectedMapId && trace.mapId === selectedMapId) {
      trace.status = "selected";
      trace.reason = reason;
    } else if (!trace.hasSvg) {
      trace.status = "ignored";
    } else {
      trace.status = "candidate";
    }
  });
}

function findDefaultMap(manifest: DrillMapManifestLike): DrillMapCandidateMap | null {
  return (
    (manifest.defaultMapId && manifest.maps.find((map) => map.mapId === manifest.defaultMapId)) ||
    manifest.maps[0] ||
    null
  );
}

function isPendingSourceForAdvancedLevel(context: DrillMapContext): boolean {
  const pending = context.pendingDrillSource;
  if (!pending) return false;
  const currentPath = normalizePath(context.currentDrillPath);
  const sourcePath = normalizePath(pending.sourcePath);
  const advancedExactlyOneLevel = context.currentLevel === pending.sourceLevel + 1;
  if (!advancedExactlyOneLevel) return false;
  if (sourcePath.length > 0) {
    const sourceStillPrefix = sourcePath.every((part, index) => currentPath[index] === part);
    if (!sourceStillPrefix) return false;
  }
  return currentPath.length >= sourcePath.length;
}

export function validateDrillMapGraphIssues(manifest: DrillMapManifestLike): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const mapById = new Map(manifest.maps.map((map) => [map.mapId, map] as const));
  const seenEdgeIssues = new Set<string>();
  const seenCycleIssues = new Set<string>();

  const emitEdgeIssue = (
    code: string,
    severity: "error" | "warning",
    message: string,
    mapId: string,
    areaId: string
  ): void => {
    const key = `${code}:${mapId}:${areaId}:${message}`;
    if (seenEdgeIssues.has(key)) return;
    seenEdgeIssues.add(key);
    issues.push({ code, severity, message, mapId, areaId });
  };

  const walk = (mapId: string, stack: string[]): void => {
    const map = mapById.get(mapId);
    if (!map) return;
    for (const [areaId, area] of Object.entries(map.areas || {})) {
      const targetMapId = area.drillToMapId;
      if (!targetMapId) continue;
      const targetMap = mapById.get(targetMapId);
      if (!targetMap) {
        emitEdgeIssue(
          "DRILL_GRAPH_TARGET_MISSING",
          "error",
          `area ${areaId} aponta para mapa inexistente: ${targetMapId}`,
          mapId,
          areaId
        );
        continue;
      }
      if (!targetMap.svgText?.trim()) {
        emitEdgeIssue(
          "DRILL_GRAPH_TARGET_WITHOUT_SVG",
          "warning",
          `area ${areaId} aponta para mapa sem SVG: ${targetMapId}`,
          mapId,
          areaId
        );
      }
      const cycleAt = stack.indexOf(targetMapId);
      if (cycleAt >= 0) {
        const cyclePath = [...stack.slice(cycleAt), targetMapId].join(" -> ");
        const cycleKey = `${mapId}:${areaId}:${cyclePath}`;
        if (!seenCycleIssues.has(cycleKey)) {
          seenCycleIssues.add(cycleKey);
          issues.push({
            severity: "error",
            code: "DRILL_GRAPH_CYCLE",
            message: `ciclo detectado: ${cyclePath}`,
            mapId,
            areaId
          });
        }
        continue;
      }
      walk(targetMapId, [...stack, targetMapId]);
    }
  };

  manifest.maps.forEach((map) => walk(map.mapId, [map.mapId]));
  return issues;
}

export function resolveDrillMap(
  manifest: DrillMapManifestLike,
  context: DrillMapContext,
  options: DrillMapOptions
): DrillMapResolutionTrace {
  const warnings: string[] = [];
  const candidates = createCandidateTrace(manifest, context);
  const defaultMap = findDefaultMap(manifest);
  const currentFieldPath = normalizePath(context.currentDrillPath);
  const currentValuePath = normalizePath(context.currentDrillValuePath);

  const finish = (
    map: DrillMapCandidateMap | null,
    reason: DrillMapResolutionReason,
    extraWarnings: string[] = []
  ): DrillMapResolutionTrace => {
    const selectedMapId = map?.mapId || null;
    warnings.push(...extraWarnings);
    selectTrace(candidates, selectedMapId, reason);
    return {
      map,
      mapId: selectedMapId,
      reason,
      candidates,
      warnings
    };
  };

  if (!options.enabled) {
    return finish(options.fallbackToDefaultMap ? defaultMap : null, options.fallbackToDefaultMap ? "default" : "none");
  }

  if (context.currentLevel === 0 && defaultMap && hasSvg(defaultMap)) {
    return finish(defaultMap, "default");
  }

  const pending = context.pendingDrillSource;
  if (pending?.targetMapId && isPendingSourceForAdvancedLevel(context)) {
    const overrideMap = manifest.maps.find((map) => map.mapId === pending.targetMapId) || null;
    if (overrideMap && hasSvg(overrideMap)) {
      return finish(overrideMap, "areaOverride");
    }
    warnings.push(
      overrideMap
        ? `Override da area ${pending.sourceAreaId} aponta para mapa sem SVG: ${pending.targetMapId}.`
        : `Override da area ${pending.sourceAreaId} aponta para mapa inexistente: ${pending.targetMapId}.`
    );
  }

  const valuePathMatches = manifest.maps.filter((map) => {
    if (!hasSvg(map)) return false;
    const mapPath = normalizePath(map.drillPath);
    if (mapPath.length === 0 || currentValuePath.length === 0 || mapPath.length !== currentValuePath.length) return false;
    return mapPath.every((part, index) => part === currentValuePath[index]);
  });
  if (valuePathMatches.length > 0) {
    return finish(
      valuePathMatches[0],
      "drillPath",
      valuePathMatches.length > 1
        ? [`Mais de um mapa corresponde ao drillPath de valores atual; usando ${valuePathMatches[0].mapId}.`]
        : []
    );
  }

  const exactPathMatches = manifest.maps.filter((map) => {
    if (!hasSvg(map)) return false;
    const mapPath = normalizePath(map.drillPath);
    if (mapPath.length === 0 || mapPath.length !== currentFieldPath.length) return false;
    return mapPath.every((part, index) => part === currentFieldPath[index]);
  });
  if (exactPathMatches.length > 0) {
    return finish(
      exactPathMatches[0],
      "drillPath",
      exactPathMatches.length > 1
        ? [`Mais de um mapa corresponde ao drillPath atual; usando ${exactPathMatches[0].mapId}.`]
        : []
    );
  }

  const previousMapId = context.previousMapId || "";
  if (previousMapId && context.currentLevel > 0) {
    const parentEdgeMatches = manifest.maps
      .filter((map) => {
        if (!hasSvg(map) || map.mapId === previousMapId) return false;
        return Object.values(map.areas || {}).some((area) => area?.drillToMapId === previousMapId);
      })
      .map((map) => ({
        map,
        score: context.categoryMatchScores?.[map.mapId]?.score ?? 0
      }))
      .sort((a, b) => b.score - a.score);

    if (parentEdgeMatches.length === 1) {
      return finish(parentEdgeMatches[0].map, "parentEdge");
    }
    if (parentEdgeMatches.length > 1) {
      const best = parentEdgeMatches[0];
      const second = parentEdgeMatches[1];
      if (best.score > 0 && best.score > second.score) {
        return finish(
          best.map,
          "parentEdge",
          [`Drill up encontrou multiplos mapas pai para ${previousMapId}; usando ${best.map.mapId} por correspondencia com os dados atuais.`]
        );
      }
      return finish(
        parentEdgeMatches[0].map,
        "parentEdge",
        [`Drill up encontrou multiplos mapas pai para ${previousMapId}; usando ${parentEdgeMatches[0].map.mapId}.`]
      );
    }
  }

  if (context.requireExplicitDrillPath) {
    return finish(null, "none", [
      "Nenhum mapa configurado explicitamente para o drillPath atual; fallback por nivel/automatch foi bloqueado."
    ]);
  }

  const levelMatches = manifest.maps.filter(
    (map) => hasSvg(map) && Number.isFinite(map.level) && Number(map.level) === context.currentLevel
  );
  if (levelMatches.length === 1) {
    return finish(levelMatches[0], "level");
  }
  if (levelMatches.length > 1) {
    const ranked = levelMatches
      .map((map) => ({
        map,
        score: context.categoryMatchScores?.[map.mapId]?.score ?? 0
      }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const second = ranked[1];
    if (best && best.score > 0 && (!second || best.score > second.score)) {
      return finish(
        best.map,
        "automatch",
        [`Nivel ${context.currentLevel} tinha multiplos mapas; usando ${best.map.mapId} por correspondencia com os IDs dos dados atuais.`]
      );
    }
    return finish(
      levelMatches[0],
      "level",
      [`Mais de um mapa corresponde ao nivel ${context.currentLevel}; sem desempate por dados, usando ${levelMatches[0].mapId}.`]
    );
  }

  const autoMatch = manifest.maps
    .filter((map) => hasSvg(map))
    .map((map) => ({ map, score: context.categoryMatchScores?.[map.mapId]?.score ?? 0 }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  if (autoMatch) {
    return finish(autoMatch.map, "automatch");
  }

  if (options.fallbackToDefaultMap && defaultMap) {
    return finish(defaultMap, "default");
  }

  return finish(null, "none");
}

export function validateMapRegistryManifestIssues(manifest: DrillMapManifestLike): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenMapIds = new Set<string>();

  for (const map of manifest.maps) {
    const normalizedMapId = norm(map.mapId);
    if (!normalizedMapId) {
      issues.push({ severity: "error", code: "MAP_ID_EMPTY", message: "Mapa com mapId vazio." });
      continue;
    }
    if (seenMapIds.has(normalizedMapId)) {
      issues.push({
        severity: "error",
        code: "MAP_ID_DUPLICATE",
        message: `mapId duplicado: ${map.mapId}`,
        mapId: map.mapId
      });
    }
    seenMapIds.add(normalizedMapId);
    if (!hasSvg(map)) {
      issues.push({
        severity: "warning",
        code: "MAP_WITHOUT_SVG",
        message: `Mapa sem SVG: ${map.mapId}`,
        mapId: map.mapId
      });
    }

    const svgAreaIds = extractSvgAreaIds(map.svgText);
    const areaSeen = new Set<string>();
    for (const [areaId, area] of Object.entries(map.areas || {})) {
      const effectiveId = (area as any).virtualId || (area as any).id || areaId;
      const normalizedArea = norm(effectiveId);
      if (!normalizedArea) {
        issues.push({
          severity: "error",
          code: "AREA_ID_EMPTY",
          message: `area com ID vazio em ${map.mapId}`,
          mapId: map.mapId,
          areaId
        });
      }
      if (areaSeen.has(normalizedArea)) {
        issues.push({
          severity: "error",
          code: "AREA_ID_DUPLICATE",
          message: `area duplicada em ${map.mapId}: ${effectiveId}`,
          mapId: map.mapId,
          areaId
        });
      }
      areaSeen.add(normalizedArea);
      if (normalizedArea && svgAreaIds.size > 0 && !svgAreaIds.has(normalizedArea)) {
        issues.push({
          severity: "warning",
          code: "AREA_NOT_IN_SVG",
          message: `area ${effectiveId} nao foi encontrada no SVG do mapa ${map.mapId}.`,
          mapId: map.mapId,
          areaId
        });
      }
      if (area.drillToMapId) {
        const targetMap = manifest.maps.find((candidate) => candidate.mapId === area.drillToMapId);
        if (area.drillToMapId === map.mapId) {
          issues.push({
            severity: "warning",
            code: "AREA_DRILL_TARGET_SELF",
            message: `area ${areaId} aponta para o proprio mapa: ${area.drillToMapId}`,
            mapId: map.mapId,
            areaId
          });
        } else if (!targetMap) {
          issues.push({
            severity: "warning",
            code: "AREA_DRILL_TARGET_MISSING",
            message: `area ${areaId} aponta para mapa inexistente: ${area.drillToMapId}`,
            mapId: map.mapId,
            areaId
          });
        } else if (!hasSvg(targetMap)) {
          issues.push({
            severity: "warning",
            code: "AREA_DRILL_TARGET_WITHOUT_SVG",
            message: `area ${areaId} aponta para mapa sem SVG: ${area.drillToMapId}`,
            mapId: map.mapId,
            areaId
          });
        }
      }
    }
  }

  issues.push(...validateDrillMapGraphIssues(manifest));

  const levelGroups = new Map<number, string[]>();
  const pathGroups = new Map<string, string[]>();
  for (const map of manifest.maps) {
    if (Number.isFinite(map.level)) {
      const level = Number(map.level);
      levelGroups.set(level, [...(levelGroups.get(level) || []), map.mapId]);
    }
    const path = normalizePath(map.drillPath);
    if (path.length > 0) {
      const key = path.join(" > ");
      pathGroups.set(key, [...(pathGroups.get(key) || []), map.mapId]);
      if (Number.isFinite(map.level) && Number(map.level) !== path.length - 1) {
        issues.push({
          severity: "warning",
          code: "MAP_LEVEL_PATH_CONFLICT",
          message: `Mapa ${map.mapId} tem nivel ${map.level}, mas drillPath indica nivel ${path.length - 1}.`,
          mapId: map.mapId
        });
      }
    }
  }

  levelGroups.forEach((ids, level) => {
    if (ids.length > 1) {
      issues.push({
        severity: "warning",
        code: "LEVEL_AMBIGUOUS",
        message: `Nivel ${level} tem multiplos mapas associados: ${ids.join(", ")}.`
      });
    }
  });
  pathGroups.forEach((ids, path) => {
    if (ids.length > 1) {
      issues.push({
        severity: "warning",
        code: "DRILL_PATH_AMBIGUOUS",
        message: `Drill path '${path}' tem multiplos mapas associados: ${ids.join(", ")}.`
      });
    }
  });

  return issues;
}
