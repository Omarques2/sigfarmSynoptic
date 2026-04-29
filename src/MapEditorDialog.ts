import powerbi from "powerbi-visuals-api";

import DialogAction = powerbi.DialogAction;
import DialogConstructorOptions = powerbi.extensibility.visual.DialogConstructorOptions;

type DrillMode = "manual" | "automatic" | "none";

type MapRegistryArea = {
  id?: string;
  virtualId?: string;
  bindKey?: string;
  displayName?: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
  drillToMapId?: string;
  drillMode?: DrillMode;
  labelAnchor?: { x: number; y: number };
  labelMode?: string;
  calloutSide?: "left" | "right" | "top" | "bottom" | "auto";
  calloutOffsetX?: number;
  calloutOffsetY?: number;
  hidden?: boolean;
};

type MapRegistryMap = {
  mapId: string;
  name?: string;
  svgText?: string;
  drillPath?: string[];
  level?: number;
  areas?: Record<string, MapRegistryArea>;
};

type MapRegistryManifest = {
  schemaVersion: number;
  defaultMapId?: string;
  maps: MapRegistryMap[];
};

type LabelOverride = {
  mode?: string;
  anchor?: { x: number; y: number };
  calloutSide?: "left" | "right" | "top" | "bottom" | "auto";
  calloutOffsetX?: number;
  calloutOffsetY?: number;
  textAlign?: "Left" | "Center" | "Right";
  hidden?: boolean;
};

type LabelOverridesManifest = {
  schemaVersion: number;
  maps?: Record<string, Record<string, LabelOverride>>;
};

type EditorViewMode = "browser" | "detail";
type EditorInspectorTab = "General" | "Drill";
type DrillPathScreen = "preview" | "config";

type DialogRowLabel = {
  rawKey?: string;
  legendRawKey?: string;
  displayName?: string;
};

type DialogDrillCandidate = {
  mapId: string;
  name?: string;
  hasSvg: boolean;
  level?: number;
  drillPath?: string[];
  autoMatchScore: number;
  autoMatchCategoryName?: string | null;
  status: "selected" | "candidate" | "ignored";
  reason?: string;
  warnings?: string[];
};

type DialogDrillContext = {
  currentDrillPath: string[];
  currentLevel: number;
  categoryFieldNames: string[];
  activeCategoryQueryName?: string | null;
  resolvedMapId?: string | null;
  candidateMaps: DialogDrillCandidate[];
  resolutionReason?: string;
  warnings: string[];
};

export type MapEditorDialogInitialState = {
  manifestJson: string;
  labelOverridesJson: string;
  selectedMapId?: string | null;
  selectedAreaId?: string | null;
  viewMode?: EditorViewMode;
  areaSearch?: string;
  inspectorTab?: EditorInspectorTab;
  allowMapUploads?: boolean;
  rowsByKey?: Record<string, DialogRowLabel>;
  drillContext?: DialogDrillContext;
};

export type MapEditorDialogResult = {
  manifestJson: string;
  labelOverridesJson: string;
  selectedMapId?: string | null;
  selectedAreaId?: string | null;
  viewMode: EditorViewMode;
  areaSearch: string;
  inspectorTab: EditorInspectorTab;
  shouldPersist: boolean;
};

type EditorAreaRow = {
  areaId: string;
  row: DialogRowLabel | null;
  mapArea: MapRegistryArea;
  labelOverride: LabelOverride;
};

type DrillPathPreviewMapping = {
  areaId: string;
  svgAreaId?: string;
  areaLabel: string;
  targetMapId?: string;
  targetLabel: string;
  kind: DrillMode;
};

type DrillPathPreviewModel = {
  currentFieldLabel: string;
  resolvedMapLabel: string;
  currentLevelLabel: string;
  rootMapLabel: string;
  manualMappings: DrillPathPreviewMapping[];
  automaticMappings: DrillPathPreviewMapping[];
  noNextLevelMappings: DrillPathPreviewMapping[];
  warnings: string[];
};

type DrillGraphNodeKind =
  | "rootMap"
  | "targetMap"
  | "automaticArea"
  | "noneArea"
  | "missingTarget"
  | "cycle";

type DrillGraphEdgeKind = "manual" | "automatic" | "none" | "error";

type DrillGraphNode = {
  key: string;
  kind: DrillGraphNodeKind;
  level: number;
  label: string;
  sublabel?: string;
  mapId?: string;
  sourceMapId?: string;
  sourceAreaId?: string;
  sourceAreaLabel?: string;
  targetMapId?: string;
  pathKey: string;
  hasChildren: boolean;
  branchColor?: string;
  errorMessage?: string;
};

type DrillGraphEdge = {
  key: string;
  fromKey: string;
  toKey: string;
  kind: DrillGraphEdgeKind;
  label?: string;
  sourceMapId?: string;
  sourceAreaId?: string;
  branchColor?: string;
  errorMessage?: string;
};

type DrillGraphLevel = {
  index: number;
  label: string;
  nodes: DrillGraphNode[];
};

type DrillGraphLegendItem = {
  kind: "manual" | "automatic" | "none" | "error" | "level";
  label: string;
  levelIndex?: number;
};

type DrillPathGraphModel = {
  rootMapId: string | null;
  rootMapLabel: string;
  activeMapLabel: string;
  currentFieldLabel: string;
  levels: DrillGraphLevel[];
  nodes: DrillGraphNode[];
  edges: DrillGraphEdge[];
  visibleLegend: DrillGraphLegendItem[];
  stats: {
    manual: number;
    automatic: number;
    none: number;
    errors: number;
    maxLevel: number;
  };
  errors: string[];
  hasBlockingErrors: boolean;
};

type DrillGraphLayoutNode = DrillGraphNode & {
  x: number;
  y: number;
  dotSize: number;
  labelWidth: number;
  rowHeight: number;
  width: number;
  height: number;
  dotX: number;
  dotY: number;
  labelX: number;
  labelTitleY: number;
  labelSubtitleY: number;
  branchInX: number;
  branchInY: number;
  branchOutX: number;
  branchOutY: number;
};

type DrillLayoutTreeNode = {
  graphNode: DrillGraphLayoutNode;
  children: DrillLayoutTreeNode[];
  subtreeHeight: number;
};

type DrillGraphLayout = {
  width: number;
  height: number;
  nodes: DrillGraphLayoutNode[];
  edges: DrillGraphEdge[];
  nodeByKey: Map<string, DrillGraphLayoutNode>;
};

const DRILL_BRANCH_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#f97316",
  "#0f9488",
  "#14b8a6",
  "#6366f1",
  "#ec4899",
  "#22c55e"
];
const DRILL_NODE_LABEL_GAP = 36;
const DRILL_BRANCH_EXIT_PADDING = 10;
const DRILL_BRANCH_EXIT_MIN_WIDTH = 72;
const DRILL_BRANCH_EXIT_MAX_WIDTH = 150;

type GeometryBBox = { x: number; y: number; width: number; height: number };
type CachedSvgModel = {
  sanitizedMarkup: string;
  templateSvg: SVGSVGElement;
  areaIds: string[];
  bbox: GeometryBBox;
};

function norm(raw: any): string {
  const s = (raw ?? "").toString().trim().toLowerCase();
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stringifyManifest(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function cloneJsonObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeParseJsonObject<T>(raw: string, fallback: T): T {
  const text = (raw || "").trim();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeManifestMap(raw: any): MapRegistryMap | null {
  if (!raw || typeof raw !== "object") return null;
  const mapId = typeof raw.mapId === "string" && raw.mapId.trim() ? raw.mapId.trim() : "";
  if (!mapId) return null;
  const drillPath = Array.isArray(raw.drillPath)
    ? raw.drillPath.filter((v: unknown) => typeof v === "string" && v.trim()).map((v: string) => v.trim())
    : undefined;
  const areas =
    raw.areas && typeof raw.areas === "object" && !Array.isArray(raw.areas)
      ? (raw.areas as Record<string, MapRegistryArea>)
      : undefined;
  return {
    mapId,
    name: typeof raw.name === "string" ? raw.name : undefined,
    svgText: typeof raw.svgText === "string" ? raw.svgText : undefined,
    drillPath,
    level: Number.isFinite(raw.level) ? Number(raw.level) : undefined,
    areas
  };
}

function parseMapRegistryManifest(raw: string): MapRegistryManifest {
  const parsed = safeParseJsonObject<any>(raw, { schemaVersion: 1, maps: [] });
  const maps = Array.isArray(parsed.maps)
    ? parsed.maps.map(normalizeManifestMap).filter((m: MapRegistryMap | null): m is MapRegistryMap => !!m)
    : [];
  return {
    schemaVersion: Number.isFinite(parsed.schemaVersion) ? Number(parsed.schemaVersion) : 1,
    defaultMapId: typeof parsed.defaultMapId === "string" ? parsed.defaultMapId : undefined,
    maps
  };
}

function parseLabelOverridesManifest(raw: string): LabelOverridesManifest {
  const parsed = safeParseJsonObject<any>(raw, { schemaVersion: 1, maps: {} });
  return {
    schemaVersion: Number.isFinite(parsed.schemaVersion) ? Number(parsed.schemaVersion) : 1,
    maps: parsed.maps && typeof parsed.maps === "object" && !Array.isArray(parsed.maps) ? parsed.maps : {}
  };
}

function decodeSvgDataUri(s: string): string {
  try {
    if (!/^data:/i.test(s)) return s;
    const comma = s.indexOf(",");
    if (comma < 0) return s;
    const meta = s.substring(0, comma).toLowerCase();
    const data = s.substring(comma + 1);

    if (meta.includes(";base64")) {
      const decoded = atob(data);
      const win = window as Window & { escape?: (value: string) => string };
      return decodeURIComponent(win.escape ? win.escape(decoded) : decoded);
    }
    return decodeURIComponent(data);
  } catch {
    return s;
  }
}

type SanitizationReport = {
  removedTags: Record<string, number>;
  removedAttrs: Record<string, number>;
  removedStyleParts: number;
};

function createSanitizationReport(): SanitizationReport {
  return { removedTags: {}, removedAttrs: {}, removedStyleParts: 0 };
}

const ALLOWED_SVG_TAGS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "polygon",
  "polyline",
  "line",
  "text",
  "tspan",
  "defs",
  "clipPath",
  "mask",
  "linearGradient",
  "radialGradient",
  "stop",
  "image",
  "title",
  "desc"
]);

const ALLOWED_SVG_ATTRS = new Set([
  "id",
  "class",
  "d",
  "points",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "viewbox",
  "preserveaspectratio",
  "transform",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "font-size",
  "font-family",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "letter-spacing",
  "dx",
  "dy",
  "vector-effect",
  "gradientunits",
  "gradienttransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "clippathunits",
  "maskunits",
  "maskcontentunits",
  "xmlns",
  "xmlns:xlink",
  "href",
  "xlink:href"
]);

const URL_ATTRS = new Set(["fill", "stroke", "filter", "clip-path", "mask", "marker-start", "marker-mid", "marker-end"]);

function isUnsafeAttrValue(value: string): boolean {
  const v = value.trim();
  return /^javascript:/i.test(v) || /^data:/i.test(v);
}

function isSafeUrlRef(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v.includes("url(")) return true;
  const m = v.match(/url\(([^)]+)\)/);
  if (!m) return false;
  const ref = m[1].replace(/['"]/g, "").trim();
  return ref.startsWith("#");
}

function isSafeImageHref(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v.startsWith("data:image/")) return false;
  return !v.startsWith("data:image/svg");
}

function sanitizeStyleValue(value: string, report: SanitizationReport): string {
  const parts = value.split(";").map((p) => p.trim()).filter(Boolean);
  const safe: string[] = [];
  const urlHash = /url\(\s*#/i;
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.includes("expression(") || lower.includes("javascript:")) {
      report.removedStyleParts += 1;
      continue;
    }
    if (lower.includes("url(") && !urlHash.test(lower)) {
      report.removedStyleParts += 1;
      continue;
    }
    safe.push(part);
  }
  return safe.join("; ");
}

function sanitizeSvgElement(el: Element, report: SanitizationReport) {
  const attrs = Array.from(el.attributes);
  for (const attr of attrs) {
    const name = attr.name;
    const lower = name.toLowerCase();
    const value = attr.value || "";

    if (lower.startsWith("on")) {
      el.removeAttribute(name);
      continue;
    }
    if (lower === "href" || lower === "xlink:href") {
      const tag = el.tagName.toLowerCase();
      if (tag !== "image" || !isSafeImageHref(value)) {
        el.removeAttribute(name);
      }
      continue;
    }
    if (lower === "style") {
      const safe = sanitizeStyleValue(value, report);
      if (safe) {
        el.setAttribute(name, safe);
      } else {
        el.removeAttribute(name);
      }
      continue;
    }
    if (isUnsafeAttrValue(value)) {
      el.removeAttribute(name);
      continue;
    }
    if (URL_ATTRS.has(lower) && !isSafeUrlRef(value)) {
      el.removeAttribute(name);
      continue;
    }
    if (!ALLOWED_SVG_ATTRS.has(lower) && !lower.startsWith("data-") && !lower.startsWith("aria-")) {
      el.removeAttribute(name);
    }
  }

  const children = Array.from(el.children);
  for (const child of children) {
    const tag = child.tagName.toLowerCase();
    if (!ALLOWED_SVG_TAGS.has(tag)) {
      child.remove();
      continue;
    }
    sanitizeSvgElement(child, report);
  }
}

function sanitizeSvgDocument(doc: Document): { svg: SVGSVGElement | null } {
  const report = createSanitizationReport();
  if (doc.querySelector("parsererror")) return { svg: null };
  const svg = doc.querySelector("svg");
  if (!svg) return { svg: null };
  sanitizeSvgElement(svg, report);
  return { svg: svg as SVGSVGElement };
}

function normalizeSvgMarkup(svgTextRaw: string): string {
  return svgTextRaw
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<(path|polygon|rect|circle|ellipse|g)\b([^>]*?)\s+xmlns(:[a-zA-Z0-9_-]+)?="[^"]*"/g, "<$1$2")
    .trim();
}

function sanitizeSvgMarkup(svgTextRaw: string | undefined): string | null {
  const raw = (svgTextRaw || "").trim();
  if (!raw) return "";
  const parser = new DOMParser();
  const decoded = decodeSvgDataUri(raw);
  const parseMarkup = (markup: string): string | null => {
    const doc = parser.parseFromString(markup, "image/svg+xml");
    const { svg } = sanitizeSvgDocument(doc);
    return svg ? new XMLSerializer().serializeToString(svg) : null;
  };
  const direct = parseMarkup(decoded);
  if (direct !== null) return direct;
  return parseMarkup(normalizeSvgMarkup(decoded));
}

function getGeometryBBox(el: SVGElement | null | undefined): GeometryBBox {
  if (!el || !(el as any).getBBox) return { x: 0, y: 0, width: 0, height: 0 };
  try {
    const bbox = (el as any).getBBox();
    return {
      x: Number.isFinite(bbox?.x) ? bbox.x : 0,
      y: Number.isFinite(bbox?.y) ? bbox.y : 0,
      width: Number.isFinite(bbox?.width) ? bbox.width : 0,
      height: Number.isFinite(bbox?.height) ? bbox.height : 0
    };
  } catch {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
}

function getRegionGeometryElements(el: SVGElement): SVGElement[] {
  const tag = el.tagName.toLowerCase();
  if (tag !== "g") return [el];
  const shapes = Array.from(el.querySelectorAll<SVGElement>("path, polygon, rect, circle, ellipse"));
  if (shapes.length === 0) return [el];
  return shapes.filter((shape) => {
    const bbox = getGeometryBBox(shape);
    return bbox.width > 0 && bbox.height > 0;
  });
}

function getRegionBBox(el: SVGElement): GeometryBBox {
  const geometries = getRegionGeometryElements(el);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const geometry of geometries) {
    const bbox = getGeometryBBox(geometry);
    if (!(bbox.width > 0) || !(bbox.height > 0)) continue;
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.width);
    maxY = Math.max(maxY, bbox.y + bbox.height);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return getGeometryBBox(el);
  }
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
}

function getCombinedRegionBBox(elements: SVGElement[]): GeometryBBox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const el of elements) {
    const bbox = getRegionBBox(el);
    if (!(bbox.width > 0) || !(bbox.height > 0)) continue;
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.width);
    maxY = Math.max(maxY, bbox.y + bbox.height);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

const EDITOR_AREA_SELECTOR = "path[id], polygon[id], rect[id], circle[id], ellipse[id], g[id]";
const EDITOR_GEOMETRY_SELECTOR = "path, polygon, rect, circle, ellipse";

function isInEditorInfrastructure(el: SVGElement): boolean {
  let current: Element | null = el;
  while (current) {
    const tag = current.tagName?.toLowerCase?.();
    if (tag === "defs" || tag === "pattern" || tag === "clippath" || tag === "mask" || tag === "marker") {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

function parseSvgNumericAttr(el: Element, name: string): number | undefined {
  const raw = (el.getAttribute(name) || "").trim();
  if (!raw) return undefined;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
}

function hasEditorGeometrySignature(el: SVGElement): boolean {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "path":
      return !!(el.getAttribute("d") || "").trim();
    case "polygon":
      return !!(el.getAttribute("points") || "").trim();
    case "rect": {
      const width = parseSvgNumericAttr(el, "width");
      const height = parseSvgNumericAttr(el, "height");
      return (width === undefined || width > 0) && (height === undefined || height > 0);
    }
    case "circle": {
      const radius = parseSvgNumericAttr(el, "r");
      return radius === undefined || radius > 0;
    }
    case "ellipse": {
      const rx = parseSvgNumericAttr(el, "rx");
      const ry = parseSvgNumericAttr(el, "ry");
      return (rx === undefined || rx > 0) && (ry === undefined || ry > 0);
    }
    default:
      return false;
  }
}

function getEditorGeometryDescendants(el: ParentNode): SVGElement[] {
  return Array.from(el.querySelectorAll<SVGElement>(EDITOR_GEOMETRY_SELECTOR)).filter(
    (shape) => !isInEditorInfrastructure(shape) && hasEditorGeometrySignature(shape)
  );
}

function isEditorAreaCandidate(el: SVGElement): boolean {
  if (!el.id || isInEditorInfrastructure(el)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag !== "g") {
    return hasEditorGeometrySignature(el);
  }
  const descendantAreas = Array.from(el.querySelectorAll<SVGElement>(EDITOR_AREA_SELECTOR)).filter(
    (child) => child !== el && !isInEditorInfrastructure(child)
  );
  if (descendantAreas.length > 0) return false;
  return getEditorGeometryDescendants(el).length > 0;
}

function getEditorAreaElements(root: ParentNode): SVGElement[] {
  return Array.from(root.querySelectorAll<SVGElement>(EDITOR_AREA_SELECTOR))
    .filter((el) => isEditorAreaCandidate(el));
}

class MapEditorDialogApp {
  private readonly root: HTMLElement;
  private readonly host: powerbi.extensibility.visual.IDialogHost;
  private manifest: MapRegistryManifest;
  private labelOverrides: LabelOverridesManifest;
  private selectedMapId: string | null;
  private selectedAreaId: string | null;
  private viewMode: EditorViewMode;
  private areaSearch: string;
  private inspectorTab: EditorInspectorTab;
  private readonly rowsByKey: Record<string, DialogRowLabel>;
  private readonly drillContext: DialogDrillContext;
  private readonly allowMapUploads: boolean;
  private readonly svgModelCache = new Map<string, CachedSvgModel>();
  private statusMessage = "";
  private statusError = false;
  private drillPathEditorOpen = false;
  private drillPathScreen: DrillPathScreen = "preview";
  private drillPreviewShowOptional = false;
  private readonly drillPreviewMaxDepth = 12;
  private drillPreviewLastGraphSignature = "";
  private drillPreviewZoom = 1;
  private svgEditorOpen = false;
  private svgEditorValue = "";
  private svgEditorError = "";
  private addMapMenuOpen = false;
  private svgCreateEditorOpen = false;
  private svgCreateEditorValue = "";
  private svgCreateEditorName = "";
  private svgCreateEditorError = "";
  private openMapActionMenuId: string | null = null;
  private renamingMapId: string | null = null;
  private areaListScrollTop = 0;
  private pendingAreaSearchSelection: { start: number; end: number } | null = null;

  constructor(root: HTMLElement, host: powerbi.extensibility.visual.IDialogHost, initialState: MapEditorDialogInitialState) {
    this.root = root;
    this.host = host;
    this.manifest = parseMapRegistryManifest(initialState.manifestJson || "");
    this.labelOverrides = parseLabelOverridesManifest(initialState.labelOverridesJson || "");
    this.selectedMapId = initialState.selectedMapId || this.manifest.defaultMapId || this.manifest.maps[0]?.mapId || null;
    this.selectedAreaId = initialState.selectedAreaId || null;
    this.viewMode = initialState.viewMode === "detail" ? "detail" : "browser";
    this.areaSearch = initialState.areaSearch || "";
    this.inspectorTab = "General";
    this.allowMapUploads = !!initialState.allowMapUploads;
    this.rowsByKey = initialState.rowsByKey || {};
    this.drillContext = initialState.drillContext || {
      currentDrillPath: [],
      currentLevel: 0,
      categoryFieldNames: [],
      activeCategoryQueryName: null,
      resolvedMapId: null,
      candidateMaps: [],
      resolutionReason: "none",
      warnings: []
    };

    const doc = this.root.ownerDocument;
    doc.documentElement.style.height = "100%";
    doc.documentElement.style.overflow = "hidden";
    doc.body.style.height = "100%";
    doc.body.style.margin = "0";
    doc.body.style.overflow = "hidden";
    this.root.style.height = "100%";
    this.root.style.width = "100%";
    this.root.style.boxSizing = "border-box";
    this.root.style.overflow = "hidden";
    this.syncResult(false);
    this.render();
  }

  private getActiveMap(): MapRegistryMap {
    const selected = this.manifest.maps.find((map) => map.mapId === this.selectedMapId);
    return selected || this.manifest.maps[0] || { mapId: "default", areas: {}, svgText: "" };
  }

  private getAreaRows(activeMap: MapRegistryMap): EditorAreaRow[] {
    const areaIds = this.extractAreaIds(activeMap.svgText);
    const labelMap = this.labelOverrides.maps?.[activeMap.mapId] || {};
    return areaIds.map((areaId) => {
      const key = norm(areaId);
      const row = this.rowsByKey[key] || this.rowsByKey[norm(activeMap.areas?.[areaId]?.bindKey || "")] || null;
      return {
        areaId,
        row,
        mapArea: activeMap.areas?.[areaId] || {},
        labelOverride: labelMap[areaId] || {}
      };
    });
  }

  private ensureMapCollections(activeMap: MapRegistryMap): void {
    activeMap.areas = activeMap.areas || {};
    this.labelOverrides.maps = this.labelOverrides.maps || {};
    this.labelOverrides.maps[activeMap.mapId] = this.labelOverrides.maps[activeMap.mapId] || {};
  }

  private buildResult(shouldPersist: boolean): MapEditorDialogResult {
    return {
      manifestJson: stringifyManifest(this.manifest),
      labelOverridesJson: stringifyManifest(this.labelOverrides),
      selectedMapId: this.selectedMapId,
      selectedAreaId: this.selectedAreaId,
      viewMode: this.viewMode,
      areaSearch: this.areaSearch,
      inspectorTab: this.inspectorTab,
      shouldPersist
    };
  }

  private syncResult(shouldPersist: boolean): void {
    this.host.setResult(this.buildResult(shouldPersist));
  }

  private closeWithPersist(shell: HTMLElement): void {
    this.applyCurrentInputs(shell);
    this.host.close(DialogAction.Close, this.buildResult(true));
  }

  private setStatus(message: string, isError: boolean = false): void {
    this.statusMessage = message;
    this.statusError = isError;
  }

  private restoreTransientFocus(): void {
    if (!this.pendingAreaSearchSelection) return;
    const target =
      this.root.querySelector<HTMLInputElement>("[data-editor-area-search='1']") ||
      this.root.querySelector<HTMLInputElement>("[data-drill-config-search='1']");
    if (!target) return;
    const selection = this.pendingAreaSearchSelection;
    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(selection.start, selection.end);
    });
    this.pendingAreaSearchSelection = null;
  }

  private createIcon(name: "add" | "minus" | "edit" | "delete" | "map" | "search" | "export" | "metadata" | "svg" | "back" | "close" | "overflow" | "eye"): HTMLElement {
    const ns = "http://www.w3.org/2000/svg";
    const span = document.createElement("span");
    span.className = `sp-editor-icon sp-editor-icon--${name}`;
    span.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    const line = (...coords: string[]) => {
      const node = document.createElementNS(ns, "path");
      node.setAttribute("d", coords.join(" "));
      svg.appendChild(node);
    };
    switch (name) {
      case "add":
        line("M10 4v12", "M4 10h12");
        break;
      case "minus":
        line("M4 10h12");
        break;
      case "edit":
        line("M4 14.5V16h1.5L14.8 6.7l-1.5-1.5L4 14.5z", "M11.9 4.1l1.5 1.5");
        break;
      case "delete":
        line("M4.5 6h11", "M8 6V4.8h4V6", "M6.5 6l.8 9h5.4l.8-9");
        break;
      case "map":
        line("M3.5 5.5l4-1.5 5 1.5 4-1.5v10l-4 1.5-5-1.5-4 1.5v-10z", "M7.5 4v10", "M12.5 5.5v10");
        break;
      case "search":
        line("M8.5 13.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10z", "M12.2 12.2L16 16");
        break;
      case "export":
        line("M10 3.5v8.5", "M6.8 9.2L10 12.4l3.2-3.2", "M4.5 15.5h11");
        break;
      case "metadata":
        line("M5 4.5h10", "M5 8.5h10", "M5 12.5h10", "M5 16h6");
        break;
      case "svg":
        line("M6 5.5L3.5 10 6 14.5", "M14 5.5L16.5 10 14 14.5", "M11.5 4l-3 12");
        break;
      case "back":
        line("M12.5 4.5L7 10l5.5 5.5", "M7.5 10H16");
        break;
      case "close":
        line("M5 5l10 10", "M15 5L5 15");
        break;
      case "overflow":
        line("M10 5h.01", "M10 10h.01", "M10 15h.01");
        break;
      case "eye":
        line("M2.5 10s2.7-4.5 7.5-4.5 7.5 4.5 7.5 4.5-2.7 4.5-7.5 4.5S2.5 10 2.5 10z", "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z");
        break;
    }
    span.appendChild(svg);
    return span;
  }

  private createButton(
    label: string,
    icon: Parameters<MapEditorDialogApp["createIcon"]>[0],
    options?: {
      kind?: "primary" | "secondary" | "ghost" | "danger";
      iconOnly?: boolean;
      compact?: boolean;
      noIcon?: boolean;
      ariaLabel?: string
    }
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "sp-editor-btn",
      `is-${options?.kind || "secondary"}`,
      options?.iconOnly ? "is-icon-only" : "",
      options?.compact ? "is-compact" : ""
    ]
      .filter(Boolean)
      .join(" ");
    if (!options?.noIcon) {
      button.appendChild(this.createIcon(icon));
    }
    if (!options?.iconOnly) {
      const text = document.createElement("span");
      text.textContent = label;
      button.appendChild(text);
    }
    button.setAttribute("aria-label", options?.ariaLabel || label);
    return button;
  }

  private parseOptionalNumber(raw: string | undefined): number | undefined {
    const text = (raw || "").trim();
    if (!text) return undefined;
    const value = Number(text);
    return Number.isFinite(value) ? value : undefined;
  }

  private getCachedSvgModel(svgTextRaw: string | undefined): CachedSvgModel | null {
    const raw = (svgTextRaw || "").trim();
    if (!raw) return null;
    const cached = this.svgModelCache.get(raw);
    if (cached) return cached;
    const parser = new DOMParser();
    const doc = parser.parseFromString(decodeSvgDataUri(raw), "image/svg+xml");
    const { svg } = sanitizeSvgDocument(doc);
    if (!svg) return null;
    const areaEls = getEditorAreaElements(svg);
    const bbox = getCombinedRegionBBox(areaEls);
    const sanitizedMarkup = new XMLSerializer().serializeToString(svg);
    const model: CachedSvgModel = {
      sanitizedMarkup,
      templateSvg: svg.cloneNode(true) as SVGSVGElement,
      areaIds: areaEls.map((el) => (el as any).id as string).filter((id) => !!id),
      bbox
    };
    this.svgModelCache.set(raw, model);
    return model;
  }

  private extractAreaIds(svgTextRaw: string | undefined): string[] {
    return this.getCachedSvgModel(svgTextRaw)?.areaIds.slice() || [];
  }

  private findEditorAreaKeyBySvgId(activeMap: MapRegistryMap | undefined, svgAreaId: string): string {
    if (!activeMap?.areas) return svgAreaId;
    const normalizedSvgId = norm(svgAreaId);
    const direct = Object.keys(activeMap.areas).find((key) => norm(key) === normalizedSvgId);
    if (direct) return direct;

    for (const [key, area] of Object.entries(activeMap.areas)) {
      const candidates = [
        key,
        area.id,
        area.virtualId,
        area.bindKey,
        area.displayName,
        ...(Array.isArray(area.aliases) ? area.aliases : [])
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .map((value) => norm(value));

      if (candidates.includes(normalizedSvgId)) return key;
    }

    return svgAreaId;
  }

  private parseSvgViewBox(raw: string | null | undefined): GeometryBBox | null {
    const parts = String(raw || "")
      .trim()
      .split(/[\s,]+/)
      .map((part) => Number(part));
    if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
    const [x, y, width, height] = parts;
    if (!(width > 0) || !(height > 0)) return null;
    return { x, y, width, height };
  }

  private transformPreviewSvgPoint(
    svg: SVGSVGElement,
    matrix: DOMMatrix,
    x: number,
    y: number
  ): { x: number; y: number } {
    if (typeof DOMPoint !== "undefined") {
      const point = new DOMPoint(x, y).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    }
    const point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    const transformed = point.matrixTransform(matrix);
    return { x: transformed.x, y: transformed.y };
  }

  private getPreviewElementTransformedBBox(svg: SVGSVGElement, element: SVGElement): GeometryBBox {
    const raw = getGeometryBBox(element);
    if (!(raw.width > 0) || !(raw.height > 0)) return { x: 0, y: 0, width: 0, height: 0 };

    const elementMatrix = (element as SVGGraphicsElement).getCTM?.();
    if (!elementMatrix) return raw;

    let matrix = elementMatrix as DOMMatrix;
    const svgMatrix = svg.getCTM?.();
    if (svgMatrix) {
      try {
        matrix = (svgMatrix as DOMMatrix).inverse().multiply(elementMatrix as DOMMatrix);
      } catch {
        matrix = elementMatrix as DOMMatrix;
      }
    }

    const points = [
      this.transformPreviewSvgPoint(svg, matrix, raw.x, raw.y),
      this.transformPreviewSvgPoint(svg, matrix, raw.x + raw.width, raw.y),
      this.transformPreviewSvgPoint(svg, matrix, raw.x, raw.y + raw.height),
      this.transformPreviewSvgPoint(svg, matrix, raw.x + raw.width, raw.y + raw.height)
    ];
    const minX = Math.min(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxX = Math.max(...points.map((point) => point.x));
    const maxY = Math.max(...points.map((point) => point.y));
    if (![minX, minY, maxX, maxY].every(Number.isFinite)) return raw;
    return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
  }

  private getCombinedPreviewTransformedBBox(svg: SVGSVGElement, elements: SVGElement[]): GeometryBBox {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    elements.forEach((element) => {
      const bbox = this.getPreviewElementTransformedBBox(svg, element);
      if (!(bbox.width > 0) || !(bbox.height > 0)) return;
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    });

    if (![minX, minY, maxX, maxY].every(Number.isFinite) || maxX <= minX || maxY <= minY) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private createPreview(
    svgTextRaw: string | undefined,
    options: {
      activeMap?: MapRegistryMap;
      selectedAreaId?: string | null;
      interactive?: boolean;
      onSelectArea?: (areaId: string) => void;
      compact?: boolean;
    } = {}
  ): HTMLElement {
    const frame = document.createElement("div");
    frame.className = options.compact ? "sp-editor-preview is-compact" : "sp-editor-preview";
    const viewport = document.createElement("div");
    viewport.className = "sp-editor-preview-viewport";
    const stage = document.createElement("div");
    stage.className = "sp-editor-preview-stage";
    const controls = document.createElement("div");
    controls.className = "sp-editor-preview-controls";

    const raw = (svgTextRaw || "").trim();
    if (!raw) {
      const empty = document.createElement("div");
      empty.className = "sp-editor-preview-empty";
      empty.textContent = "Nenhum SVG configurado para este mapa.";
      frame.appendChild(empty);
      return frame;
    }

    const model = this.getCachedSvgModel(svgTextRaw);
    if (!model) {
      const empty = document.createElement("div");
      empty.className = "sp-editor-preview-empty";
      empty.textContent = "Nao foi possivel gerar o preview sanitizado deste SVG.";
      frame.appendChild(empty);
      return frame;
    }

    const cloned = model.templateSvg.cloneNode(true) as SVGSVGElement;
    cloned.removeAttribute("width");
    cloned.removeAttribute("height");
    cloned.setAttribute("preserveAspectRatio", "xMidYMid meet");
    cloned.style.width = "100%";
    cloned.style.height = "100%";
    cloned.style.display = "block";
    cloned.style.background = "#f6faf9";
    const sourceViewBox = model.templateSvg.getAttribute("viewBox") || cloned.getAttribute("viewBox") || "";

    const selectedKey = options.selectedAreaId ? norm(options.selectedAreaId) : null;
    const regions = getEditorAreaElements(cloned);
    for (const region of regions) {
      const svgAreaId = (region as any).id as string;
      if (!svgAreaId) continue;
      const logicalAreaId = this.findEditorAreaKeyBySvgId(options.activeMap, svgAreaId);
      const areaOverride = options.activeMap?.areas?.[logicalAreaId] || options.activeMap?.areas?.[svgAreaId];
      const isSelected = !!selectedKey && (norm(logicalAreaId) === selectedKey || norm(svgAreaId) === selectedKey);
      const hasSelection = !!selectedKey;
      region.setAttribute("data-editor-svg-area", "1");
      region.setAttribute("data-editor-svg-area-id", logicalAreaId);
      region.style.cursor = options.interactive ? "pointer" : "default";
      region.style.fill = isSelected ? "#29b6a8" : "#cde9e4";
      region.style.opacity = areaOverride?.hidden ? "0.18" : hasSelection && !isSelected ? "0.48" : "1";
      region.style.stroke = isSelected ? "#3b82f6" : "#7ca9a0";
      region.style.strokeWidth = isSelected ? "2" : "0.75";
      region.style.vectorEffect = "non-scaling-stroke";
      if (options.interactive) {
        region.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
        });
        region.addEventListener("pointerup", (event) => {
          event.stopPropagation();
        });
        region.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          options.onSelectArea?.(logicalAreaId);
        });
      }
    }

    const scheduleFit = () => {
      requestAnimationFrame(() => {
        const liveRegions = getEditorAreaElements(cloned);
        const transformedBBox = this.getCombinedPreviewTransformedBBox(cloned, liveRegions);
        const localBBox = getCombinedRegionBBox(liveRegions);
        const originalBox = this.parseSvgViewBox(sourceViewBox);
        const candidateBBox =
          transformedBBox.width > 0 && transformedBBox.height > 0
            ? transformedBBox
            : localBBox.width > 0 && localBBox.height > 0
              ? localBBox
              : originalBox;
        if (candidateBBox && candidateBBox.width > 0 && candidateBBox.height > 0) {
          const pad = Math.max(8, Math.max(candidateBBox.width, candidateBBox.height) * 0.035);
          cloned.setAttribute(
            "viewBox",
            `${candidateBBox.x - pad} ${candidateBBox.y - pad} ${candidateBBox.width + pad * 2} ${candidateBBox.height + pad * 2}`
          );
        } else if (sourceViewBox) {
          cloned.setAttribute("viewBox", sourceViewBox);
        }
      });
    };

    let scale = 1;
    let tx = 0;
    let ty = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let startTx = 0;
    let startTy = 0;
    const applyTransform = () => {
      stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    };
    const resetTransform = () => {
      scale = 1;
      tx = 0;
      ty = 0;
      applyTransform();
    };

    const zoomInBtn = this.createButton("Zoom in", "add", { kind: "secondary", iconOnly: true, ariaLabel: "Aproximar preview" });
    const zoomOutBtn = this.createButton("Zoom out", "minus", { kind: "secondary", iconOnly: true, ariaLabel: "Afastar preview" });
    const fitBtn = this.createButton("Fit", "map", { kind: "secondary", compact: true });
    zoomInBtn.addEventListener("click", () => {
      scale = clamp(scale * 1.2, 0.5, 12);
      applyTransform();
    });
    zoomOutBtn.addEventListener("click", () => {
      scale = clamp(scale / 1.2, 0.5, 12);
      applyTransform();
    });
    fitBtn.addEventListener("click", () => {
      resetTransform();
      scheduleFit();
    });
    controls.append(zoomOutBtn, zoomInBtn, fitBtn);

    viewport.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const direction = event.deltaY < 0 ? 1.12 : 1 / 1.12;
        scale = clamp(scale * direction, 0.5, 12);
        applyTransform();
      },
      { passive: false }
    );
    viewport.addEventListener("pointerdown", (event) => {
      if (options.interactive) {
        const target = event.target as Element | null;
        if (target?.closest?.("[data-editor-svg-area='1']")) return;
      }
      isPanning = true;
      startX = event.clientX;
      startY = event.clientY;
      startTx = tx;
      startTy = ty;
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-panning");
    });
    viewport.addEventListener("pointermove", (event) => {
      if (!isPanning) return;
      tx = startTx + (event.clientX - startX);
      ty = startTy + (event.clientY - startY);
      applyTransform();
    });
    const endPan = (event?: PointerEvent) => {
      if (event && viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }
      isPanning = false;
      viewport.classList.remove("is-panning");
    };
    viewport.addEventListener("pointerup", endPan);
    viewport.addEventListener("pointercancel", endPan);
    viewport.addEventListener("dblclick", () => {
      resetTransform();
      scheduleFit();
    });

    stage.appendChild(cloned);
    viewport.appendChild(stage);
    frame.append(viewport, controls);
    applyTransform();
    scheduleFit();
    return frame;
  }

  private createHiddenFileInput(accept: string, onRead: (text: string, fileName: string) => void): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      onRead(text, file.name);
      input.value = "";
    });
    return input;
  }

  private createUniqueMapId(baseRaw: string): string {
    const base = norm(baseRaw) || "mapa";
    let mapId = base;
    let suffix = 1;
    while (this.manifest.maps.some((map) => map.mapId === mapId)) {
      suffix += 1;
      mapId = `${base}_${suffix}`;
    }
    return mapId;
  }

  private createMapFromSvgText(rawSvgText: string, baseNameRaw?: string): { ok: true; mapId: string } | { ok: false; error: string } {
    const sanitizedMarkup = sanitizeSvgMarkup(rawSvgText);
    if (sanitizedMarkup === null || !sanitizedMarkup.trim()) {
      return { ok: false, error: "O SVG informado e invalido ou nao pode ser sanitizado." };
    }
    const baseName = String(baseNameRaw || "Novo mapa").replace(/\.[^/.]+$/, "").trim() || "Novo mapa";
    const mapId = this.createUniqueMapId(baseName);
    this.manifest.maps.push({
      mapId,
      name: baseName,
      svgText: "data:image/svg+xml;utf8," + encodeURIComponent(sanitizedMarkup),
      areas: {}
    });
    if (!this.manifest.defaultMapId) this.manifest.defaultMapId = mapId;
    this.selectedMapId = mapId;
    this.selectedAreaId = null;
    this.viewMode = "browser";
    this.inspectorTab = "General";
    this.openMapActionMenuId = null;
    this.renamingMapId = null;
    this.addMapMenuOpen = false;
    this.syncResult(true);
    return { ok: true, mapId };
  }

  private applyBrowserInputs(shell: HTMLElement): void {
    const activeMap = this.getActiveMap();
    const nameInput = shell.querySelector<HTMLInputElement>("[data-editor-browser-map-name='1']");
    if (nameInput) {
      activeMap.name = nameInput.value.trim() || activeMap.name;
    }

    const levelInput = shell.querySelector<HTMLInputElement>("[data-editor-browser-map-level='1']");
    if (levelInput) {
      const levelRaw = levelInput.value.trim();
      const parsedLevel = levelRaw === "" ? undefined : Number(levelRaw);
      activeMap.level = parsedLevel !== undefined && Number.isFinite(parsedLevel) ? parsedLevel : undefined;
    }

    const drillPathInput = shell.querySelector<HTMLInputElement>("[data-editor-browser-map-path='1']");
    if (drillPathInput) {
      activeMap.drillPath = drillPathInput.value
        .split(">")
        .map((part) => part.trim())
        .filter(Boolean);
    }

    const defaultInput = shell.querySelector<HTMLInputElement>("[data-editor-browser-default='1']");
    if (defaultInput) {
      if (defaultInput.checked) {
        this.manifest.defaultMapId = activeMap.mapId;
      } else if (this.manifest.defaultMapId === activeMap.mapId) {
        this.manifest.defaultMapId = this.manifest.maps[0]?.mapId;
      }
    }
  }

  private applyAreaInputs(shell: HTMLElement): void {
    const activeMap = this.getActiveMap();
    const areaId = this.selectedAreaId;
    if (!areaId) return;
    this.ensureMapCollections(activeMap);
    const area = activeMap.areas![areaId] = activeMap.areas![areaId] || {};
    area.bindKey = shell.querySelector<HTMLInputElement>("[data-editor-area-bind='1']")?.value?.trim() || undefined;
    area.displayName = shell.querySelector<HTMLInputElement>("[data-editor-area-title='1']")?.value?.trim() || undefined;
  }

  private applyCurrentInputs(shell: HTMLElement): void {
    if (this.viewMode === "detail") {
      this.applyAreaInputs(shell);
    } else {
      this.applyBrowserInputs(shell);
    }
  }

  private scrollAreaListToAreaId(areaId: string | null, rows: Array<{ areaId: string }>): void {
    if (!areaId) return;
    const index = rows.findIndex((row) => norm(row.areaId) === norm(areaId));
    if (index < 0) return;
    const rowHeight = 56;
    const visibleOffsetRows = 2;
    this.areaListScrollTop = Math.max(0, (index - visibleOffsetRows) * rowHeight);
  }

  private openDrillPathEditor(shell: HTMLElement, initialScreen: DrillPathScreen = "preview"): void {
    this.applyCurrentInputs(shell);
    this.openMapActionMenuId = null;
    this.renamingMapId = null;
    this.addMapMenuOpen = false;
    this.drillPathEditorOpen = true;
    this.drillPathScreen = initialScreen;
    this.render();
  }

  private closeDrillPathEditor(): void {
    this.drillPathEditorOpen = false;
  }

  private setDrillPathScreen(screen: DrillPathScreen): void {
    this.drillPathScreen = screen;
    this.render();
  }

  private getMapLabel(mapId?: string | null): string {
    if (!mapId) return "Nenhum";
    const map = this.manifest.maps.find((candidate) => candidate.mapId === mapId);
    return map?.name || map?.mapId || mapId;
  }

  private getDefaultPreviewRootMap(): MapRegistryMap | null {
    const defaultId = this.manifest.defaultMapId;
    if (defaultId) {
      const found = this.manifest.maps.find((map) => map.mapId === defaultId);
      if (found) return found;
    }
    return this.manifest.maps[0] || null;
  }

  private hashDrillKey(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  private getDrillBranchColor(seed: string, index = 0): string {
    const safeSeed = seed || "drill";
    return DRILL_BRANCH_COLORS[(this.hashDrillKey(safeSeed) + index) % DRILL_BRANCH_COLORS.length];
  }

  private hexToRgba(hex: string, alpha: number): string {
    const clean = (hex || "").replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((char) => `${char}${char}`).join("") : clean;
    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    if (![r, g, b].every(Number.isFinite)) return `rgba(59, 130, 246, ${alpha})`;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private getReachableDrillNodeKeys(model: DrillPathGraphModel): Set<string> {
    const root = model.nodes.find((node) => node.kind === "rootMap");
    const reachable = new Set<string>();
    if (!root) return reachable;
    const edgesByFrom = new Map<string, DrillGraphEdge[]>();
    model.edges.forEach((edge) => {
      const list = edgesByFrom.get(edge.fromKey) || [];
      list.push(edge);
      edgesByFrom.set(edge.fromKey, list);
    });
    const visit = (key: string): void => {
      if (reachable.has(key)) return;
      reachable.add(key);
      (edgesByFrom.get(key) || []).forEach((edge) => visit(edge.toKey));
    };
    visit(root.key);
    return reachable;
  }

  private normalizeDrillGraphForRender(model: DrillPathGraphModel): DrillPathGraphModel {
    const reachable = this.getReachableDrillNodeKeys(model);
    if (reachable.size === 0) return model;
    model.nodes = model.nodes.filter((node) => reachable.has(node.key));
    const nodeKeys = new Set(model.nodes.map((node) => node.key));
    model.edges = model.edges.filter((edge) => nodeKeys.has(edge.fromKey) && nodeKeys.has(edge.toKey));
    return model;
  }

  private assignDrillBranchColors(model: DrillPathGraphModel): void {
    const nodesByKey = new Map(model.nodes.map((node) => [node.key, node] as const));
    const edgesByFrom = new Map<string, DrillGraphEdge[]>();
    model.edges.forEach((edge) => {
      const list = edgesByFrom.get(edge.fromKey) || [];
      list.push(edge);
      edgesByFrom.set(edge.fromKey, list);
    });
    const root = model.nodes.find((node) => node.kind === "rootMap");
    if (!root) return;
    root.branchColor = "#0f9488";
    const rootEdges = (edgesByFrom.get(root.key) || []).filter((edge) => edge.kind === "manual");
    const propagate = (edge: DrillGraphEdge, color: string): void => {
      edge.branchColor = color;
      const node = nodesByKey.get(edge.toKey);
      if (!node) return;
      node.branchColor = color;
      (edgesByFrom.get(node.key) || []).forEach((childEdge) => {
        if (childEdge.kind === "manual") {
          propagate(childEdge, color);
          return;
        }
        if (childEdge.kind === "automatic") {
          childEdge.branchColor = "#3b82f6";
          return;
        }
        if (childEdge.kind === "none") {
          childEdge.branchColor = "#94a3b8";
          return;
        }
        childEdge.branchColor = "#dc2626";
      });
    };
    rootEdges.forEach((edge, index) => {
      const color = DRILL_BRANCH_COLORS[index % DRILL_BRANCH_COLORS.length];
      propagate(edge, color);
    });
  }

  private getDrillEdgeColor(edge: DrillGraphEdge): string {
    if (edge.kind === "manual") return edge.branchColor || "#ef4444";
    if (edge.kind === "automatic") return "#3b82f6";
    if (edge.kind === "none") return "#94a3b8";
    return "#dc2626";
  }

  private getDrillNodeBranchColor(node: DrillGraphLayoutNode | DrillGraphNode): string {
    if (node.kind === "rootMap") return "#0f9488";
    if (node.kind === "automaticArea") return "#3b82f6";
    if (node.kind === "noneArea") return "#94a3b8";
    if (node.kind === "cycle" || node.kind === "missingTarget") return "#dc2626";
    return node.branchColor || "#ef4444";
  }

  private getDrillBranchGroupColor(edges: DrillGraphEdge[], from: DrillGraphLayoutNode): string | null {
    const manualColors = edges
      .filter((edge) => edge.kind === "manual")
      .map((edge) => edge.branchColor)
      .filter((color): color is string => !!color);
    const unique = [...new Set(manualColors)];
    if (unique.length === 1) return unique[0];
    if (from.kind !== "rootMap" && from.branchColor) return from.branchColor;
    return null;
  }

  private applyDrillEdgeColor(path: SVGPathElement, edge: DrillGraphEdge, forcedColor?: string): void {
    const color = forcedColor || this.getDrillEdgeColor(edge);
    path.style.stroke = color;
    path.style.setProperty("--drill-branch-color", color);
    if (edge.kind === "manual") {
      path.style.strokeDasharray = "none";
      path.style.opacity = "1";
    }
    if (edge.kind === "automatic") {
      path.style.strokeDasharray = "4 5";
      path.style.opacity = "0.78";
    }
    if (edge.kind === "none") {
      path.style.strokeDasharray = "3 6";
      path.style.opacity = "0.75";
    }
    if (edge.kind === "error") {
      path.style.strokeDasharray = "none";
      path.style.opacity = "1";
    }
  }

  private getDrillGraphSignature(model: DrillPathGraphModel): string {
    return [
      model.rootMapId || "",
      this.drillPreviewShowOptional ? "optional" : "manual",
      model.nodes.map((node) => `${node.key}:${node.level}:${node.branchColor || ""}`).join("|"),
      model.edges.map((edge) => `${edge.key}:${edge.fromKey}:${edge.toKey}:${edge.kind}:${edge.branchColor || ""}`).join("|")
    ].join("::");
  }

  private assertDrillGraphRenderIntegrity(model: DrillPathGraphModel): void {
    const nodeKeys = new Set(model.nodes.map((node) => node.key));
    const inbound = new Map<string, number>();
    model.edges.forEach((edge) => {
      inbound.set(edge.toKey, (inbound.get(edge.toKey) || 0) + 1);
      if (!nodeKeys.has(edge.fromKey) || !nodeKeys.has(edge.toKey)) {
        model.errors.push(`Edge orfa: ${edge.fromKey} -> ${edge.toKey}`);
      }
      if (edge.kind === "manual" && !edge.branchColor) {
        model.errors.push(`Edge manual sem branchColor: ${edge.key}`);
      }
    });
    model.nodes.forEach((node) => {
      if (node.kind === "rootMap") return;
      if (!inbound.has(node.key)) model.errors.push(`Nodo sem ancestral visivel: ${node.key}`);
      if (node.kind === "targetMap" && !node.branchColor) model.errors.push(`Branch sem cor: ${node.key}`);
    });
  }

  private getDrillTextMeasureContext(): CanvasRenderingContext2D | null {
    const doc = this.root.ownerDocument;
    const canvas = doc.createElement("canvas");
    return canvas.getContext("2d");
  }

  private measureDrillTextWidth(text: string, font = "12px sans-serif", maxWidth = DRILL_BRANCH_EXIT_MAX_WIDTH): number {
    const value = String(text || "").trim();
    if (!value) return 44;
    try {
      const context = this.getDrillTextMeasureContext();
      if (context) {
        context.font = font;
        return Math.max(44, Math.min(maxWidth, context.measureText(value).width));
      }
    } catch {
      // Fall through to deterministic approximation when canvas is unavailable.
    }
    const estimated = value.length * 6.2;
    return Math.max(44, Math.min(maxWidth, estimated));
  }

  private estimateDrillTextWidth(text: string, fontSize = 12, maxWidth = DRILL_BRANCH_EXIT_MAX_WIDTH): number {
    return this.measureDrillTextWidth(text, `${fontSize}px sans-serif`, maxWidth);
  }

  private getDrillGraphNodeSubtitle(node: DrillGraphNode): string {
    if (node.kind === "rootMap") return "Mapa raiz";
    if (node.kind === "targetMap") return node.label;
    if (node.kind === "automaticArea") return "Automático";
    if (node.kind === "noneArea") return "Sem próximo nível";
    if (node.kind === "missingTarget" || node.kind === "cycle") return node.errorMessage || node.label;
    return node.sublabel || "";
  }

  private hydrateDrillLayoutAnchors(node: DrillGraphLayoutNode): DrillGraphLayoutNode {
    const labelX = node.x + DRILL_NODE_LABEL_GAP;
    const subtitle = this.getDrillGraphNodeSubtitle(node);
    const titleWidth = this.measureDrillTextWidth(node.label || "", "700 13px sans-serif", DRILL_BRANCH_EXIT_MAX_WIDTH);
    const subtitleWidth = this.measureDrillTextWidth(subtitle || "", "12px sans-serif", DRILL_BRANCH_EXIT_MAX_WIDTH);
    const visualTextWidth = Math.max(titleWidth, subtitleWidth, DRILL_BRANCH_EXIT_MIN_WIDTH);
    node.dotX = node.x;
    node.dotY = node.y;
    node.labelX = labelX;
    node.labelTitleY = node.y - 9;
    node.labelSubtitleY = node.y + 10;
    node.branchInX = node.dotX;
    node.branchInY = node.dotY;
    node.branchOutX = labelX + visualTextWidth + DRILL_BRANCH_EXIT_PADDING;
    node.branchOutY = node.labelSubtitleY;
    if (!subtitle) node.branchOutY = node.y;
    if (node.kind === "rootMap") {
      const rootWidth = this.measureDrillTextWidth(node.label || "", "700 13px sans-serif", DRILL_BRANCH_EXIT_MAX_WIDTH);
      node.branchOutX = labelX + rootWidth + 12;
      node.branchOutY = node.y;
    }
    return node;
  }

  private focusDrillConfigArea(sourceMapId: string, areaId: string): void {
    this.selectedMapId = sourceMapId;
    this.selectedAreaId = areaId;
    this.areaSearch = "";
    this.drillPathScreen = "config";
    this.render();
  }

  private focusDrillConfigMap(mapId: string): void {
    const map = this.manifest.maps.find((candidate) => candidate.mapId === mapId);
    if (!map) return;
    this.selectedMapId = map.mapId;
    this.areaSearch = "";
    const rows = this.getAreaRows(map);
    this.selectedAreaId = rows[0]?.areaId || null;
    this.drillPathScreen = "config";
    this.render();
  }

  private buildDrillPathGraphModel(): DrillPathGraphModel {
    const rootMap = this.getDefaultPreviewRootMap();
    const currentField =
      this.drillContext.activeCategoryQueryName ||
      this.drillContext.currentDrillPath[this.drillContext.currentDrillPath.length - 1] ||
      "Nao detectado";
    const model: DrillPathGraphModel = {
      rootMapId: rootMap?.mapId || null,
      rootMapLabel: rootMap?.name || rootMap?.mapId || "Nenhum mapa raiz",
      activeMapLabel: this.getMapLabel(this.selectedMapId || this.getActiveMap().mapId),
      currentFieldLabel: currentField,
      levels: [],
      nodes: [],
      edges: [],
      visibleLegend: [],
      stats: { manual: 0, automatic: 0, none: 0, errors: 0, maxLevel: 0 },
      errors: [],
      hasBlockingErrors: false
    };

    if (!rootMap) {
      model.errors.push("Nenhum mapa raiz definido.");
      model.hasBlockingErrors = true;
      return model;
    }

    const rootNode: DrillGraphNode = {
      key: `root:${rootMap.mapId}`,
      kind: "rootMap",
      level: 0,
      label: rootMap.name || rootMap.mapId,
      mapId: rootMap.mapId,
      pathKey: rootMap.mapId,
      hasChildren: false,
      branchColor: "#0f9488"
    };
    model.nodes.push(rootNode);

    const visit = (args: {
      currentMap: MapRegistryMap;
      parentNode: DrillGraphNode;
      level: number;
      pathMapIds: string[];
      pathKey: string;
      branchColor: string;
    }): void => {
      if (args.level > this.drillPreviewMaxDepth) {
        const depthNode: DrillGraphNode = {
          key: `${args.pathKey}:depth`,
          kind: "cycle",
          level: args.level,
          label: "Possivel ciclo ou hierarquia muito profunda",
          sublabel: `Limite ${this.drillPreviewMaxDepth}`,
          sourceMapId: args.currentMap.mapId,
          pathKey: `${args.pathKey}:depth`,
          hasChildren: false,
          errorMessage: `Possivel ciclo ou hierarquia muito profunda: ${args.pathMapIds.join(" -> ")}`
        };
        model.nodes.push(depthNode);
        model.edges.push({
          key: `${args.parentNode.key}->${depthNode.key}`,
          fromKey: args.parentNode.key,
          toKey: depthNode.key,
          kind: "error",
          label: args.currentMap.mapId,
          sourceMapId: args.currentMap.mapId,
          branchColor: args.branchColor,
          errorMessage: depthNode.errorMessage
        });
        model.errors.push(depthNode.errorMessage || "Possivel ciclo ou hierarquia muito profunda.");
        model.stats.errors += 1;
        model.hasBlockingErrors = true;
        return;
      }

      const rows = this.getAreaRows(args.currentMap);
      const manualRows = rows.filter((row) => !!row.mapArea.drillToMapId);
      const optionalRows = rows.filter((row) => !row.mapArea.drillToMapId);

      if (this.drillPreviewShowOptional) {
        this.appendOptionalAreaNodes({
          model,
          rows: optionalRows,
          currentMap: args.currentMap,
          parentNode: args.parentNode,
          level: args.level,
          pathKey: args.pathKey,
          branchColor: args.branchColor
        });
      }

      manualRows.forEach((row) => {
        const sourceAreaId = row.areaId;
        const sourceAreaLabel = row.mapArea.displayName || row.areaId;
        const targetMapId = row.mapArea.drillToMapId!;
        const targetMap = this.manifest.maps.find((map) => map.mapId === targetMapId);
        const edgeKey = `${args.parentNode.key}:${sourceAreaId}:${targetMapId}`;

        if (!targetMap) {
          const missingNode: DrillGraphNode = {
            key: `${edgeKey}:missing`,
            kind: "missingTarget",
            level: args.level,
            label: sourceAreaLabel,
            sublabel: `Destino ausente: ${targetMapId}`,
            mapId: args.currentMap.mapId,
            sourceMapId: args.currentMap.mapId,
            sourceAreaId,
            sourceAreaLabel,
            targetMapId,
            pathKey: `${args.pathKey}/${sourceAreaId}/${targetMapId}`,
            hasChildren: false,
            branchColor: args.branchColor,
            errorMessage: `Target ausente: ${targetMapId}`
          };
          model.nodes.push(missingNode);
          model.edges.push({
            key: `${args.parentNode.key}->${missingNode.key}`,
            fromKey: args.parentNode.key,
            toKey: missingNode.key,
            kind: "error",
            label: sourceAreaLabel,
            sourceMapId: args.currentMap.mapId,
            sourceAreaId,
            branchColor: args.branchColor,
            errorMessage: missingNode.errorMessage
          });
          model.errors.push(`Target ausente: ${args.currentMap.mapId}.${sourceAreaId} -> ${targetMapId}`);
          model.stats.errors += 1;
          model.hasBlockingErrors = true;
          return;
        }

        if (args.pathMapIds.includes(targetMapId)) {
          const cyclePath = [...args.pathMapIds, targetMapId].join(" -> ");
          const cycleNode: DrillGraphNode = {
            key: `${edgeKey}:cycle`,
            kind: "cycle",
            level: args.level,
            label: sourceAreaLabel,
            sublabel: `Ciclo: ${targetMapId}`,
            mapId: targetMapId,
            sourceMapId: args.currentMap.mapId,
            sourceAreaId,
            sourceAreaLabel,
            targetMapId,
            pathKey: `${args.pathKey}/${sourceAreaId}/${targetMapId}`,
            hasChildren: false,
            branchColor: args.branchColor,
            errorMessage: `Ciclo detectado: ${cyclePath}`
          };
          model.nodes.push(cycleNode);
          model.edges.push({
            key: `${args.parentNode.key}->${cycleNode.key}`,
            fromKey: args.parentNode.key,
            toKey: cycleNode.key,
            kind: "error",
            label: sourceAreaLabel,
            sourceMapId: args.currentMap.mapId,
            sourceAreaId,
            branchColor: args.branchColor,
            errorMessage: cycleNode.errorMessage
          });
          model.errors.push(cycleNode.errorMessage || "Ciclo detectado.");
          model.stats.errors += 1;
          model.hasBlockingErrors = true;
          return;
        }

        const targetNode: DrillGraphNode = {
          key: `${edgeKey}:target`,
          kind: "targetMap",
          level: args.level,
          label: targetMap.name || targetMap.mapId,
          sublabel: sourceAreaLabel,
          mapId: targetMap.mapId,
          sourceMapId: args.currentMap.mapId,
          sourceAreaId,
          sourceAreaLabel,
          targetMapId,
          pathKey: `${args.pathKey}/${sourceAreaId}/${targetMapId}`,
          hasChildren: false,
          branchColor: args.branchColor
        };
        model.nodes.push(targetNode);
        model.stats.manual += 1;

        const childBranchColor = args.parentNode.kind === "rootMap"
          ? this.getDrillBranchColor(targetMapId, manualRows.findIndex((candidate) => candidate.areaId === sourceAreaId))
          : args.branchColor;
        targetNode.branchColor = childBranchColor;
        targetNode.hasChildren = this.getAreaRows(targetMap).some((nextRow) => !!nextRow.mapArea.drillToMapId) ||
          (this.drillPreviewShowOptional && this.getAreaRows(targetMap).some((nextRow) => !nextRow.mapArea.drillToMapId));
        model.edges.push({
          key: `${args.parentNode.key}->${targetNode.key}`,
          fromKey: args.parentNode.key,
          toKey: targetNode.key,
          kind: "manual",
          label: sourceAreaLabel,
          sourceMapId: args.currentMap.mapId,
          sourceAreaId,
          branchColor: childBranchColor
        });
        visit({
          currentMap: targetMap,
          parentNode: targetNode,
          level: args.level + 1,
          pathMapIds: [...args.pathMapIds, targetMapId],
          pathKey: targetNode.pathKey,
          branchColor: childBranchColor
        });
      });
    };

    visit({
      currentMap: rootMap,
      parentNode: rootNode,
      level: 1,
      pathMapIds: [rootMap.mapId],
      pathKey: rootMap.mapId,
      branchColor: "#0f9488"
    });

    this.normalizeDrillGraphForRender(model);
    this.assignDrillBranchColors(model);
    this.assertDrillGraphRenderIntegrity(model);
    const normalizedLevels = new Map<number, DrillGraphNode[]>();
    model.nodes.forEach((node) => {
      const current = normalizedLevels.get(node.level) || [];
      current.push(node);
      normalizedLevels.set(node.level, current);
    });
    model.levels = [...normalizedLevels.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, nodes]) => ({
        index,
        label: index === 0 ? "MAPA RAIZ" : `NÍVEL ${index}`,
        nodes
      }));
    model.stats.maxLevel = model.levels.reduce((max, level) => Math.max(max, level.index), 0);
    model.visibleLegend = this.buildVisibleLegend(model);
    return model;
  }

  private appendOptionalAreaNodes(args: {
    model: DrillPathGraphModel;
    rows: EditorAreaRow[];
    currentMap: MapRegistryMap;
    parentNode: DrillGraphNode;
    level: number;
    pathKey: string;
    branchColor: string;
  }): void {
    args.rows.forEach((row) => {
      const kind = row.mapArea.drillMode === "none" ? "none" : "automatic";
      const sourceAreaLabel = row.mapArea.displayName || row.areaId;
      const node: DrillGraphNode = {
        key: `${args.parentNode.key}:${kind}:${row.areaId}`,
        kind: kind === "none" ? "noneArea" : "automaticArea",
        level: args.level,
        label: sourceAreaLabel,
        sublabel: kind === "none" ? "Sem próximo nível" : "Automático",
        mapId: args.currentMap.mapId,
        sourceMapId: args.currentMap.mapId,
        sourceAreaId: row.areaId,
        sourceAreaLabel,
        pathKey: `${args.pathKey}/${row.areaId}`,
        hasChildren: false,
        branchColor: kind === "automatic" ? "#3b82f6" : "#94a3b8"
      };
      args.model.nodes.push(node);
      args.model.edges.push({
        key: `${args.parentNode.key}->${node.key}`,
        fromKey: args.parentNode.key,
        toKey: node.key,
        kind,
        label: sourceAreaLabel,
        sourceMapId: args.currentMap.mapId,
        sourceAreaId: row.areaId,
        branchColor: node.branchColor
      });
      if (kind === "none") args.model.stats.none += 1;
      else args.model.stats.automatic += 1;
    });
  }

  private buildVisibleLegend(model: DrillPathGraphModel): DrillGraphLegendItem[] {
    const items: DrillGraphLegendItem[] = [];
    const hasManual = model.edges.some((edge) => edge.kind === "manual");
    const hasAutomatic = model.edges.some((edge) => edge.kind === "automatic");
    const hasNone = model.edges.some((edge) => edge.kind === "none");
    const hasErrors = model.edges.some((edge) => edge.kind === "error");
    if (hasManual) items.push({ kind: "manual", label: "Manual" });
    if (hasAutomatic) items.push({ kind: "automatic", label: "Automático" });
    if (hasNone) items.push({ kind: "none", label: "Sem próximo nível" });
    if (hasErrors) items.push({ kind: "error", label: "Erro" });
    model.levels.forEach((level) => {
      if (level.index > 0) items.push({ kind: "level", label: level.label, levelIndex: level.index });
    });
    return items;
  }

  private buildDrillLayoutTree(model: DrillPathGraphModel): DrillLayoutTreeNode | null {
    const rootNode = model.nodes.find((node) => node.kind === "rootMap");
    if (!rootNode) return null;
    const nodesByKey = new Map(model.nodes.map((node) => [node.key, node] as const));
    const edgesByFrom = new Map<string, DrillGraphEdge[]>();
    model.edges.forEach((edge) => {
      const list = edgesByFrom.get(edge.fromKey) || [];
      list.push(edge);
      edgesByFrom.set(edge.fromKey, list);
    });
    const visit = (graphNode: DrillGraphNode, pathKeys: Set<string>): DrillLayoutTreeNode => {
      const isRoot = graphNode.kind === "rootMap";
      const treeNode: DrillLayoutTreeNode = {
        graphNode: {
          ...graphNode,
          x: 0,
          y: 0,
          dotSize: isRoot ? 30 : 22,
          labelWidth: 230,
          rowHeight: 72,
          width: isRoot ? 280 : 272,
          height: 44,
          dotX: 0,
          dotY: 0,
          labelX: 0,
          labelTitleY: 0,
          labelSubtitleY: 0,
          branchInX: 0,
          branchInY: 0,
          branchOutX: 0,
          branchOutY: 0
        },
        children: [],
        subtreeHeight: 0
      };
      const childEdges = edgesByFrom.get(graphNode.key) || [];
      childEdges.forEach((edge) => {
        const child = nodesByKey.get(edge.toKey);
        if (!child || pathKeys.has(child.key)) return;
        const nextPathKeys = new Set(pathKeys);
        nextPathKeys.add(child.key);
        treeNode.children.push(visit(child, nextPathKeys));
      });
      treeNode.children.sort((a, b) => {
        const aLabel = a.graphNode.sourceAreaLabel || a.graphNode.label || "";
        const bLabel = b.graphNode.sourceAreaLabel || b.graphNode.label || "";
        const labelOrder = aLabel.localeCompare(bLabel, "pt-BR");
        if (labelOrder !== 0) return labelOrder;
        return a.graphNode.key.localeCompare(b.graphNode.key, "pt-BR");
      });
      return treeNode;
    };
    return visit(rootNode, new Set([rootNode.key]));
  }

  private measureDrillLayoutTree(node: DrillLayoutTreeNode, rowGap: number, branchGap: number): number {
    if (node.children.length === 0) {
      node.subtreeHeight = rowGap;
      return node.subtreeHeight;
    }
    const childrenHeight = node.children.reduce((sum, child, index) => {
      const childHeight = this.measureDrillLayoutTree(child, rowGap, branchGap);
      return sum + childHeight + (index > 0 ? branchGap : 0);
    }, 0);
    node.subtreeHeight = Math.max(rowGap, childrenHeight);
    return node.subtreeHeight;
  }

  private assignDrillLayoutPositions(
    node: DrillLayoutTreeNode,
    args: { levelGap: number; marginX: number; startY: number; level: number; rowGap: number; branchGap: number }
  ): void {
    node.graphNode.x = args.marginX + args.level * args.levelGap;
    if (node.children.length === 0) {
      node.graphNode.y = args.startY + args.rowGap / 2;
      return;
    }
    let childStartY = args.startY;
    node.children.forEach((child, index) => {
      if (index > 0) childStartY += args.branchGap;
      this.assignDrillLayoutPositions(child, {
        levelGap: args.levelGap,
        marginX: args.marginX,
        startY: childStartY,
        level: args.level + 1,
        rowGap: args.rowGap,
        branchGap: args.branchGap
      });
      childStartY += child.subtreeHeight;
    });
    const firstChild = node.children[0].graphNode;
    const lastChild = node.children[node.children.length - 1].graphNode;
    node.graphNode.y = node.graphNode.kind === "rootMap" ? firstChild.y : (firstChild.y + lastChild.y) / 2;
  }

  private flattenDrillLayoutTree(node: DrillLayoutTreeNode, acc: DrillGraphLayoutNode[] = []): DrillGraphLayoutNode[] {
    acc.push(node.graphNode);
    node.children.forEach((child) => this.flattenDrillLayoutTree(child, acc));
    return acc;
  }

  private layoutDrillGraph(model: DrillPathGraphModel): DrillGraphLayout {
    const levelGap = 390;
    const rowGap = 60;
    const dotSize = 22;
    const labelWidth = 230;
    const nodeHeight = 38;
    const marginX = 36;
    const marginY = 42;
    const branchGap = 18;
    const tree = this.buildDrillLayoutTree(model);
    if (!tree) {
      return {
        width: 640,
        height: 360,
        nodes: [],
        edges: model.edges,
        nodeByKey: new Map<string, DrillGraphLayoutNode>()
      };
    }
    this.measureDrillLayoutTree(tree, rowGap, branchGap);
    this.assignDrillLayoutPositions(tree, { levelGap, marginX, startY: marginY, level: 0, rowGap, branchGap });
    const layoutNodes = this.flattenDrillLayoutTree(tree).map((node) =>
      this.hydrateDrillLayoutAnchors({
        ...node,
        dotSize: node.kind === "rootMap" ? node.dotSize : dotSize,
        labelWidth,
        rowHeight: nodeHeight,
        width: node.dotSize + 10 + labelWidth,
        height: nodeHeight
      })
    );
    const nodeByKey = new Map(layoutNodes.map((node) => [node.key, node] as const));
    const maxY = layoutNodes.reduce((max, node) => Math.max(max, node.y), 0);
    const maxX = layoutNodes.reduce(
      (max, node) => Math.max(max, node.x, node.branchOutX || node.x, (node.labelX || node.x) + node.labelWidth + 80),
      0
    );
    const width = Math.max(900, maxX + marginX + 160);
    const height = Math.max(420, maxY + marginY + 80);
    return { width, height, nodes: layoutNodes, edges: model.edges, nodeByKey };
  }

  private getGraphNodeClass(node: DrillGraphNode): string {
    const classes = ["sp-editor-drill-graph-node"];
    if (node.kind === "rootMap") classes.push("is-root");
    if (node.kind === "automaticArea") classes.push("is-automatic");
    if (node.kind === "noneArea") classes.push("is-none");
    if (node.kind === "missingTarget" || node.kind === "cycle") classes.push("is-error");
    if (node.sourceMapId && node.sourceAreaId) classes.push("is-clickable");
    return classes.join(" ");
  }

  private renderDrillGraphNode(node: DrillGraphLayoutNode): HTMLElement {
    const el = document.createElement("div");
    el.className = `${this.getGraphNodeClass(node)} sp-editor-drill-branch-node`;
    el.style.left = `${Math.round(node.x - node.dotSize / 2)}px`;
    el.style.top = `${Math.round(node.y)}px`;
    const color = this.getDrillNodeBranchColor(node);
    el.style.setProperty("--drill-branch-color", color);
    el.style.setProperty("--drill-branch-halo", this.hexToRgba(color, 0.16));
    if (node.sourceMapId && node.sourceAreaId) {
      el.addEventListener("click", () => this.focusDrillConfigArea(node.sourceMapId!, node.sourceAreaId!));
    }

    const dot = document.createElement("span");
    dot.className = "sp-editor-drill-branch-dot";
    const label = document.createElement("span");
    label.className = "sp-editor-drill-branch-label";
    const title = document.createElement("strong");
    const sub = document.createElement("span");

    if (node.kind === "rootMap") {
      title.textContent = node.label;
      sub.textContent = this.getDrillGraphNodeSubtitle(node);
    } else if (node.kind === "targetMap") {
      title.textContent = `${node.sourceAreaLabel || node.label} →`;
      sub.textContent = this.getDrillGraphNodeSubtitle(node);
    } else if (node.kind === "automaticArea") {
      title.textContent = node.label;
      sub.textContent = this.getDrillGraphNodeSubtitle(node);
    } else if (node.kind === "noneArea") {
      title.textContent = node.label;
      sub.textContent = this.getDrillGraphNodeSubtitle(node);
    } else if (node.kind === "missingTarget" || node.kind === "cycle") {
      title.textContent = "Erro no drill";
      sub.textContent = this.getDrillGraphNodeSubtitle(node);
    } else {
      title.textContent = node.label;
      sub.textContent = node.sublabel || "";
    }

    label.append(title, sub);
    if (node.kind === "rootMap" && node.mapId) {
      title.classList.add("sp-editor-drill-branch-map-link");
      title.addEventListener("click", (event) => {
        event.stopPropagation();
        this.focusDrillConfigMap(node.mapId!);
      });
    }
    if (node.kind === "targetMap" && node.targetMapId) {
      sub.classList.add("sp-editor-drill-branch-map-link");
      sub.addEventListener("click", (event) => {
        event.stopPropagation();
        this.focusDrillConfigMap(node.targetMapId!);
      });
    }
    el.append(dot, label);
    return el;
  }

  private renderDrillGraphEdge(edge: DrillGraphEdge, layout: DrillGraphLayout): SVGPathElement | null {
    const from = layout.nodeByKey.get(edge.fromKey);
    const to = layout.nodeByKey.get(edge.toKey);
    if (!from || !to) return null;
    const path = this.createDrillEdgePath(edge);
    path.setAttribute(
      "d",
      this.buildRoundedOrthogonalPath({
        fromX: from.branchOutX || from.x,
        fromY: from.branchOutY || from.y,
        toX: to.branchInX || to.x,
        toY: to.branchInY || to.y,
        cornerRadius: 14
      })
    );
    return path;
  }

  private renderDrillGraphEdgeLabel(edge: DrillGraphEdge, layout: DrillGraphLayout): HTMLElement | null {
    if (edge.kind === "manual") return null;
    if (edge.kind !== "error") return null;
    const from = layout.nodeByKey.get(edge.fromKey);
    const to = layout.nodeByKey.get(edge.toKey);
    if (!from || !to || !edge.label) return null;
    const label = document.createElement("button");
    label.type = "button";
    label.className = "sp-editor-drill-edge-label";
    label.textContent = edge.label;
    label.style.left = `${Math.round((from.x + from.width + to.x) / 2)}px`;
    label.style.top = `${Math.round((from.y + to.y) / 2 - 12)}px`;
    if (edge.sourceMapId && edge.sourceAreaId) {
      label.addEventListener("click", () => this.focusDrillConfigArea(edge.sourceMapId!, edge.sourceAreaId!));
    }
    return label;
  }

  private renderDrillGraphLevelMarkers(layout: DrillGraphLayout, model: DrillPathGraphModel): HTMLElement {
    void model;
    const markers = document.createElement("div");
    markers.className = "sp-editor-drill-level-markers";
    const levels = [...new Set(layout.nodes.map((node) => node.level))].sort((a, b) => a - b);
    levels.forEach((levelIndex) => {
      const firstNode = layout.nodes.find((node) => node.level === levelIndex);
      if (!firstNode) return;
      const marker = document.createElement("div");
      marker.className = "sp-editor-drill-level-marker";
      marker.dataset.levelIndex = String(levelIndex);
      marker.textContent = levelIndex === 0 ? "MAPA RAIZ" : `NÍVEL ${levelIndex}`;
      marker.style.left = `${Math.max(0, this.getDrillLevelMarkerX(layout, levelIndex))}px`;
      markers.appendChild(marker);
    });
    return markers;
  }

  private getDrillLevelMarkerX(layout: DrillGraphLayout, levelIndex: number): number {
    const nodes = layout.nodes.filter((node) => node.level === levelIndex);
    if (nodes.length === 0) return 0;
    return Math.min(...nodes.map((node) => node.x));
  }

  private updateDrillLevelHeaderPositions(args: {
    headerInner: HTMLElement;
    layout: DrillGraphLayout;
    flowViewport: HTMLElement;
    scale: number;
  }): void {
    const markers = Array.from(args.headerInner.querySelectorAll<HTMLElement>(".sp-editor-drill-level-marker"));
    markers.forEach((marker) => {
      const levelIndex = Number(marker.dataset.levelIndex || "0");
      const scaledX = this.getDrillLevelMarkerX(args.layout, levelIndex) * args.scale;
      const visibleX = args.flowViewport.scrollLeft + 10;
      marker.style.left = `${Math.round(Math.max(scaledX, visibleX))}px`;
    });
    args.headerInner.style.width = `${Math.round(args.layout.width * args.scale)}px`;
    args.headerInner.style.transform = `translateX(${-args.flowViewport.scrollLeft}px)`;
  }

  private buildRoundedOrthogonalPath(args: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    cornerRadius?: number;
    elbowX?: number;
  }): string {
    const { fromX, fromY, toX, toY } = args;
    const radius = args.cornerRadius ?? 18;
    if (Math.abs(toY - fromY) < 2) {
      return `M ${fromX} ${fromY} H ${toX}`;
    }
    const distanceX = Math.max(1, toX - fromX);
    const rawElbowX = Number.isFinite(args.elbowX)
      ? Number(args.elbowX)
      : fromX + Math.min(120, Math.max(42, distanceX * 0.36));
    const elbowX = Math.max(fromX + 24, Math.min(rawElbowX, toX - 24));
    const dirY = toY > fromY ? 1 : -1;
    const beforeCorner = Math.abs(elbowX - fromX);
    const afterCorner = Math.abs(toX - elbowX);
    const vertical = Math.abs(toY - fromY);
    const r = Math.max(
      0,
      Math.min(radius, beforeCorner * 0.7, afterCorner * 0.7, vertical / 2)
    );
    if (r < 3) {
      return `M ${fromX} ${fromY} H ${elbowX} V ${toY} H ${toX}`;
    }
    return [
      `M ${fromX} ${fromY}`,
      `H ${elbowX - r}`,
      `Q ${elbowX} ${fromY} ${elbowX} ${fromY + dirY * r}`,
      `V ${toY - dirY * r}`,
      `Q ${elbowX} ${toY} ${elbowX + r} ${toY}`,
      `H ${toX}`
    ].join(" ");
  }

  private buildOrthogonalConnectorPath(args: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    cornerRadius?: number;
    trunkX?: number;
  }): string {
    return this.buildRoundedOrthogonalPath({
      fromX: args.fromX,
      fromY: args.fromY,
      toX: args.toX,
      toY: args.toY,
      cornerRadius: args.cornerRadius ?? 18,
      elbowX: args.trunkX
    });
  }

  private buildRoundedSpineEntryPath(args: {
    fromX: number;
    fromY: number;
    trunkX: number;
    attachY: number;
    cornerRadius?: number;
  }): string {
    return this.buildRoundedOrthogonalPath({
      fromX: args.fromX,
      fromY: args.fromY,
      toX: args.trunkX,
      toY: args.attachY,
      cornerRadius: args.cornerRadius ?? 14,
      elbowX: Math.round((args.fromX + args.trunkX) / 2)
    });
  }

  private buildRoundedSpineOutletPath(args: {
    trunkX: number;
    fromY: number;
    toX: number;
    toY: number;
    cornerRadius?: number;
  }): string {
    return this.buildRoundedOrthogonalPath({
      fromX: args.trunkX,
      fromY: args.fromY,
      toX: args.toX,
      toY: args.toY,
      cornerRadius: args.cornerRadius ?? 12,
      elbowX: args.trunkX + 34
    });
  }

  private getDrillBranchElbowX(args: {
    fromX: number;
    firstChildX: number;
    preferredOffset?: number;
    minOffset?: number;
    minDistanceToChild?: number;
  }): number {
    const preferredOffset = args.preferredOffset ?? 42;
    const minOffset = args.minOffset ?? 28;
    const minDistanceToChild = args.minDistanceToChild ?? 58;
    const desired = args.fromX + preferredOffset;
    const max = args.firstChildX - minDistanceToChild;
    return Math.max(args.fromX + minOffset, Math.min(desired, max));
  }

  private buildRoundedForkPath(args: {
    fromX: number;
    fromY: number;
    elbowX: number;
    childPoints: Array<{ x: number; y: number }>;
    cornerRadius?: number;
  }): string {
    const radius = args.cornerRadius ?? 18;
    const sorted = [...args.childPoints].sort((a, b) => a.y - b.y);
    if (sorted.length === 0) return "";
    return sorted
      .map((child) => this.buildRoundedOrthogonalPath({
        fromX: args.fromX,
        fromY: args.fromY,
        toX: child.x,
        toY: child.y,
        cornerRadius: radius,
        elbowX: args.elbowX
      }))
      .join(" ");
  }

  private buildRoundedForkStemPath(args: {
    fromX: number;
    fromY: number;
    elbowX: number;
    junctionY: number;
    cornerRadius?: number;
  }): string {
    return this.buildRoundedOrthogonalPath({
      fromX: args.fromX,
      fromY: args.fromY,
      toX: args.elbowX,
      toY: args.junctionY,
      cornerRadius: args.cornerRadius ?? 18,
      elbowX: Math.round((args.fromX + args.elbowX) / 2)
    });
  }

  private buildRoundedForkOutletPath(args: {
    elbowX: number;
    junctionY: number;
    y: number;
    toX: number;
    cornerRadius?: number;
  }): string {
    const radius = args.cornerRadius ?? 18;
    const verticalDelta = args.y - args.junctionY;
    const horizontal = Math.max(1, args.toX - args.elbowX);
    const r = Math.max(0, Math.min(radius, Math.abs(verticalDelta) / 2, horizontal / 2));
    if (Math.abs(verticalDelta) < 2 || r < 2) {
      const straightOverlap = Math.min(radius, horizontal / 2, 18);
      return `M ${args.elbowX - straightOverlap} ${args.y} H ${args.toX}`;
    }
    const dirY = verticalDelta > 0 ? 1 : -1;
    return [
      `M ${args.elbowX} ${args.y - dirY * r}`,
      `Q ${args.elbowX} ${args.y} ${args.elbowX + r} ${args.y}`,
      `H ${args.toX}`
    ].join(" ");
  }

  private renderMixedColorFork(args: {
    edgesSvg: SVGSVGElement;
    from: DrillGraphLayoutNode;
    childPoints: Array<{ edge: DrillGraphEdge; x: number; y: number }>;
    fromX: number;
    fromY: number;
    elbowX: number;
  }): void {
    const sorted = [...args.childPoints].sort((a, b) => a.y - b.y);
    if (sorted.length === 0) return;
    const minY = sorted[0].y;
    const maxY = sorted[sorted.length - 1].y;
    const junctionY = Math.max(minY, Math.min(args.fromY, maxY));
    const verticalRadius = Math.max(0, Math.min(18, Math.abs(maxY - minY) / 2, Math.abs(args.elbowX - args.fromX) / 2));
    const spineEndY = maxY - verticalRadius;
    const parentColor = this.getDrillNodeBranchColor(args.from);
    const parentPath = this.createDrillEdgePath(sorted[0].edge, "sp-editor-drill-edge-trunk", parentColor);
    const canCurveRootSpine = Math.abs(args.fromY - junctionY) < 2 && verticalRadius >= 3;
    parentPath.setAttribute(
      "d",
      canCurveRootSpine
        ? [
            `M ${args.fromX} ${args.fromY}`,
            `H ${args.elbowX - verticalRadius}`,
            `Q ${args.elbowX} ${junctionY} ${args.elbowX} ${junctionY + verticalRadius}`,
            `V ${spineEndY}`
          ].join(" ")
        : [
            this.buildRoundedForkStemPath({
              fromX: args.fromX,
              fromY: args.fromY,
              elbowX: args.elbowX,
              junctionY,
              cornerRadius: 18
            }),
            `M ${args.elbowX} ${minY} V ${spineEndY}`
          ].join(" ")
    );
    args.edgesSvg.appendChild(parentPath);
    sorted.forEach(({ edge, x, y }) => {
      const path = this.createDrillEdgePath(edge, undefined, this.getDrillEdgeColor(edge));
      path.setAttribute(
        "d",
        this.buildRoundedForkOutletPath({
          elbowX: args.elbowX,
          junctionY,
          y,
          toX: x,
          cornerRadius: 18
        })
      );
      args.edgesSvg.appendChild(path);
    });
  }

  private createDrillEdgePath(edge: DrillGraphEdge, extraClass?: string, forcedColor?: string): SVGPathElement {
    const svgNs = "http://www.w3.org/2000/svg";
    const path = document.createElementNS(svgNs, "path");
    path.classList.add("sp-editor-drill-edge", `is-${edge.kind}`);
    if (extraClass) path.classList.add(extraClass);
    path.setAttribute("fill", "none");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    this.applyDrillEdgeColor(path, edge, forcedColor);
    return path;
  }

  private renderOrthogonalBranchGroup(args: {
    edgesSvg: SVGSVGElement;
    from: DrillGraphLayoutNode;
    edges: DrillGraphEdge[];
    layout: DrillGraphLayout;
  }): void {
    const items = args.edges
      .map((edge) => ({ edge, to: args.layout.nodeByKey.get(edge.toKey) }))
      .filter((item): item is { edge: DrillGraphEdge; to: DrillGraphLayoutNode } => !!item.to)
      .sort((a, b) => (a.to.branchInY || a.to.y) - (b.to.branchInY || b.to.y));
    if (items.length === 0) return;
    const fromX = args.from.branchOutX || args.from.x;
    const fromY = args.from.branchOutY || args.from.y;
    const childPoints = items.map((item) => ({
      edge: item.edge,
      x: item.to.branchInX || item.to.x,
      y: item.to.branchInY || item.to.y
    }));
    if (childPoints.length === 1) {
      const { edge, x, y } = childPoints[0];
      const path = this.createDrillEdgePath(edge);
      path.setAttribute(
        "d",
        this.buildRoundedOrthogonalPath({
          fromX,
          fromY,
          toX: x,
          toY: y,
          cornerRadius: 18
        })
      );
      args.edgesSvg.appendChild(path);
      return;
    }
    const firstChildX = Math.min(...childPoints.map((item) => item.x));
    const elbowX = this.getDrillBranchElbowX({
      fromX,
      firstChildX,
      preferredOffset: 42,
      minOffset: 28,
      minDistanceToChild: 58
    });
    const groupColor = this.getDrillBranchGroupColor(childPoints.map((item) => item.edge), args.from);
    if (groupColor) {
      const forkPath = this.createDrillEdgePath(childPoints[0].edge, "sp-editor-drill-edge-fork", groupColor);
      forkPath.setAttribute(
        "d",
        this.buildRoundedForkPath({
          fromX,
          fromY,
          elbowX,
          childPoints: childPoints.map((item) => ({ x: item.x, y: item.y })),
          cornerRadius: 18
        })
      );
      args.edgesSvg.appendChild(forkPath);
      return;
    }
    this.renderMixedColorFork({
      edgesSvg: args.edgesSvg,
      from: args.from,
      childPoints,
      fromX,
      fromY,
      elbowX
    });
  }

  private buildDrillPathConfigModel(configMap: MapRegistryMap): DrillPathPreviewModel {
    const rows = this.getAreaRows(configMap);
    const currentField =
      this.drillContext.activeCategoryQueryName ||
      this.drillContext.currentDrillPath[this.drillContext.currentDrillPath.length - 1] ||
      "Nao detectado";
    const currentLevel = Number.isFinite(this.drillContext.currentLevel) ? this.drillContext.currentLevel + 1 : 1;
    const model: DrillPathPreviewModel = {
      currentFieldLabel: currentField,
      resolvedMapLabel: this.getMapLabel(this.drillContext.resolvedMapId || configMap.mapId),
      currentLevelLabel: `${Math.max(1, currentLevel)}`,
      rootMapLabel: configMap.name || configMap.mapId,
      manualMappings: [],
      automaticMappings: [],
      noNextLevelMappings: [],
      warnings: this.drillContext.warnings.filter((warning) => !!warning)
    };

    rows.forEach((row) => {
      const mapArea = this.findMapAreaDefinition(configMap, row.areaId) || row.mapArea;
      const areaLabel = mapArea.displayName || row.areaId;
      const svgAreaId = this.getEffectiveSvgAreaId(row.areaId, mapArea);
      if (mapArea.drillToMapId) {
        model.manualMappings.push({
          areaId: row.areaId,
          svgAreaId,
          areaLabel,
          targetMapId: mapArea.drillToMapId,
          targetLabel: this.getMapLabel(mapArea.drillToMapId),
          kind: "manual"
        });
        return;
      }

      if (mapArea.drillMode === "none") {
        model.noNextLevelMappings.push({
          areaId: row.areaId,
          svgAreaId,
          areaLabel,
          targetLabel: "Sem proximo nivel",
          kind: "none"
        });
      } else {
        model.automaticMappings.push({
          areaId: row.areaId,
          svgAreaId,
          areaLabel,
          targetLabel: "Automatico",
          kind: "automatic"
        });
      }
    });

    return model;
  }

  private buildDrillSummaryTile(icon: Parameters<MapEditorDialogApp["createIcon"]>[0], label: string, value: string): HTMLElement {
    const tile = document.createElement("div");
    tile.className = "sp-editor-drill-summary-tile";
    const iconWrap = document.createElement("span");
    iconWrap.className = "sp-editor-drill-summary-icon";
    iconWrap.appendChild(this.createIcon(icon));
    const text = document.createElement("div");
    const labelEl = document.createElement("span");
    labelEl.className = "sp-editor-drill-summary-label";
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = value;
    text.append(labelEl, valueEl);
    tile.append(iconWrap, text);
    return tile;
  }

  private buildDrillCountChip(label: string, count: number, className: string): HTMLElement {
    const chip = document.createElement("span");
    chip.className = `sp-editor-drill-chip ${className}`;
    chip.textContent = `${count} ${label}`;
    return chip;
  }

  private buildDrillTargetSelect(activeMap: MapRegistryMap, mapping: DrillPathPreviewMapping): HTMLSelectElement {
    const select = document.createElement("select");
    select.className = "sp-editor-select sp-editor-drill-target-select";
    select.setAttribute("data-drill-path-area-target", "1");
    select.setAttribute("data-map-id", activeMap.mapId);
    select.setAttribute("data-area-id", mapping.areaId);
    const auto = document.createElement("option");
    auto.value = "__auto__";
    auto.textContent = "(auto)";
    auto.selected = mapping.kind === "automatic";
    select.appendChild(auto);

    const none = document.createElement("option");
    none.value = "__none__";
    none.textContent = "Sem proximo nivel";
    none.selected = mapping.kind === "none";
    select.appendChild(none);

    this.manifest.maps
      .filter((map) => map.mapId !== activeMap.mapId && !!map.svgText)
      .forEach((map) => {
        const option = document.createElement("option");
        option.value = map.mapId;
        option.textContent = map.name || map.mapId;
        option.selected = mapping.targetMapId === map.mapId;
        select.appendChild(option);
      });
    return select;
  }

  private buildDrillMappingRow(activeMap: MapRegistryMap, mapping: DrillPathPreviewMapping): HTMLElement {
    void activeMap;
    const row = document.createElement("div");
    row.className = `sp-editor-drill-flow-row is-${mapping.kind}`;
    row.setAttribute("data-drill-flow-row", "1");

    const source = document.createElement("div");
    source.className = "sp-editor-drill-source";
    const sourceDot = document.createElement("span");
    sourceDot.className = "sp-editor-drill-dot";
    const sourceText = document.createElement("span");
    sourceText.textContent = mapping.areaLabel;
    source.append(sourceDot, sourceText);

    const line = document.createElement("button");
    line.type = "button";
    line.className = "sp-editor-drill-connection";
    line.setAttribute("aria-label", `Conexao de ${mapping.areaLabel}`);

    const target = document.createElement("button");
    target.type = "button";
    target.className = "sp-editor-drill-node";
    const title = document.createElement("strong");
    title.textContent =
      mapping.kind === "manual"
        ? `${mapping.areaLabel} -> ${mapping.targetLabel}`
        : mapping.kind === "automatic"
          ? `${mapping.areaLabel} (auto)`
          : "Sem proximo nivel";
    const meta = document.createElement("span");
    meta.textContent = mapping.kind === "manual" ? "Nivel 2" : mapping.targetLabel;
    target.append(title, meta);
    if (mapping.kind === "automatic") {
      const badge = document.createElement("em");
      badge.textContent = "auto";
      target.appendChild(badge);
    }

    row.append(source, line, target);
    return row;
  }

  private getDrillStatusLabel(kind: DrillPathPreviewMapping["kind"]): string {
    if (kind === "manual") return "Manual";
    if (kind === "automatic") return "Automatico";
    return "Sem proximo nivel";
  }

  private getDrillNextMapLabel(mapping: DrillPathPreviewMapping): string {
    if (mapping.targetMapId) return mapping.targetLabel;
    if (mapping.kind === "automatic") return "(auto)";
    return "Selecione um mapa";
  }

  private normalizeDrillSearchText(value: string): string {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_-]+/g, " ")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .toLowerCase();
  }

  private sanitizeDrillDomId(value: string): string {
    const sanitized = String(value || "area")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return sanitized || "area";
  }

  private buildDrillStatusBadge(kind: DrillPathPreviewMapping["kind"]): HTMLElement {
    const badge = document.createElement("span");
    badge.className = `sp-editor-drill-status-badge is-${kind}`;
    badge.textContent = this.getDrillStatusLabel(kind);
    return badge;
  }

  private getEffectiveSvgAreaId(areaId: string, mapArea?: MapRegistryArea | null): string {
    const virtualId = typeof mapArea?.virtualId === "string" ? mapArea.virtualId.trim() : "";
    const explicitId = typeof mapArea?.id === "string" ? mapArea.id.trim() : "";
    const fallback = String(areaId || "").trim();
    // virtualId/id can point to the real SVG element when manifest keys are logical aliases.
    return virtualId || explicitId || fallback;
  }

  private transformSvgPoint(
    svg: SVGSVGElement,
    matrix: DOMMatrix,
    x: number,
    y: number
  ): { x: number; y: number } {
    if (typeof DOMPoint !== "undefined") {
      const point = new DOMPoint(x, y).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    }
    const point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    const transformed = point.matrixTransform(matrix);
    return { x: transformed.x, y: transformed.y };
  }

  private getTransformedSvgBBox(svg: SVGSVGElement, target: SVGElement): GeometryBBox {
    const rawBBox = getGeometryBBox(target);
    if (!(rawBBox.width > 0) || !(rawBBox.height > 0)) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const targetMatrix = (target as SVGGraphicsElement).getCTM?.();
    if (!targetMatrix) return rawBBox;

    let matrix = targetMatrix as DOMMatrix;
    const svgMatrix = svg.getCTM?.();
    if (svgMatrix) {
      try {
        matrix = (svgMatrix as DOMMatrix).inverse().multiply(targetMatrix as DOMMatrix);
      } catch {
        matrix = targetMatrix as DOMMatrix;
      }
    }

    const points = [
      this.transformSvgPoint(svg, matrix, rawBBox.x, rawBBox.y),
      this.transformSvgPoint(svg, matrix, rawBBox.x + rawBBox.width, rawBBox.y),
      this.transformSvgPoint(svg, matrix, rawBBox.x, rawBBox.y + rawBBox.height),
      this.transformSvgPoint(svg, matrix, rawBBox.x + rawBBox.width, rawBBox.y + rawBBox.height)
    ];
    const minX = Math.min(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxX = Math.max(...points.map((point) => point.x));
    const maxY = Math.max(...points.map((point) => point.y));
    if (![minX, minY, maxX, maxY].every(Number.isFinite)) return rawBBox;
    return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
  }

  private getCombinedTransformedSvgBBox(svg: SVGSVGElement, elements: SVGElement[]): GeometryBBox {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    elements.forEach((element) => {
      const bbox = this.getTransformedSvgBBox(svg, element);
      if (!(bbox.width > 0) || !(bbox.height > 0)) return;
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    });

    if (![minX, minY, maxX, maxY].every(Number.isFinite) || maxX <= minX || maxY <= minY) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private findMapAreaDefinition(map: MapRegistryMap | undefined, areaId: string): MapRegistryArea | undefined {
    const areas = map?.areas || {};
    const direct = areas[areaId];
    if (direct) return direct;

    const wanted = norm(areaId);
    return Object.values(areas).find((area) => {
      const candidates = [
        area.id,
        area.virtualId,
        ...(Array.isArray(area.aliases) ? area.aliases : [])
      ];
      return candidates.some((candidate) => norm(String(candidate || "")) === wanted);
    });
  }

  private findSvgAreaElement(svg: SVGSVGElement, mapping: DrillPathPreviewMapping, activeMap?: MapRegistryMap): SVGElement | null {
    const mapArea = this.findMapAreaDefinition(activeMap, mapping.areaId);
    const candidates = [
      mapping.svgAreaId,
      this.getEffectiveSvgAreaId(mapping.areaId, mapArea),
      mapping.areaId,
      mapArea?.id,
      mapArea?.virtualId,
      mapArea?.bindKey,
      mapArea?.displayName,
      ...(Array.isArray(mapArea?.aliases) ? mapArea.aliases : [])
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const normalizedCandidates = new Set(candidates.map((value) => norm(value)));
    return getEditorAreaElements(svg).find((el) => normalizedCandidates.has(norm((el as any).id))) || null;
  }

  private createDrillGeometryEmpty(message: string): HTMLElement {
    const empty = document.createElement("div");
    empty.className = "sp-editor-drill-empty sp-editor-drill-geometry-empty";
    empty.textContent = message;
    return empty;
  }

  private applyDrillGeometryHighlight(el: SVGElement): void {
    el.style.display = "";
    el.style.visibility = "visible";
    el.style.fill = "rgba(15, 159, 143, 0.16)";
    el.style.stroke = "#0f9f8f";
    el.style.strokeWidth = "2";
    el.style.vectorEffect = "non-scaling-stroke";
    el.style.opacity = "1";
  }

  private prepareSelectedAreaForPreview(svg: SVGSVGElement, selected: SVGElement): SVGElement[] {
    const selectedGeometries = getRegionGeometryElements(selected);
    getEditorAreaElements(svg).forEach((area) => {
      if (area === selected) return;
      if (selected.contains(area)) return;
      area.style.display = "none";
    });

    let current: Element | null = selected;
    while (current && current !== svg) {
      if (current instanceof SVGElement) {
        current.style.display = "";
        current.style.visibility = "visible";
        current.style.opacity = "1";
      }
      current = current.parentElement;
    }

    selected.style.display = "";
    selected.style.visibility = "visible";
    selected.style.opacity = "1";
    selectedGeometries.forEach((geometry) => {
      geometry.style.display = "";
      geometry.style.visibility = "visible";
      geometry.style.opacity = "1";
    });
    return selectedGeometries;
  }

  private getPreviewAreaBBox(svg: SVGSVGElement, selected: SVGElement): GeometryBBox {
    const transformed = this.getTransformedSvgBBox(svg, selected);
    if (transformed.width > 0 && transformed.height > 0) return transformed;

    const geometries = getRegionGeometryElements(selected);
    const transformedCombined = this.getCombinedTransformedSvgBBox(svg, geometries);
    if (transformedCombined.width > 0 && transformedCombined.height > 0) return transformedCombined;

    const bbox = getRegionBBox(selected);
    if (bbox.width > 0 && bbox.height > 0) return bbox;

    const combined = getCombinedRegionBBox(geometries);
    if (combined.width > 0 && combined.height > 0) return combined;

    try {
      const raw = (selected as any).getBBox?.();
      if (raw && raw.width > 0 && raw.height > 0) {
        return { x: raw.x, y: raw.y, width: raw.width, height: raw.height };
      }
    } catch {
      // Fall through to viewBox/fixed fallback.
    }

    const viewBox = svg.viewBox?.baseVal;
    if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
      return { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height };
    }

    return { x: 0, y: 0, width: 100, height: 100 };
  }

  private measureSvgElementBBoxInDom(svg: SVGSVGElement, target: SVGElement): GeometryBBox | null {
    const doc = this.root.ownerDocument;
    if (!doc.body) return null;
    const sandbox = doc.createElement("div");
    sandbox.className = "sp-editor-svg-measure-sandbox";
    sandbox.style.position = "absolute";
    sandbox.style.left = "-10000px";
    sandbox.style.top = "-10000px";
    sandbox.style.width = "1px";
    sandbox.style.height = "1px";
    sandbox.style.overflow = "hidden";
    sandbox.style.pointerEvents = "none";
    sandbox.style.opacity = "0";

    doc.body.appendChild(sandbox);
    sandbox.appendChild(svg);
    try {
      const transformed = this.getTransformedSvgBBox(svg, target);
      if (transformed.width > 0 && transformed.height > 0) return transformed;

      const geometries = getRegionGeometryElements(target);
      const transformedCombined = this.getCombinedTransformedSvgBBox(svg, geometries);
      if (transformedCombined.width > 0 && transformedCombined.height > 0) return transformedCombined;

      const local = getRegionBBox(target);
      if (local.width > 0 && local.height > 0) return local;

      const raw = (target as any).getBBox?.();
      if (raw && raw.width > 0 && raw.height > 0) {
        return { x: raw.x, y: raw.y, width: raw.width, height: raw.height };
      }
    } catch {
      // Use non-DOM fallbacks below.
    } finally {
      sandbox.remove();
    }
    return null;
  }

  private buildDrillGeometryPreview(activeMap: MapRegistryMap, mapping: DrillPathPreviewMapping): HTMLElement {
    const preview = document.createElement("div");
    preview.className = "sp-editor-drill-geometry-preview";
    const model = this.getCachedSvgModel(activeMap.svgText);
    if (!model) {
      preview.appendChild(this.createDrillGeometryEmpty("Nenhum SVG disponivel para este mapa."));
      return preview;
    }

    const svg = model.templateSvg.cloneNode(true) as SVGSVGElement;
    const selected = this.findSvgAreaElement(svg, mapping, activeMap);
    if (!selected) {
      preview.appendChild(
        this.createDrillGeometryEmpty(
          `Area nao encontrada no SVG do mapa atual. ID esperado: ${mapping.svgAreaId || mapping.areaId}.`
        )
      );
      return preview;
    }

    this.prepareSelectedAreaForPreview(svg, selected);
    const measured = this.measureSvgElementBBoxInDom(svg, selected);
    const bbox = measured && measured.width > 0 && measured.height > 0 ? measured : this.getPreviewAreaBBox(svg, selected);
    if (!(bbox.width > 0) || !(bbox.height > 0)) {
      preview.appendChild(this.createDrillGeometryEmpty("Nao foi possivel medir a geometria da area selecionada."));
      return preview;
    }

    this.applyDrillGeometryHighlight(selected);
    getRegionGeometryElements(selected).forEach((geometry) => {
      this.applyDrillGeometryHighlight(geometry);
    });

    const padding = Math.max(4, Math.max(bbox.width, bbox.height, 1) * 0.18);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute(
      "viewBox",
      `${bbox.x - padding} ${bbox.y - padding} ${Math.max(1, bbox.width + padding * 2)} ${Math.max(1, bbox.height + padding * 2)}`
    );
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Preview real da area ${mapping.areaLabel}`);
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.display = "block";
    preview.appendChild(svg);
    return preview;
  }

  private updateDrillDetailsPanel(panel: HTMLElement, activeMap: MapRegistryMap, mapping?: DrillPathPreviewMapping): void {
    panel.replaceChildren();
    const title = document.createElement("h4");
    title.textContent = "Detalhes da Area";
    panel.appendChild(title);

    if (!mapping) {
      const empty = document.createElement("div");
      empty.className = "sp-editor-drill-empty";
      empty.textContent = "Selecione uma area para visualizar a geometria.";
      panel.appendChild(empty);
      return;
    }

    const header = document.createElement("div");
    header.className = "sp-editor-drill-detail-header";
    const avatar = document.createElement("span");
    avatar.className = "sp-editor-drill-area-avatar";
    avatar.textContent = mapping.areaLabel.slice(0, 3);
    const headerText = document.createElement("div");
    const areaName = document.createElement("strong");
    areaName.className = "sp-editor-drill-detail-title";
    areaName.textContent = mapping.areaLabel;
    const areaId = document.createElement("span");
    areaId.className = "sp-editor-drill-detail-subtitle";
    areaId.textContent = mapping.svgAreaId && mapping.svgAreaId !== mapping.areaId ? mapping.svgAreaId : mapping.areaId;
    headerText.append(areaName, areaId);
    header.append(avatar, headerText);
    panel.appendChild(header);

    const origin = document.createElement("div");
    origin.className = "sp-editor-drill-detail-field";
    const originLabel = document.createElement("span");
    originLabel.textContent = "Mapa de origem";
    const originValue = document.createElement("strong");
    originValue.textContent = activeMap.name || activeMap.mapId;
    origin.append(originLabel, originValue);
    panel.appendChild(origin);

    const geometryTitle = document.createElement("h5");
    geometryTitle.textContent = "Preview da geometria";
    panel.append(geometryTitle, this.buildDrillGeometryPreview(activeMap, mapping));
  }

  private updateDrillMappingFromSelect(activeMap: MapRegistryMap, mapping: DrillPathPreviewMapping, value: string): void {
    activeMap.areas = activeMap.areas || {};
    const area = activeMap.areas[mapping.areaId] = activeMap.areas[mapping.areaId] || {};

    if (value === "__auto__") {
      area.drillMode = "automatic";
      area.drillToMapId = undefined;
      mapping.kind = "automatic";
      mapping.targetMapId = undefined;
      mapping.targetLabel = "Automatico";
    } else if (value === "__none__") {
      area.drillMode = "none";
      area.drillToMapId = undefined;
      mapping.kind = "none";
      mapping.targetMapId = undefined;
      mapping.targetLabel = "Sem proximo nivel";
    } else {
      const selectedMap = this.manifest.maps.find((map) => map.mapId === value);
      area.drillMode = "manual";
      area.drillToMapId = value;
      mapping.kind = "manual";
      mapping.targetMapId = value;
      mapping.targetLabel = selectedMap?.name || selectedMap?.mapId || value;
    }

    this.syncResult(false);
  }

  private buildDrillConfigRow(
    activeMap: MapRegistryMap,
    mapping: DrillPathPreviewMapping,
    detailsPanel: HTMLElement
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = `sp-editor-drill-config-row is-${mapping.kind}`;
    row.setAttribute("data-drill-config-row", "1");
    row.setAttribute("data-drill-area-id", mapping.areaId);
    row.setAttribute("data-drill-status", mapping.kind);
    const setRowSearchText = () => {
      const activeArea = activeMap.areas?.[mapping.areaId];
      const searchText = [
        mapping.areaId,
        mapping.svgAreaId,
        mapping.areaLabel,
        mapping.targetLabel,
        mapping.targetMapId,
        activeArea?.id,
        activeArea?.virtualId,
        activeArea?.bindKey,
        activeArea?.displayName,
        ...(Array.isArray(activeArea?.aliases) ? activeArea.aliases : [])
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join(" ");
      row.setAttribute("data-drill-search", this.normalizeDrillSearchText(searchText));
    };
    setRowSearchText();
    if (this.selectedAreaId === mapping.areaId) {
      row.classList.add("is-selected");
    }

    const checkCell = document.createElement("div");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkCell.appendChild(checkbox);

    const areaCell = document.createElement("strong");
    areaCell.className = "sp-editor-drill-config-area";
    areaCell.textContent = mapping.areaLabel;

    const targetCell = document.createElement("div");
    const select = this.buildDrillTargetSelect(activeMap, mapping);
    select.classList.add("sp-editor-drill-config-select");
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", () => {
      this.updateDrillMappingFromSelect(activeMap, mapping, select.value);
      row.className = `sp-editor-drill-config-row is-${mapping.kind} is-selected`;
      row.setAttribute("data-drill-area-id", mapping.areaId);
      row.setAttribute("data-drill-status", mapping.kind);
      setRowSearchText();
      this.selectedAreaId = mapping.areaId;
      statusCell.replaceChildren(this.buildDrillStatusBadge(mapping.kind));
      this.updateDrillDetailsPanel(detailsPanel, activeMap, mapping);
    });
    targetCell.appendChild(select);

    const statusCell = document.createElement("div");
    statusCell.appendChild(this.buildDrillStatusBadge(mapping.kind));

    const menu = document.createElement("button");
    menu.type = "button";
    menu.className = "sp-editor-drill-row-menu";
    menu.setAttribute("aria-label", `Acoes de ${mapping.areaLabel}`);
    menu.textContent = "...";
    menu.addEventListener("click", (event) => event.stopPropagation());

    row.addEventListener("click", () => {
      row.parentElement?.querySelectorAll(".sp-editor-drill-config-row.is-selected").forEach((selected) => {
        selected.classList.remove("is-selected");
      });
      row.classList.add("is-selected");
      this.selectedAreaId = mapping.areaId;
      this.updateDrillDetailsPanel(detailsPanel, activeMap, mapping);
    });

    row.append(checkCell, areaCell, targetCell, statusCell, menu);
    return row;
  }

  private buildDrillConfigListCard(activeMap: MapRegistryMap, model: DrillPathPreviewModel, detailsPanel: HTMLElement): HTMLElement {
    const mappings = [...model.manualMappings, ...model.automaticMappings, ...model.noNextLevelMappings];
    const card = document.createElement("div");
    card.className = "sp-editor-drill-config-card";
    const title = document.createElement("h4");
    title.textContent = "Configurar Proximo Nivel";
    const subtitle = document.createElement("p");
    subtitle.textContent = "Selecione para qual mapa cada area fara drilldown no proximo nivel.";
    card.append(title, subtitle);

    const toolbar = document.createElement("div");
    toolbar.className = "sp-editor-drill-config-toolbar is-search-only";
    const search = document.createElement("input");
    search.className = "sp-editor-drill-config-search";
    search.type = "search";
    search.placeholder = "Buscar area por nome ou ID";
    search.value = this.areaSearch || "";
    search.autocomplete = "off";
    search.spellcheck = false;
    search.setAttribute("data-drill-config-search", "1");
    toolbar.appendChild(search);
    card.appendChild(toolbar);

    const table = document.createElement("div");
    table.className = "sp-editor-drill-config-table";
    const header = document.createElement("div");
    header.className = "sp-editor-drill-config-header";
    ["", "Area", "Proximo mapa", "Status", ""].forEach((label) => {
      const cell = document.createElement("span");
      cell.textContent = label;
      header.appendChild(cell);
    });
    const body = document.createElement("div");
    body.className = "sp-editor-drill-config-body";

    const rows = mappings.map((mapping) => this.buildDrillConfigRow(activeMap, mapping, detailsPanel));
    rows.forEach((row) => body.appendChild(row));
    table.append(header, body);
    card.appendChild(table);

    const emptySearch = document.createElement("div");
    emptySearch.className = "sp-editor-drill-config-empty";
    emptySearch.textContent = "Nenhuma area encontrada para a busca.";
    emptySearch.hidden = true;
    card.appendChild(emptySearch);

    const applySearch = () => {
      const term = this.normalizeDrillSearchText(search.value);
      this.areaSearch = search.value;
      let visibleCount = 0;
      rows.forEach((row) => {
        const text = row.getAttribute("data-drill-search") || "";
        const visible = !term || text.includes(term);
        row.classList.toggle("is-search-hidden", !visible);
        row.toggleAttribute("aria-hidden", !visible);
        if (visible) visibleCount += 1;
      });
      emptySearch.hidden = visibleCount > 0;
      table.classList.toggle("is-empty-search", visibleCount === 0);

      const isVisibleRow = (row: HTMLElement) => !row.classList.contains("is-search-hidden");

      const selectedStillVisible =
        !!this.selectedAreaId &&
        rows.some((row) => isVisibleRow(row) && row.getAttribute("data-drill-area-id") === this.selectedAreaId);
      if (selectedStillVisible) return;

      const firstVisible = rows.find(isVisibleRow);
      const firstAreaId = firstVisible?.getAttribute("data-drill-area-id") || null;
      const firstMapping = firstAreaId ? mappings.find((mapping) => mapping.areaId === firstAreaId) || null : null;

      rows.forEach((row) => row.classList.toggle("is-selected", !!firstVisible && row === firstVisible));
      if (firstMapping) {
        this.selectedAreaId = firstMapping.areaId;
        this.updateDrillDetailsPanel(detailsPanel, activeMap, firstMapping);
      } else {
        this.selectedAreaId = null;
        this.updateDrillDetailsPanel(detailsPanel, activeMap, undefined);
      }
    };
    search.addEventListener("click", (event) => event.stopPropagation());
    search.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        search.value = "";
        applySearch();
      }
    });
    search.addEventListener("input", applySearch);

    const selectedMapping = this.selectedAreaId
      ? mappings.find((mapping) => mapping.areaId === this.selectedAreaId) || null
      : null;
    if (this.selectedAreaId && !mappings.some((mapping) => mapping.areaId === this.selectedAreaId)) {
      this.areaSearch = "";
      search.value = "";
    }
    if (selectedMapping) {
      this.selectedAreaId = selectedMapping.areaId;
      this.updateDrillDetailsPanel(detailsPanel, activeMap, selectedMapping);
      rows.forEach((row) => {
        row.classList.toggle("is-selected", row.getAttribute("data-drill-area-id") === selectedMapping.areaId);
      });
    } else {
      this.updateDrillDetailsPanel(detailsPanel, activeMap, undefined);
    }
    applySearch();

    return card;
  }

  private buildDrillSummary(model: DrillPathPreviewModel | DrillPathGraphModel): HTMLElement {
    const summary = document.createElement("section");
    summary.className = "sp-editor-drill-summary";
    if ("stats" in model) {
      summary.append(
        this.buildDrillSummaryTile("map", "Campo atual", model.currentFieldLabel),
        this.buildDrillSummaryTile("metadata", "Mapa raiz", model.rootMapLabel),
        this.buildDrillSummaryTile("map", "Mapa ativo", model.activeMapLabel)
      );
    } else {
      summary.append(
        this.buildDrillSummaryTile("map", "Campo atual", model.currentFieldLabel),
        this.buildDrillSummaryTile("metadata", "Mapa atual", model.resolvedMapLabel),
        this.buildDrillSummaryTile("map", "Nivel atual", model.currentLevelLabel)
      );
    }
    const chips = document.createElement("div");
    chips.className = "sp-editor-drill-chip-row";
    if ("stats" in model) {
      chips.append(
        this.buildDrillCountChip("manuais", model.stats.manual, "is-manual"),
        this.buildDrillCountChip("automaticos", model.stats.automatic, "is-automatic"),
        this.buildDrillCountChip("sem nivel", model.stats.none, "is-none")
      );
    } else {
      chips.append(
        this.buildDrillCountChip("manuais", model.manualMappings.length, "is-manual"),
        this.buildDrillCountChip("automaticos", model.automaticMappings.length, "is-automatic")
      );
    }
    summary.appendChild(chips);
    return summary;
  }

  private buildDrillPreviewCard(model: DrillPathGraphModel): HTMLElement {
    const preview = document.createElement("section");
    preview.className = "sp-editor-drill-preview-card";
    const previewHead = document.createElement("div");
    previewHead.className = "sp-editor-drill-preview-head";
    const previewText = document.createElement("div");
    const previewTitle = document.createElement("h4");
    previewTitle.textContent = "Preview do Mapeamento";
    const previewSubtitle = document.createElement("p");
    previewSubtitle.textContent = "Visualize como as areas se conectam nos proximos niveis do drill.";
    previewText.append(previewTitle, previewSubtitle);
    const previewTools = document.createElement("div");
    previewTools.className = "sp-editor-drill-preview-tools";
    const flowViewport = document.createElement("div");
    flowViewport.className = "sp-editor-drill-flow-viewport";
    const levelHeader = document.createElement("div");
    levelHeader.className = "sp-editor-drill-level-header";
    const scaleHost = document.createElement("div");
    scaleHost.className = "sp-editor-drill-graph-scale-host";
    const graphCanvas = document.createElement("div");
    graphCanvas.className = "sp-editor-drill-flow sp-editor-drill-graph-canvas";
    const layout = this.layoutDrillGraph(model);
    graphCanvas.style.width = `${layout.width}px`;
    graphCanvas.style.height = `${layout.height}px`;
    graphCanvas.style.minWidth = `${Math.min(layout.width, 900)}px`;
    const graphSignature = this.getDrillGraphSignature(model);
    let flowScale = this.drillPreviewZoom;
    let levelHeaderInner: HTMLElement | null = null;
    const syncStickyLevelScroll = () => {
      if (!levelHeaderInner) return;
      this.updateDrillLevelHeaderPositions({
        headerInner: levelHeaderInner,
        layout,
        flowViewport,
        scale: flowScale
      });
    };
    const applyFlowScale = () => {
      this.drillPreviewZoom = flowScale;
      graphCanvas.style.transform = `scale(${flowScale})`;
      graphCanvas.style.transformOrigin = "0 0";
      scaleHost.style.width = `${layout.width * flowScale}px`;
      scaleHost.style.height = `${layout.height * flowScale}px`;
      syncStickyLevelScroll();
    };
    const computeFitScale = (): number => {
      const viewportWidth = Math.max(flowViewport.clientWidth || preview.clientWidth || 1, 1);
      const viewportHeight = Math.max(flowViewport.clientHeight || 420, 1);
      const fitScaleX = viewportWidth / Math.max(layout.width, 1);
      const fitScaleY = viewportHeight / Math.max(layout.height, 1);
      return clamp(Math.min(fitScaleX, fitScaleY, 1), 0.35, 1.25);
    };
    const fitGraph = (behavior: ScrollBehavior = "auto"): void => {
      flowScale = computeFitScale();
      applyFlowScale();
      flowViewport.scrollTo({ left: 0, top: 0, behavior });
      syncStickyLevelScroll();
    };
    const zoomOutBtn = this.createButton("Zoom out", "minus", { kind: "secondary", iconOnly: true, ariaLabel: "Afastar preview do drill" });
    const zoomInBtn = this.createButton("Zoom in", "add", { kind: "secondary", iconOnly: true, ariaLabel: "Aproximar preview do drill" });
    const fitBtn = this.createButton("Fit", "map", { kind: "secondary", iconOnly: true, ariaLabel: "Ajustar preview do drill" });
    const optionalToggle = document.createElement("label");
    optionalToggle.className = "sp-editor-drill-preview-toggle";
    const optionalInput = document.createElement("input");
    optionalInput.type = "checkbox";
    optionalInput.checked = this.drillPreviewShowOptional;
    optionalInput.addEventListener("change", () => {
      this.drillPreviewShowOptional = optionalInput.checked;
      this.render();
    });
    const optionalText = document.createElement("span");
    optionalText.textContent = "Mostrar automaticos";
    optionalToggle.append(optionalInput, optionalText);
    zoomOutBtn.addEventListener("click", () => {
      flowScale = clamp(flowScale / 1.18, 0.35, 2.25);
      applyFlowScale();
    });
    zoomInBtn.addEventListener("click", () => {
      flowScale = clamp(flowScale * 1.18, 0.35, 2.25);
      applyFlowScale();
    });
    fitBtn.addEventListener("click", () => fitGraph("smooth"));
    previewTools.append(zoomOutBtn, zoomInBtn, fitBtn, optionalToggle);
    previewHead.append(previewText, previewTools);
    preview.appendChild(previewHead);

    levelHeaderInner = this.renderDrillGraphLevelMarkers(layout, model);
    levelHeaderInner.classList.add("sp-editor-drill-level-header-inner");
    levelHeaderInner.style.width = `${layout.width}px`;
    levelHeader.appendChild(levelHeaderInner);

    const edgesSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    edgesSvg.classList.add("sp-editor-drill-graph-edges");
    edgesSvg.setAttribute("width", `${layout.width}`);
    edgesSvg.setAttribute("height", `${layout.height}`);
    edgesSvg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    edgesSvg.setAttribute("aria-hidden", "true");
    const edgesByFrom = new Map<string, DrillGraphEdge[]>();
    layout.edges.forEach((edge) => {
      const list = edgesByFrom.get(edge.fromKey) || [];
      list.push(edge);
      edgesByFrom.set(edge.fromKey, list);
    });
    edgesByFrom.forEach((edges, fromKey) => {
      const from = layout.nodeByKey.get(fromKey);
      if (!from) return;
      const sorted = [...edges].sort((a, b) => {
        const ay = layout.nodeByKey.get(a.toKey)?.y || 0;
        const by = layout.nodeByKey.get(b.toKey)?.y || 0;
        return ay - by;
      });
      this.renderOrthogonalBranchGroup({ edgesSvg, from, edges: sorted, layout });
    });
    graphCanvas.appendChild(edgesSvg);
    layout.nodes.forEach((node) => graphCanvas.appendChild(this.renderDrillGraphNode(node)));
    layout.edges.forEach((edge) => {
      const label = this.renderDrillGraphEdgeLabel(edge, layout);
      if (label) graphCanvas.appendChild(label);
    });
    applyFlowScale();
    scaleHost.appendChild(graphCanvas);
    flowViewport.appendChild(scaleHost);
    flowViewport.addEventListener("scroll", syncStickyLevelScroll);
    preview.appendChild(levelHeader);
    preview.appendChild(flowViewport);
    requestAnimationFrame(() => {
      if (this.drillPreviewLastGraphSignature !== graphSignature) {
        this.drillPreviewLastGraphSignature = graphSignature;
        fitGraph("auto");
        return;
      }
      applyFlowScale();
      syncStickyLevelScroll();
    });
    return preview;
  }

  private buildDrillPreviewScreen(model: DrillPathGraphModel): HTMLElement {
    const screen = document.createElement("section");
    screen.className = "sp-editor-drill-screen sp-editor-drill-preview-screen";
    screen.append(this.buildDrillPreviewCard(model));
    return screen;
  }

  private buildDrillConfigScreen(activeMap: MapRegistryMap, model: DrillPathPreviewModel): HTMLElement {
    const screen = document.createElement("section");
    screen.className = "sp-editor-drill-screen sp-editor-drill-config-screen sp-editor-drill-config";
    const details = document.createElement("aside");
    details.className = "sp-editor-drill-details";
    screen.append(this.buildDrillConfigListCard(activeMap, model, details), details);
    return screen;
  }

  private buildDrillPathPageHeader(): HTMLElement {
    const header = document.createElement("div");
    header.className = "sp-editor-drill-page-header";
    const title = document.createElement("h3");
    title.textContent = "Drill Path";
    const actions = document.createElement("div");
    actions.className = "sp-editor-drill-screen-tabs";

    const previewBtn = this.createButton("Preview", "eye", {
      kind: this.drillPathScreen === "preview" ? "primary" : "secondary",
      compact: true
    });
    previewBtn.classList.toggle("is-active", this.drillPathScreen === "preview");
    previewBtn.addEventListener("click", () => this.setDrillPathScreen("preview"));

    const configBtn = this.createButton("Configuracao", "metadata", {
      kind: this.drillPathScreen === "config" ? "primary" : "secondary",
      compact: true
    });
    configBtn.classList.toggle("is-active", this.drillPathScreen === "config");
    configBtn.addEventListener("click", () => this.setDrillPathScreen("config"));

    const closeBtn = this.createButton("Fechar", "close", { kind: "ghost", iconOnly: true, ariaLabel: "Voltar ao editor" });
    closeBtn.addEventListener("click", () => {
      this.closeDrillPathEditor();
      this.render();
    });

    actions.append(previewBtn, configBtn, closeBtn);
    header.append(title, actions);
    return header;
  }

  private buildDrillPathPage(shell: HTMLElement): HTMLElement {
    const activeMap = this.getActiveMap();
    const configModel = this.buildDrillPathConfigModel(activeMap);
    const graphModel = this.buildDrillPathGraphModel();
    const page = document.createElement("div");
    page.className = "sp-editor-drill-page";
    page.append(this.buildDrillPathPageHeader(), this.buildDrillSummary(this.drillPathScreen === "config" ? configModel : graphModel));
    if (graphModel.hasBlockingErrors) {
      const banner = document.createElement("div");
      banner.className = "sp-editor-status is-error";
      banner.textContent = graphModel.errors.join(" | ");
      page.appendChild(banner);
    }
    page.append(
      this.drillPathScreen === "config"
        ? this.buildDrillConfigScreen(activeMap, configModel)
        : this.buildDrillPreviewScreen(graphModel)
    );

    const footer = document.createElement("div");
    footer.className = "sp-editor-drill-footer";
    if (this.drillPathScreen === "config") {
      const backPreviewBtn = this.createButton("Voltar ao Preview", "back", { kind: "secondary" });
      backPreviewBtn.addEventListener("click", () => this.setDrillPathScreen("preview"));
      footer.appendChild(backPreviewBtn);
    }
    const applyBtn = this.createButton("Aplicar", "edit", { kind: "primary" });
    applyBtn.disabled = graphModel.hasBlockingErrors;
    applyBtn.title = graphModel.hasBlockingErrors ? "Corrija os ciclos de drilldown antes de aplicar." : "";
    applyBtn.addEventListener("click", () => {
      this.closeDrillPathEditor();
      this.syncResult(true);
      this.render();
    });
    const secondaryCloseBtn = this.createButton("Fechar", "close", { kind: "secondary" });
    secondaryCloseBtn.addEventListener("click", () => {
      this.closeDrillPathEditor();
      this.render();
    });
    footer.append(applyBtn, secondaryCloseBtn);
    page.appendChild(footer);
    return page;
  }

  private openSvgEditor(shell: HTMLElement): void {
    this.applyCurrentInputs(shell);
    const activeMap = this.getActiveMap();
    const sanitizedMarkup = sanitizeSvgMarkup(activeMap.svgText);
    if (sanitizedMarkup === null) {
      this.setStatus("Nao foi possivel abrir o SVG para edicao porque o conteudo atual e invalido.", true);
      this.render();
      return;
    }
    this.svgEditorValue = sanitizedMarkup || "";
    this.svgEditorError = "";
    this.svgEditorOpen = true;
    this.render();
  }

  private closeSvgEditor(): void {
    this.svgEditorOpen = false;
    this.svgEditorError = "";
  }

  private openSvgCreateEditor(): void {
    this.svgCreateEditorOpen = true;
    this.svgCreateEditorValue = "";
    this.svgCreateEditorName = "Novo mapa";
    this.svgCreateEditorError = "";
    this.addMapMenuOpen = false;
    this.render();
  }

  private closeSvgCreateEditor(): void {
    this.svgCreateEditorOpen = false;
    this.svgCreateEditorValue = "";
    this.svgCreateEditorName = "";
    this.svgCreateEditorError = "";
  }

  private buildSvgCreateOverlay(): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = "sp-editor-svg-overlay";
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        this.closeSvgCreateEditor();
        this.render();
      }
    });

    const dialog = document.createElement("div");
    dialog.className = "sp-editor-svg-modal";
    dialog.classList.add("is-create");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const header = document.createElement("div");
    header.className = "sp-editor-svg-header";
    const title = document.createElement("h3");
    title.textContent = "Adicionar mapa por SVG";
    const closeBtn = this.createButton("Close", "close", { kind: "ghost", iconOnly: true, ariaLabel: "Fechar adicao de SVG" });
    closeBtn.addEventListener("click", () => {
      this.closeSvgCreateEditor();
      this.render();
    });
    header.append(title, closeBtn);
    dialog.appendChild(header);

    const nameLabel = document.createElement("label");
    nameLabel.className = "sp-editor-svg-name-label";
    nameLabel.textContent = "Nome do mapa";
    const nameInput = document.createElement("input");
    nameInput.className = "sp-editor-input";
    nameInput.value = this.svgCreateEditorName || "Novo mapa";
    nameInput.placeholder = "Ex: Estados, Municipios SP, Bairros Barretos";
    nameLabel.appendChild(nameInput);
    dialog.appendChild(nameLabel);

    const toolbar = document.createElement("div");
    toolbar.className = "sp-editor-svg-toolbar";
    const badge = document.createElement("div");
    badge.className = "sp-editor-svg-search";
    badge.append(this.createIcon("svg"));
    const badgeText = document.createElement("span");
    badgeText.textContent = "Cole o markup SVG abaixo. O conteudo sera sanitizado ao salvar.";
    badge.appendChild(badgeText);
    toolbar.appendChild(badge);
    dialog.appendChild(toolbar);

    const editorWrap = document.createElement("div");
    editorWrap.className = "sp-editor-codeframe";
    const gutter = document.createElement("pre");
    gutter.className = "sp-editor-svg-gutter";
    const textarea = document.createElement("textarea");
    textarea.className = "sp-editor-svg-textarea";
    textarea.value = this.svgCreateEditorValue;
    textarea.spellcheck = false;
    textarea.placeholder = "<svg ...>...</svg>";
    const syncLineNumbers = () => {
      const lineCount = Math.max(1, textarea.value.split("\n").length);
      gutter.textContent = Array.from({ length: lineCount }, (_, index) => String(index + 1)).join("\n");
      gutter.scrollTop = textarea.scrollTop;
    };
    textarea.addEventListener("input", syncLineNumbers);
    textarea.addEventListener("scroll", () => {
      gutter.scrollTop = textarea.scrollTop;
    });
    syncLineNumbers();
    editorWrap.append(gutter, textarea);
    dialog.appendChild(editorWrap);

    if (this.svgCreateEditorError) {
      const error = document.createElement("div");
      error.className = "sp-editor-status is-error";
      error.textContent = this.svgCreateEditorError;
      dialog.appendChild(error);
    }

    const footer = document.createElement("div");
    footer.className = "sp-editor-footer";
    const saveBtn = this.createButton("Save & Add", "add", { kind: "primary" });
    saveBtn.addEventListener("click", () => {
      const name = nameInput.value.trim() || "Novo mapa";
      const result = this.createMapFromSvgText(textarea.value, name);
      if (result.ok === false) {
        this.svgCreateEditorName = name;
        this.svgCreateEditorValue = textarea.value;
        this.svgCreateEditorError = result.error;
        this.render();
        return;
      }
      this.closeSvgCreateEditor();
      this.render();
    });
    const closeTextBtn = this.createButton("Close", "close", { kind: "secondary" });
    closeTextBtn.addEventListener("click", () => {
      this.closeSvgCreateEditor();
      this.render();
    });
    footer.append(saveBtn, closeTextBtn);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    requestAnimationFrame(() => textarea.focus());
    return overlay;
  }

  private buildSvgEditorOverlay(shell: HTMLElement): HTMLElement {
    const activeMap = this.getActiveMap();
    const overlay = document.createElement("div");
    overlay.className = "sp-editor-svg-overlay";
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        this.closeSvgEditor();
        this.render();
      }
    });

    const dialog = document.createElement("div");
    dialog.className = "sp-editor-svg-modal";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const header = document.createElement("div");
    header.className = "sp-editor-svg-header";
    const title = document.createElement("h3");
    title.textContent = `Edit ${activeMap.name || activeMap.mapId}`;
    const closeBtn = this.createButton("Close", "close", { kind: "ghost", iconOnly: true, ariaLabel: "Fechar edicao do SVG" });
    closeBtn.addEventListener("click", () => {
      this.closeSvgEditor();
      this.render();
    });
    header.append(title, closeBtn);
    dialog.appendChild(header);

    const toolbar = document.createElement("div");
    toolbar.className = "sp-editor-svg-toolbar";
    const searchBadge = document.createElement("div");
    searchBadge.className = "sp-editor-svg-search";
    searchBadge.append(this.createIcon("search"));
    const searchText = document.createElement("span");
    searchText.textContent = "Editor SVG";
    searchBadge.appendChild(searchText);
    toolbar.appendChild(searchBadge);
    dialog.appendChild(toolbar);

    const editorWrap = document.createElement("div");
    editorWrap.className = "sp-editor-codeframe";
    const gutter = document.createElement("pre");
    gutter.className = "sp-editor-svg-gutter";
    const textarea = document.createElement("textarea");
    textarea.className = "sp-editor-svg-textarea";
    textarea.value = this.svgEditorValue;
    textarea.spellcheck = false;
    const syncLineNumbers = () => {
      const lineCount = Math.max(1, textarea.value.split("\n").length);
      gutter.textContent = Array.from({ length: lineCount }, (_, index) => String(index + 1)).join("\n");
      gutter.scrollTop = textarea.scrollTop;
    };
    textarea.addEventListener("input", syncLineNumbers);
    textarea.addEventListener("scroll", () => {
      gutter.scrollTop = textarea.scrollTop;
    });
    syncLineNumbers();
    editorWrap.append(gutter, textarea);
    dialog.appendChild(editorWrap);

    if (this.svgEditorError) {
      const error = document.createElement("div");
      error.className = "sp-editor-status is-error";
      error.textContent = this.svgEditorError;
      dialog.appendChild(error);
    }

    const footer = document.createElement("div");
    footer.className = "sp-editor-footer";

    const saveCloseBtn = this.createButton("Save & Close", "svg", { kind: "primary" });
    saveCloseBtn.addEventListener("click", () => {
      const sanitizedMarkup = sanitizeSvgMarkup(textarea.value);
      if (sanitizedMarkup === null) {
        this.svgEditorError = "O SVG editado e invalido ou nao pode ser sanitizado.";
        this.render();
        return;
      }
      const currentMap = this.getActiveMap();
      currentMap.svgText = "data:image/svg+xml;utf8," + encodeURIComponent(sanitizedMarkup || "");
      this.svgEditorValue = sanitizedMarkup || "";
      this.svgEditorOpen = false;
      this.svgEditorError = "";
      this.selectedAreaId = this.selectedAreaId && this.extractAreaIds(currentMap.svgText).includes(this.selectedAreaId) ? this.selectedAreaId : null;
      this.syncResult(false);
      this.setStatus("SVG atualizado no editor. Revise o preview e salve a janela principal para persistir.", false);
      this.render();
    });

    const closeTextBtn = this.createButton("Close", "close", { kind: "secondary" });
    closeTextBtn.addEventListener("click", () => {
      this.closeSvgEditor();
      this.render();
    });

    footer.append(saveCloseBtn, closeTextBtn);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    return overlay;
  }

  private render(): void {
    this.root.textContent = "";
    const shell = document.createElement("div");
    shell.className = "sp-editor-shell";

    if (this.drillPathEditorOpen) {
      shell.appendChild(this.buildDrillPathPage(shell));
      this.root.appendChild(shell);
      this.restoreTransientFocus();
      return;
    }

    const body = this.viewMode === "detail" ? this.buildDetailView(shell) : this.buildBrowserView(shell);
    shell.appendChild(body);

    if (this.statusMessage) {
      const status = document.createElement("div");
      status.className = this.statusError ? "sp-editor-status is-error" : "sp-editor-status";
      status.textContent = this.statusMessage;
      shell.appendChild(status);
    }

    if (this.svgEditorOpen) {
      shell.appendChild(this.buildSvgEditorOverlay(shell));
    }

    if (this.svgCreateEditorOpen) {
      shell.appendChild(this.buildSvgCreateOverlay());
    }

    this.root.appendChild(shell);
    this.restoreTransientFocus();
  }

  private buildMapActionMenu(shell: HTMLElement, map: MapRegistryMap): HTMLElement {
    const menu = document.createElement("div");
    menu.className = "sp-editor-map-action-menu";
    menu.setAttribute("role", "menu");

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "sp-editor-map-action-menu-item";
    renameBtn.textContent = "Editar nome";
    renameBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.applyCurrentInputs(shell);
      this.selectedMapId = map.mapId;
      this.selectedAreaId = null;
      this.renamingMapId = map.mapId;
      this.openMapActionMenuId = null;
      this.render();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "sp-editor-map-action-menu-item is-danger";
    deleteBtn.textContent = "Excluir";
    deleteBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.applyCurrentInputs(shell);
      this.deleteMapById(map.mapId);
    });

    menu.append(renameBtn, deleteBtn);
    return menu;
  }

  private closeFloatingMenus(): boolean {
    let changed = false;
    if (this.openMapActionMenuId) {
      this.openMapActionMenuId = null;
      changed = true;
    }
    if (this.addMapMenuOpen) {
      this.addMapMenuOpen = false;
      changed = true;
    }
    return changed;
  }

  private buildAddMapMenu(addInput: HTMLInputElement): HTMLElement {
    const menu = document.createElement("div");
    menu.className = "sp-editor-add-map-menu";
    menu.classList.add("is-open-up");
    menu.setAttribute("role", "menu");

    const pasteBtn = document.createElement("button");
    pasteBtn.type = "button";
    pasteBtn.className = "sp-editor-add-map-menu-item";
    pasteBtn.textContent = "Colar texto SVG";
    pasteBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.addMapMenuOpen = false;
      this.openMapActionMenuId = null;
      this.openSvgCreateEditor();
    });

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "sp-editor-add-map-menu-item";
    uploadBtn.textContent = "Importar arquivo SVG";
    uploadBtn.disabled = !this.allowMapUploads;
    uploadBtn.title = this.allowMapUploads ? "" : "Importacao local disponivel apenas quando o host permite escolher arquivos.";
    uploadBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.allowMapUploads) return;
      this.addMapMenuOpen = false;
      this.openMapActionMenuId = null;
      menu.remove();
      addInput.click();
    });

    menu.append(pasteBtn, uploadBtn);
    return menu;
  }

  private deleteMapById(mapId: string): void {
    if (this.manifest.maps.length <= 1) {
      this.setStatus("O editor precisa manter ao menos um mapa configurado.", true);
      this.openMapActionMenuId = null;
      this.render();
      return;
    }

    this.manifest.maps = this.manifest.maps.filter((candidate) => candidate.mapId !== mapId);
    delete this.labelOverrides.maps?.[mapId];
    this.manifest.maps.forEach((candidate) => {
      Object.values(candidate.areas || {}).forEach((area) => {
        if (area.drillToMapId === mapId) {
          delete area.drillToMapId;
          if (area.drillMode === "manual") area.drillMode = "automatic";
        }
      });
    });

    if (this.manifest.defaultMapId === mapId) {
      this.manifest.defaultMapId = this.manifest.maps[0]?.mapId;
    }
    if (this.selectedMapId === mapId) {
      this.selectedMapId = this.manifest.defaultMapId || this.manifest.maps[0]?.mapId || null;
    }

    this.selectedAreaId = null;
    this.openMapActionMenuId = null;
    this.renamingMapId = null;
    this.statusMessage = "";
    this.statusError = false;
    this.syncResult(true);
    this.render();
  }

  private buildBrowserView(shell: HTMLElement): HTMLElement {
    const activeMap = this.getActiveMap();
    const hasConfiguredMap = this.manifest.maps.length > 0 && !!activeMap.svgText;
    const layout = document.createElement("div");
    layout.className = "sp-editor-browser";
    layout.addEventListener("pointerdown", (event) => {
      const target = event.target as Element | null;
      if (!target) return;
      const isInsideFloatingMenu =
        !!target.closest(".sp-editor-map-action-menu") ||
        !!target.closest(".sp-editor-add-map-menu") ||
        !!target.closest("[data-editor-map-menu-trigger='1']") ||
        !!target.closest("[data-editor-add-menu-trigger='1']");
      if (isInsideFloatingMenu) return;
      if (this.closeFloatingMenus()) {
        this.render();
      }
    });

    const sidebar = document.createElement("div");
    sidebar.className = "sp-editor-browser-sidebar";
    const sidebarHeader = document.createElement("div");
    sidebarHeader.className = "sp-editor-browser-header";
    const sidebarLead = document.createElement("div");
    sidebarLead.className = "sp-editor-sidebar-lead";
    sidebarLead.append(this.createIcon("map"));
    const sidebarTitle = document.createElement("h3");
    sidebarTitle.textContent = "Estado";
    sidebarLead.appendChild(sidebarTitle);
    sidebarHeader.appendChild(sidebarLead);
    sidebar.appendChild(sidebarHeader);

    const list = document.createElement("div");
    list.className = "sp-editor-map-list";
    if (this.manifest.maps.length > 0) {
      this.manifest.maps.forEach((map, index) => {
        const item = document.createElement("div");
        item.className = [
          "sp-editor-map-item-shell",
          map.mapId === activeMap.mapId ? "is-active" : "",
          this.openMapActionMenuId === map.mapId ? "is-menu-open" : ""
        ]
          .filter(Boolean)
          .join(" ");
        const selectBtn = document.createElement("button");
        selectBtn.type = "button";
        selectBtn.className = map.mapId === activeMap.mapId ? "sp-editor-map-item is-active" : "sp-editor-map-item";
        const row = document.createElement("div");
        row.className = "sp-editor-list-row";
        row.append(this.createIcon("map"));
        const body = document.createElement("div");
        body.className = "sp-editor-list-body";
        if (this.renamingMapId === map.mapId) {
          const nameInput = document.createElement("input");
          nameInput.className = "sp-editor-input sp-editor-map-rename-input";
          nameInput.value = map.name || map.mapId;
          const commitRename = () => {
            if (this.renamingMapId !== map.mapId) return;
            map.name = nameInput.value.trim() || map.mapId;
            this.renamingMapId = null;
            this.openMapActionMenuId = null;
            this.syncResult(true);
            this.render();
          };
          nameInput.addEventListener("click", (event) => event.stopPropagation());
          nameInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitRename();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              this.renamingMapId = null;
              this.render();
            }
          });
          nameInput.addEventListener("blur", commitRename);
          body.appendChild(nameInput);
          requestAnimationFrame(() => {
            nameInput.focus();
            nameInput.select();
          });
        } else {
          const title = document.createElement("span");
          title.className = "sp-editor-map-item-title";
          title.textContent = map.name || map.mapId;
          body.appendChild(title);
        }
        const meta = document.createElement("span");
        meta.className = "sp-editor-map-item-meta";
        meta.textContent = `${map.mapId}${this.manifest.defaultMapId === map.mapId ? " • padrao" : ""}`;
        body.appendChild(meta);
        row.appendChild(body);
        selectBtn.appendChild(row);
        selectBtn.addEventListener("click", () => {
          this.applyCurrentInputs(shell);
          this.openMapActionMenuId = null;
          this.renamingMapId = null;
          this.selectedMapId = map.mapId;
          this.selectedAreaId = null;
          this.syncResult(false);
          this.render();
        });
        const actionWrap = document.createElement("div");
        actionWrap.className = "sp-editor-map-actions";
        const actionBtn = this.createButton("Acoes do mapa", "overflow", {
          kind: "ghost",
          iconOnly: true,
          ariaLabel: `Acoes do mapa ${map.name || map.mapId}`
        });
        actionBtn.setAttribute("data-editor-map-menu-trigger", "1");
        actionBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.openMapActionMenuId = this.openMapActionMenuId === map.mapId ? null : map.mapId;
          this.addMapMenuOpen = false;
          this.renamingMapId = null;
          this.render();
        });
        actionWrap.appendChild(actionBtn);
        if (this.openMapActionMenuId === map.mapId) {
          const actionMenu = this.buildMapActionMenu(shell, map);
          if (index >= this.manifest.maps.length - 3) {
            actionMenu.classList.add("is-open-up");
          }
          actionWrap.appendChild(actionMenu);
        }
        item.append(selectBtn, actionWrap);
        list.appendChild(item);
      });
      sidebar.appendChild(list);
    }

    const addInput = this.createHiddenFileInput(".svg,image/svg+xml", (text, fileName) => {
      const result = this.createMapFromSvgText(text, fileName);
      if (result.ok === false) {
        this.setStatus(result.error, true);
      } else {
        this.setStatus("Mapa adicionado a partir do arquivo SVG.", false);
      }
      this.render();
    });

    const sidebarActions = document.createElement("div");
    sidebarActions.className = "sp-editor-browser-sidebar-actions";
    const removeBtn = this.createButton("Delete", "delete", { kind: "ghost" });
    removeBtn.disabled = this.manifest.maps.length === 0;
    removeBtn.addEventListener("click", () => {
      if (this.manifest.maps.length > 0) this.deleteMapById(activeMap.mapId);
    });
    const addWrap = document.createElement("div");
    addWrap.className = "sp-editor-add-map-wrap";
    const addBtn = this.createButton("Add", "add", { kind: "primary" });
    addBtn.setAttribute("data-editor-add-menu-trigger", "1");
    addBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.addMapMenuOpen = !this.addMapMenuOpen;
      this.openMapActionMenuId = null;
      this.renamingMapId = null;
      this.render();
    });
    addWrap.appendChild(addBtn);
    if (this.addMapMenuOpen) {
      addWrap.appendChild(this.buildAddMapMenu(addInput));
    }
    sidebarActions.append(removeBtn, addWrap);
    sidebar.appendChild(sidebarActions);
    sidebar.appendChild(addInput);
    layout.appendChild(sidebar);

    const detail = document.createElement("div");
    detail.className = "sp-editor-browser-detail";

    const header = document.createElement("div");
    header.className = "sp-editor-browser-detail-header";
    const heading = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = activeMap.name || activeMap.mapId;
    const subtitle = document.createElement("div");
    subtitle.className = "sp-editor-browser-detail-subtitle";
    subtitle.textContent = `${activeMap.name || activeMap.mapId}.svg`;
    heading.append(title, subtitle);

    const headerActions = document.createElement("div");
    headerActions.className = "sp-editor-actions";
    const drillPathBtn = this.createButton("Drill Path", "metadata", { kind: "secondary" });
    drillPathBtn.addEventListener("click", () => this.openDrillPathEditor(shell, "preview"));
    const drillConfigBtn = this.createButton("Config. Drill", "metadata", { kind: "secondary" });
    drillConfigBtn.addEventListener("click", () => this.openDrillPathEditor(shell, "config"));
    const editBtn = this.createButton("Editar", "edit", { kind: "secondary" });
    editBtn.addEventListener("click", () => {
      this.applyCurrentInputs(shell);
      this.openMapActionMenuId = null;
      this.renamingMapId = null;
      this.addMapMenuOpen = false;
      this.viewMode = "detail";
      this.selectedAreaId = null;
      this.areaSearch = "";
      this.areaListScrollTop = 0;
      this.inspectorTab = "General";
      this.syncResult(false);
      this.render();
    });
    const saveCloseBtn = this.createButton("Save & Close", "edit", { kind: "primary" });
    saveCloseBtn.addEventListener("click", () => this.closeWithPersist(shell));
    if (hasConfiguredMap) {
      headerActions.append(drillPathBtn, drillConfigBtn, editBtn, saveCloseBtn);
    }
    header.append(heading, headerActions);
    detail.appendChild(header);

    const replaceInput = this.createHiddenFileInput(".svg,image/svg+xml", (text) => {
      activeMap.svgText = "data:image/svg+xml;utf8," + encodeURIComponent(text);
      activeMap.areas = {};
      this.labelOverrides.maps = this.labelOverrides.maps || {};
      this.labelOverrides.maps[activeMap.mapId] = {};
      this.selectedAreaId = null;
      this.syncResult(true);
      this.render();
    });
    detail.appendChild(replaceInput);
    const previewWrap = document.createElement("div");
    previewWrap.className = "sp-editor-browser-main";
    if (!hasConfiguredMap) {
      const emptyState = document.createElement("div");
      emptyState.className = "sp-editor-browser-empty";
      const emptyTitle = document.createElement("h3");
      emptyTitle.textContent = "Nenhum mapa configurado";
      const emptyText = document.createElement("div");
      emptyText.className = "sp-editor-browser-detail-subtitle";
      emptyText.textContent = "Adicione um SVG para iniciar o editor de mapas.";
      emptyState.append(emptyTitle, emptyText);
      const centerAddBtn = this.createButton("Colar SVG", "add", { kind: "primary" });
      centerAddBtn.addEventListener("click", () => this.openSvgCreateEditor());
      emptyState.appendChild(centerAddBtn);
      previewWrap.appendChild(emptyState);
    } else {
      previewWrap.appendChild(this.createPreview(activeMap.svgText, { activeMap, compact: true }));
    }
    detail.appendChild(previewWrap);
    layout.appendChild(detail);
    return layout;
  }

  private buildDetailView(shell: HTMLElement): HTMLElement {
    const activeMap = this.getActiveMap();
    const rows = this.getAreaRows(activeMap);
    if (this.selectedAreaId && !rows.some((row) => row.areaId === this.selectedAreaId)) {
      this.selectedAreaId = null;
    }
    const selectedRow = rows.find((row) => row.areaId === this.selectedAreaId) || null;

    const layout = document.createElement("div");
    layout.className = "sp-editor-detail";

    const header = document.createElement("div");
    header.className = "sp-editor-detail-header";
    const breadcrumb = document.createElement("div");
    breadcrumb.className = "sp-editor-detail-breadcrumb";
    const backBtn = this.createButton("Maps", "back", { kind: "secondary" });
    backBtn.addEventListener("click", () => {
      this.applyCurrentInputs(shell);
      this.openMapActionMenuId = null;
      this.renamingMapId = null;
      this.viewMode = "browser";
      this.selectedAreaId = null;
      this.syncResult(false);
      this.render();
    });
    backBtn.setAttribute("data-editor-back", "1");
    const title = document.createElement("h3");
    title.textContent = activeMap.name || activeMap.mapId;
    breadcrumb.append(backBtn, title);

    const headerActions = document.createElement("div");
    headerActions.className = "sp-editor-actions";
    const svgBtn = this.createButton("SVG", "svg", { kind: "secondary" });
    svgBtn.addEventListener("click", () => this.openSvgEditor(shell));
    headerActions.append(svgBtn);
    header.append(breadcrumb, headerActions);
    layout.appendChild(header);

    const main = document.createElement("div");
    main.className = "sp-editor-detail-main";
    const previewPane = document.createElement("div");
    previewPane.className = "sp-editor-detail-preview";
    previewPane.appendChild(
      this.createPreview(activeMap.svgText, {
        activeMap,
        selectedAreaId: selectedRow?.areaId || null,
        interactive: true,
        onSelectArea: (areaId) => {
          this.applyCurrentInputs(shell);
          this.selectedAreaId = areaId;
          this.areaSearch = "";
          this.scrollAreaListToAreaId(areaId, rows);
          this.syncResult(false);
          this.render();
        }
      })
    );
    main.appendChild(previewPane);

    const sidebar = document.createElement("div");
    sidebar.className = "sp-editor-detail-sidebar";
    const searchWrap = document.createElement("div");
    searchWrap.className = "sp-editor-detail-search";
    searchWrap.appendChild(this.createIcon("search"));
    const searchInput = document.createElement("input");
    searchInput.className = "sp-editor-input";
    searchInput.placeholder = "Search...";
    searchInput.setAttribute("data-editor-area-search", "1");
    searchInput.value = this.areaSearch;
    searchInput.addEventListener("input", () => {
      this.pendingAreaSearchSelection = {
        start: searchInput.selectionStart ?? searchInput.value.length,
        end: searchInput.selectionEnd ?? searchInput.value.length
      };
      this.areaSearch = searchInput.value;
      this.areaListScrollTop = 0;
      this.syncResult(false);
      this.render();
    });
    searchWrap.appendChild(searchInput);
    sidebar.appendChild(searchWrap);

    const list = document.createElement("div");
    list.className = "sp-editor-area-list";
    list.setAttribute("data-editor-area-list", "1");
    const filteredRows = rows.filter((row) => {
      const query = norm(this.areaSearch);
      if (!query) return true;
      return [
        row.areaId,
        row.mapArea.displayName,
        row.mapArea.bindKey,
        row.row?.rawKey,
        ...(row.mapArea.aliases || [])
      ]
        .filter(Boolean)
        .some((value) => norm(value).includes(query));
    });
    const virtualInner = document.createElement("div");
    virtualInner.className = "sp-editor-area-list-inner";
    const virtualContent = document.createElement("div");
    virtualContent.className = "sp-editor-area-list-content";
    const rowHeight = 56;
    const renderAreaWindow = () => {
      const viewportHeight = Math.max(list.clientHeight, rowHeight * 4);
      const start = Math.max(0, Math.floor(this.areaListScrollTop / rowHeight) - 4);
      const visibleCount = Math.ceil(viewportHeight / rowHeight) + 8;
      const end = Math.min(filteredRows.length, start + visibleCount);
      virtualInner.style.height = `${filteredRows.length * rowHeight}px`;
      virtualContent.style.transform = `translateY(${start * rowHeight}px)`;
      virtualContent.textContent = "";
      const fragment = document.createDocumentFragment();
      for (let index = start; index < end; index += 1) {
        const row = filteredRows[index];
        const item = document.createElement("div");
        item.className = "sp-editor-area-row";
        item.setAttribute("data-editor-area-id", row.areaId);
        const rowWrap = document.createElement("div");
        rowWrap.className = "sp-editor-list-row";
        const visibilityBtn = this.createButton(row.mapArea.hidden ? "Mostrar area" : "Ocultar area", "eye", {
          kind: "ghost",
          iconOnly: true,
          ariaLabel: row.mapArea.hidden ? `Mostrar area ${row.areaId}` : `Ocultar area ${row.areaId}`
        });
        visibilityBtn.classList.add("sp-editor-area-visibility");
        visibilityBtn.setAttribute("data-hidden", row.mapArea.hidden ? "1" : "0");
        visibilityBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.applyCurrentInputs(shell);
          this.ensureMapCollections(activeMap);
          const area = activeMap.areas![row.areaId] = activeMap.areas![row.areaId] || {};
          area.hidden = !area.hidden || undefined;
          this.syncResult(false);
          this.render();
        });
        rowWrap.appendChild(visibilityBtn);
        const selectBtn = document.createElement("button");
        selectBtn.type = "button";
        selectBtn.className = row.areaId === selectedRow?.areaId ? "sp-editor-area-item is-active" : "sp-editor-area-item";
        const rowBody = document.createElement("div");
        rowBody.className = "sp-editor-list-body";
        const titleEl = document.createElement("span");
        titleEl.className = "sp-editor-map-item-title";
        titleEl.textContent = row.areaId;
        const metaText = row.mapArea.displayName || row.row?.rawKey || row.row?.displayName || "";
        rowBody.appendChild(titleEl);
        if (metaText && metaText !== row.areaId) {
          const metaEl = document.createElement("span");
          metaEl.className = "sp-editor-area-item-meta";
          metaEl.textContent = metaText;
          rowBody.appendChild(metaEl);
        }
        selectBtn.appendChild(rowBody);
        selectBtn.addEventListener("click", () => {
          this.applyCurrentInputs(shell);
          this.selectedAreaId = row.areaId;
          this.syncResult(false);
          this.render();
        });
        rowWrap.appendChild(selectBtn);
        item.appendChild(rowWrap);
        fragment.appendChild(item);
      }
      virtualContent.appendChild(fragment);
    };
    list.addEventListener("scroll", () => {
      this.areaListScrollTop = list.scrollTop;
      renderAreaWindow();
    });
    virtualInner.appendChild(virtualContent);
    list.appendChild(virtualInner);
    requestAnimationFrame(() => {
      list.scrollTop = Math.min(this.areaListScrollTop, Math.max(0, filteredRows.length * rowHeight - list.clientHeight));
      renderAreaWindow();
    });
    sidebar.appendChild(list);

    const inspector = document.createElement("div");
    inspector.className = "sp-editor-inspector";
    if (!selectedRow) {
      const empty = document.createElement("div");
      empty.className = "sp-editor-preview-empty";
      empty.textContent = "Selecione uma area pelo mapa ou pela lista.";
      inspector.appendChild(empty);
    } else {
      this.ensureMapCollections(activeMap);
      const titleWrap = document.createElement("div");
      titleWrap.className = "sp-editor-inspector-title";
      const titleBlock = document.createElement("div");
      titleBlock.className = "sp-editor-inspector-heading";
      const areaTitle = document.createElement("strong");
      areaTitle.textContent = selectedRow.areaId;
      titleBlock.appendChild(areaTitle);
      const areaMetaText = selectedRow.mapArea.displayName || selectedRow.row?.rawKey || selectedRow.row?.displayName || "";
      if (areaMetaText && areaMetaText !== selectedRow.areaId) {
        const areaMeta = document.createElement("span");
        areaMeta.textContent = areaMetaText;
        titleBlock.appendChild(areaMeta);
      }
      titleWrap.appendChild(titleBlock);
      inspector.appendChild(titleWrap);

      const panel = document.createElement("div");
      panel.className = "sp-editor-inspector-panel";
      const bindLabel = document.createElement("label");
      bindLabel.textContent = "Data Point";
      const bindSelect = document.createElement("select");
      bindSelect.className = "sp-editor-select";
      bindSelect.setAttribute("data-editor-area-bind", "1");
      const autoOption = document.createElement("option");
      autoOption.value = "";
      autoOption.textContent = "(Auto Bind)";
      bindSelect.appendChild(autoOption);
      const uniqueBindings = new Map<string, string>();
      Object.values(this.rowsByKey).forEach((row) => {
        const key = (row.rawKey || row.legendRawKey || row.displayName || "").trim();
        if (!key || uniqueBindings.has(key)) return;
        uniqueBindings.set(key, row.displayName || row.rawKey || row.legendRawKey || key);
      });
      Array.from(uniqueBindings.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([value, text]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          option.selected = (selectedRow.mapArea.bindKey || "") === value;
          bindSelect.appendChild(option);
        });
      bindLabel.appendChild(bindSelect);
      panel.appendChild(bindLabel);

      const titleLabel = document.createElement("label");
      titleLabel.textContent = "Title";
      const titleInput = document.createElement("input");
      titleInput.className = "sp-editor-input";
      titleInput.value = selectedRow.mapArea.displayName || "";
      titleInput.setAttribute("data-editor-area-title", "1");
      titleLabel.appendChild(titleInput);
      panel.appendChild(titleLabel);
      inspector.appendChild(panel);
    }
    sidebar.appendChild(inspector);
    main.appendChild(sidebar);
    layout.appendChild(main);

    const footer = document.createElement("div");
    footer.className = "sp-editor-footer";
    const saveBackBtn = this.createButton("Save & Back", "back", { kind: "secondary" });
    saveBackBtn.addEventListener("click", () => {
      this.applyCurrentInputs(shell);
      this.openMapActionMenuId = null;
      this.renamingMapId = null;
      this.viewMode = "browser";
      this.selectedAreaId = null;
      this.syncResult(true);
      this.render();
    });
    const saveCloseBtn = this.createButton("Save & Close", "edit", { kind: "primary" });
    saveCloseBtn.addEventListener("click", () => this.closeWithPersist(shell));
    const closeBtn = this.createButton("Close", "close", { kind: "secondary", noIcon: true });
    closeBtn.addEventListener("click", () => this.host.close(DialogAction.Cancel, this.buildResult(false)));
    const footerActions = document.createElement("div");
    footerActions.className = "sp-editor-footer-actions";
    footerActions.append(closeBtn, saveCloseBtn);
    footer.append(saveBackBtn, footerActions);
    layout.appendChild(footer);
    return layout;
  }
}

export class MapEditorDialog {
  public static id = "SigfarmMapEditorDialog";

  constructor(options: DialogConstructorOptions, initialState: MapEditorDialogInitialState) {
    new MapEditorDialogApp(options.element, options.host, initialState);
  }
}

const dialogRegistry = (globalThis as any).dialogRegistry || ((globalThis as any).dialogRegistry = {});
dialogRegistry[MapEditorDialog.id] = MapEditorDialog;
