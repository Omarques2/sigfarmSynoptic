import powerbi from "powerbi-visuals-api";

import DialogAction = powerbi.DialogAction;
import DialogConstructorOptions = powerbi.extensibility.visual.DialogConstructorOptions;

type MapRegistryArea = {
  id?: string;
  virtualId?: string;
  bindKey?: string;
  displayName?: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
  drillToMapId?: string;
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

type DialogRowLabel = {
  rawKey?: string;
  legendRawKey?: string;
  displayName?: string;
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
  private readonly allowMapUploads: boolean;
  private readonly svgModelCache = new Map<string, CachedSvgModel>();
  private statusMessage = "";
  private statusError = false;
  private metadataEditorOpen = false;
  private svgEditorOpen = false;
  private svgEditorValue = "";
  private svgEditorError = "";
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
    this.inspectorTab = initialState.inspectorTab === "Drill" ? "Drill" : "General";
    this.allowMapUploads = !!initialState.allowMapUploads;
    this.rowsByKey = initialState.rowsByKey || {};

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
    const target = this.root.querySelector<HTMLInputElement>("[data-editor-area-search='1']");
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

    const selectedKey = options.selectedAreaId ? norm(options.selectedAreaId) : null;
    const regions = getEditorAreaElements(cloned);
    for (const region of regions) {
      const areaId = (region as any).id as string;
      if (!areaId) continue;
      const areaOverride = options.activeMap?.areas?.[areaId];
      const isSelected = selectedKey && norm(areaId) === selectedKey;
      const hasSelection = !!selectedKey;
      region.style.cursor = options.interactive ? "pointer" : "default";
      region.style.fill = isSelected ? "#29b6a8" : "#cde9e4";
      region.style.opacity = areaOverride?.hidden ? "0.18" : hasSelection && !isSelected ? "0.48" : "1";
      region.style.stroke = isSelected ? "#3b82f6" : "#7ca9a0";
      region.style.strokeWidth = isSelected ? "2" : "0.75";
      region.style.vectorEffect = "non-scaling-stroke";
      if (options.interactive) {
        region.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          options.onSelectArea?.(areaId);
        });
      }
    }

    const scheduleFit = () => {
      requestAnimationFrame(() => {
        const liveRegions = getEditorAreaElements(cloned);
        const fitBBox = getCombinedRegionBBox(liveRegions);
        if (fitBBox.width > 0 && fitBBox.height > 0) {
          const pad = Math.max(8, Math.min(fitBBox.width, fitBBox.height) * 0.04);
          cloned.setAttribute("viewBox", `${fitBBox.x - pad} ${fitBBox.y - pad} ${fitBBox.width + pad * 2} ${fitBBox.height + pad * 2}`);
        } else if (cloned.hasAttribute("viewBox")) {
          const original = cloned.getAttribute("viewBox");
          if (original) cloned.setAttribute("viewBox", original);
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
    fitBtn.addEventListener("click", resetTransform);
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
    viewport.addEventListener("dblclick", resetTransform);

    stage.appendChild(cloned);
    viewport.appendChild(stage);
    frame.append(viewport, controls);
    applyTransform();
    scheduleFit();
    return frame;
  }

  private tryCopyText(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
    }
    return Promise.resolve(false);
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
    const drillToMapId = shell.querySelector<HTMLSelectElement>("[data-editor-area-drill-map='1']")?.value || "";
    area.drillToMapId = drillToMapId || undefined;
  }

  private applyCurrentInputs(shell: HTMLElement): void {
    if (this.viewMode === "detail") {
      this.applyAreaInputs(shell);
    } else {
      this.applyBrowserInputs(shell);
    }
  }

  private openMetadataEditor(shell: HTMLElement): void {
    this.applyCurrentInputs(shell);
    this.metadataEditorOpen = true;
    this.render();
  }

  private closeMetadataEditor(): void {
    this.metadataEditorOpen = false;
  }

  private buildMetadataOverlay(shell: HTMLElement): HTMLElement {
    const activeMap = this.getActiveMap();
    const overlay = document.createElement("div");
    overlay.className = "sp-editor-overlay";
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        this.closeMetadataEditor();
        this.render();
      }
    });

    const dialog = document.createElement("div");
    dialog.className = "sp-editor-overlay-modal";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const header = document.createElement("div");
    header.className = "sp-editor-overlay-header";
    const title = document.createElement("h3");
    title.textContent = "Metadata";
    const closeBtn = this.createButton("Close", "close", { kind: "ghost", iconOnly: true, ariaLabel: "Fechar metadata" });
    closeBtn.addEventListener("click", () => {
      this.closeMetadataEditor();
      this.render();
    });
    header.append(title, closeBtn);
    dialog.appendChild(header);

    const form = document.createElement("div");
    form.className = "sp-editor-overlay-form";

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Nome do mapa";
    const nameInput = document.createElement("input");
    nameInput.className = "sp-editor-input";
    nameInput.value = activeMap.name || activeMap.mapId;
    nameInput.setAttribute("data-editor-browser-map-name", "1");
    nameLabel.appendChild(nameInput);

    const levelLabel = document.createElement("label");
    levelLabel.textContent = "Nivel do drill";
    const levelInput = document.createElement("input");
    levelInput.className = "sp-editor-input";
    levelInput.type = "number";
    levelInput.value = Number.isFinite(activeMap.level) ? String(activeMap.level) : "";
    levelInput.setAttribute("data-editor-browser-map-level", "1");
    levelLabel.appendChild(levelInput);

    const pathLabel = document.createElement("label");
    pathLabel.textContent = "Drill path";
    const pathInput = document.createElement("input");
    pathInput.className = "sp-editor-input";
    pathInput.placeholder = "ex.: pais > estado > municipio";
    pathInput.value = activeMap.drillPath?.join(" > ") || "";
    pathInput.setAttribute("data-editor-browser-map-path", "1");
    pathLabel.appendChild(pathInput);

    const defaultLabel = document.createElement("label");
    defaultLabel.className = "sp-editor-checkbox";
    const defaultInput = document.createElement("input");
    defaultInput.type = "checkbox";
    defaultInput.checked = this.manifest.defaultMapId === activeMap.mapId;
    defaultInput.setAttribute("data-editor-browser-default", "1");
    defaultLabel.append(defaultInput, document.createTextNode("Usar como mapa padrao"));

    form.append(nameLabel, levelLabel, pathLabel, defaultLabel);
    dialog.appendChild(form);

    const footer = document.createElement("div");
    footer.className = "sp-editor-overlay-footer";
    const applyBtn = this.createButton("Apply", "metadata", { kind: "primary" });
    applyBtn.addEventListener("click", () => {
      this.applyBrowserInputs(dialog);
      this.closeMetadataEditor();
      this.syncResult(true);
      this.render();
    });
    const secondaryCloseBtn = this.createButton("Close", "close", { kind: "secondary" });
    secondaryCloseBtn.addEventListener("click", () => {
      this.closeMetadataEditor();
      this.render();
    });
    footer.append(applyBtn, secondaryCloseBtn);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);
    return overlay;
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
    searchText.textContent = "Editor SVG sanitizado";
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

    const body = this.viewMode === "detail" ? this.buildDetailView(shell) : this.buildBrowserView(shell);
    shell.appendChild(body);

    if (this.statusMessage) {
      const status = document.createElement("div");
      status.className = this.statusError ? "sp-editor-status is-error" : "sp-editor-status";
      status.textContent = this.statusMessage;
      shell.appendChild(status);
    }

    if (this.metadataEditorOpen) {
      shell.appendChild(this.buildMetadataOverlay(shell));
    }

    if (this.svgEditorOpen) {
      shell.appendChild(this.buildSvgEditorOverlay(shell));
    }

    this.root.appendChild(shell);
    this.restoreTransientFocus();
  }

  private buildBrowserView(shell: HTMLElement): HTMLElement {
    const activeMap = this.getActiveMap();
    const hasConfiguredMap = this.manifest.maps.length > 0 && !!activeMap.svgText;
    const layout = document.createElement("div");
    layout.className = "sp-editor-browser";

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
      for (const map of this.manifest.maps) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = map.mapId === activeMap.mapId ? "sp-editor-map-item is-active" : "sp-editor-map-item";
        const row = document.createElement("div");
        row.className = "sp-editor-list-row";
        row.append(this.createIcon("map"));
        const body = document.createElement("div");
        body.className = "sp-editor-list-body";
        const title = document.createElement("span");
        title.className = "sp-editor-map-item-title";
        title.textContent = map.name || map.mapId;
        const meta = document.createElement("span");
        meta.className = "sp-editor-map-item-meta";
        meta.textContent = `${map.mapId}${this.manifest.defaultMapId === map.mapId ? " • padrao" : ""}`;
        body.append(title, meta);
        row.append(body, this.createIcon("overflow"));
        item.appendChild(row);
        item.addEventListener("click", () => {
          this.applyCurrentInputs(shell);
          this.selectedMapId = map.mapId;
          this.selectedAreaId = null;
          this.syncResult(false);
          this.render();
        });
        list.appendChild(item);
      }
      sidebar.appendChild(list);
    }

    const sidebarActions = document.createElement("div");
    sidebarActions.className = "sp-editor-browser-sidebar-actions";
    const removeBtn = this.createButton("Delete", "delete", { kind: "ghost" });
    const addBtn = this.createButton("Add", "add", { kind: "primary" });
    removeBtn.addEventListener("click", () => {
      if (this.manifest.maps.length <= 1) {
        this.setStatus("O editor precisa manter ao menos um mapa configurado.", true);
        this.render();
        return;
      }
      const removedMapId = activeMap.mapId;
      this.manifest.maps = this.manifest.maps.filter((map) => map.mapId !== removedMapId);
      delete this.labelOverrides.maps?.[removedMapId];
      this.manifest.maps.forEach((map) => {
        Object.values(map.areas || {}).forEach((area) => {
          if (area.drillToMapId === removedMapId) delete area.drillToMapId;
        });
      });
      if (this.manifest.defaultMapId === removedMapId) {
        this.manifest.defaultMapId = this.manifest.maps[0]?.mapId;
      }
      this.selectedMapId = this.manifest.defaultMapId || this.manifest.maps[0]?.mapId || null;
      this.statusMessage = "";
      this.statusError = false;
      this.syncResult(true);
      this.render();
    });
    sidebarActions.append(removeBtn, addBtn);
    if (this.allowMapUploads && this.manifest.maps.length > 0) {
      sidebar.appendChild(sidebarActions);
    }

    const addInput = this.createHiddenFileInput(".svg,image/svg+xml", (text, fileName) => {
      const dataUri = "data:image/svg+xml;utf8," + encodeURIComponent(text);
      const base = fileName.replace(/\.[^/.]+$/, "").trim() || "mapa";
      let nextId = norm(base) || "mapa";
      let suffix = 1;
      while (this.manifest.maps.some((map) => map.mapId === nextId)) {
        suffix += 1;
        nextId = `${norm(base)}_${suffix}`;
      }
      this.manifest.maps.push({
        mapId: nextId,
        name: base,
        svgText: dataUri,
        areas: {}
      });
      if (!this.manifest.defaultMapId) this.manifest.defaultMapId = nextId;
      this.selectedMapId = nextId;
      this.syncResult(true);
      this.render();
    });
    addBtn.addEventListener("click", () => addInput.click());
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
    const metadataBtn = this.createButton("Metadata", "metadata", { kind: "secondary" });
    const editBtn = this.createButton("Edit", "edit", { kind: "secondary" });
    const saveCloseBtn = this.createButton("Save & Close", "edit", { kind: "primary" });
    saveCloseBtn.addEventListener("click", () => this.closeWithPersist(shell));
    if (hasConfiguredMap) {
      headerActions.append(metadataBtn, editBtn, saveCloseBtn);
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
    metadataBtn.addEventListener("click", () => this.openMetadataEditor(shell));

    const previewWrap = document.createElement("div");
    previewWrap.className = "sp-editor-browser-main";
    if (!hasConfiguredMap) {
      const emptyState = document.createElement("div");
      emptyState.className = "sp-editor-browser-empty";
      const emptyTitle = document.createElement("h3");
      emptyTitle.textContent = "Nenhum mapa configurado";
      const emptyText = document.createElement("div");
      emptyText.className = "sp-editor-browser-detail-subtitle";
      emptyText.textContent = this.allowMapUploads
        ? "Adicione um SVG para iniciar o editor de mapas."
        : "Mapas novos so podem ser adicionados no Power BI Desktop.";
      emptyState.append(emptyTitle, emptyText);
      if (this.allowMapUploads) {
        const centerAddBtn = this.createButton("Adicionar Mapa", "add", { kind: "primary" });
        centerAddBtn.addEventListener("click", () => addInput.click());
        emptyState.appendChild(centerAddBtn);
      }
      previewWrap.appendChild(emptyState);
    } else {
      previewWrap.appendChild(this.createPreview(activeMap.svgText, { activeMap, compact: true }));
    }
    detail.appendChild(previewWrap);
    editBtn.addEventListener("click", () => {
      this.applyCurrentInputs(shell);
      this.viewMode = "detail";
      this.selectedAreaId = null;
      this.inspectorTab = "General";
      this.syncResult(false);
      this.render();
    });

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
    const metadataBtn = this.createButton("Metadata", "metadata", { kind: "secondary" });
    metadataBtn.addEventListener("click", () => this.openMetadataEditor(shell));
    const exportBtn = this.createButton("Export", "export", { kind: "secondary" });
    exportBtn.addEventListener("click", async () => {
      const ok = await this.tryCopyText(stringifyManifest(this.manifest));
      this.setStatus(ok ? "Manifesto copiado para a area de transferencia." : "Nao foi possivel copiar o manifesto.", !ok);
      this.render();
    });
    headerActions.append(metadataBtn, exportBtn);
    header.append(breadcrumb, headerActions);
    layout.appendChild(header);

    const main = document.createElement("div");
    main.className = "sp-editor-detail-main";
    const previewPane = document.createElement("div");
    previewPane.className = "sp-editor-detail-preview";
    const previewToolbar = document.createElement("div");
    previewToolbar.className = "sp-editor-preview-toolbar";
    const svgBtn = this.createButton("SVG", "svg", { kind: "secondary" });
    svgBtn.addEventListener("click", () => this.openSvgEditor(shell));
    previewToolbar.appendChild(svgBtn);
    previewPane.appendChild(previewToolbar);
    previewPane.appendChild(
      this.createPreview(activeMap.svgText, {
        activeMap,
        selectedAreaId: selectedRow?.areaId || null,
        interactive: true,
        onSelectArea: (areaId) => {
          this.applyCurrentInputs(shell);
          this.selectedAreaId = areaId;
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

      const tabs = document.createElement("div");
      tabs.className = "sp-editor-inspector-tabs";
      (["General", "Drill"] as EditorInspectorTab[]).forEach((tab) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = tab === this.inspectorTab ? "is-active" : "";
        btn.textContent = tab === "Drill" ? "Drill To" : tab;
        btn.addEventListener("click", () => {
          this.applyCurrentInputs(shell);
          this.inspectorTab = tab;
          this.syncResult(false);
          this.render();
        });
        tabs.appendChild(btn);
      });
      inspector.appendChild(tabs);

      const panel = document.createElement("div");
      panel.className = "sp-editor-inspector-panel";
      if (this.inspectorTab === "General") {
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
      } else if (this.inspectorTab === "Drill") {
        const drillLabel = document.createElement("label");
        drillLabel.textContent = "Drill To";
        const drillSelect = document.createElement("select");
        drillSelect.className = "sp-editor-select";
        drillSelect.setAttribute("data-editor-area-drill-map", "1");
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "(Sem override)";
        drillSelect.appendChild(emptyOption);
        this.manifest.maps
          .filter((map) => map.mapId !== activeMap.mapId)
          .forEach((map) => {
            const option = document.createElement("option");
            option.value = map.mapId;
            option.textContent = map.name || map.mapId;
            option.selected = selectedRow.mapArea.drillToMapId === map.mapId;
            drillSelect.appendChild(option);
          });
        drillLabel.appendChild(drillSelect);
        panel.appendChild(drillLabel);
      }
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
