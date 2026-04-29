// src/visual.ts
"use strict";

import "./../style/visual.less";

import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

import DataView = powerbi.DataView;
import DataViewCategorical = powerbi.DataViewCategorical;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;

import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.extensibility.ISelectionId;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;

import VisualObjectInstance = powerbi.VisualObjectInstance;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;


import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualSettings, SvgSettings, LabelsSettings, VisualFormattingSettingsModel } from "./settings";
import { MapEditorDialog } from "./MapEditorDialog";
import type { MapEditorDialogInitialState, MapEditorDialogResult } from "./MapEditorDialog";
import {
  resolveDrillMap,
  validateMapRegistryManifestIssues
} from "./drillMapResolver";
import type {
  DrillMapContext,
  DrillMapResolutionTrace,
  PendingDrillSource,
  ValidationIssue
} from "./drillMapResolver";

// ===== helpers =====
function norm(raw: any): string {
  const s = (raw ?? "").toString().trim().toLowerCase();
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function legendGroupKey(raw: string): string {
  const base = (raw ?? "").toString();
  const trimmed = base.trim();
  return trimmed || base;
}

const UI_STORAGE_KEYS = {
  helpSeen: "sp_help_seen_v1",
  warningDismissedSig: "sp_warning_dismissed_sig_v1",
  lastSvgSig: "sp_last_svg_sig_v1"
};

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(36);
}

type ValueField = { label: string; value: any };
type SelectionSource = "none" | "self" | "external";
type RenderScopeMode = "AllMapAreas" | "DrillDataOnly";
type DrillFocusPhase = "idle" | "mapResolved" | "domInserted" | "stylesApplied" | "focusApplied";
type DrillClickRoute = {
  sourceMapId: string;
  sourceAreaId: string;
  targetMapId: string;
};
type ResolvedMapAreaDefinition = {
  key: string;
  area: MapRegistryArea;
};
type CatRow = {
  key: string;
  rawKey: string;
  legendRawKey: string;
  colorKey: string;
  value: number | null;
  fields: ValueField[];
  identity: ISelectionId;
  idx: number;
  themeColor: string | null;
  nativeFill: string | null;
  fillColor: string;
};
type GradientStats = { min: number; max: number } | null;
type RenderScopeState = {
  active: boolean;
  mode: RenderScopeMode;
  boundIds: Set<string>;
  unboundIds: Set<string>;
  spatialOutlierIds: Set<string>;
};
type ScreenBBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};
type DrillSvgPruneResult = {
  pruned: boolean;
  keptIds: Set<string>;
  removedCount: number;
};
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
type ActiveMapResolution = {
  manifest: MapRegistryManifest;
  map: MapRegistryMap | null;
  svgText: string;
  mapId: string;
};
type CalloutSide = "right" | "left" | "top" | "bottom";
type CalloutPlacement = {
  anchorX: number;
  anchorY: number;
  textX: number;
  textY: number;
  side: CalloutSide;
  textWidth: number;
  textHeight: number;
};
type EditorTabKey = "Mapas" | "Areas" | "Aliases" | "Metadados" | "Drill" | "Labels" | "JSON";
type EditorAreaRow = {
  areaId: string;
  row: CatRow | null;
  mapArea: MapRegistryArea;
  labelOverride: LabelOverride;
};
type EditorViewMode = "browser" | "detail";
type EditorInspectorTab = "General" | "Drill" | "Metadados" | "Labels";

const NATIVE_AREA_COLORS_OBJECT = "nativeAreaColors";
const NATIVE_AREA_COLORS_PROPERTY = "fill";

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (channel: number) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function interpolateHexColor(from: string, to: string, t: number): string {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  if (!start || !end) return to;
  const clampedT = clamp(t, 0, 1);
  return rgbToHex(
    start.r + (end.r - start.r) * clampedT,
    start.g + (end.g - start.g) * clampedT,
    start.b + (end.b - start.b) * clampedT
  );
}

function buildTooltipContent(title: string, fields: ValueField[]): HTMLDivElement {
  const wrapper = document.createElement("div");

  const titleEl = document.createElement("div");
  Object.assign(titleEl.style, {
    fontWeight: "800",
    marginBottom: "10px",
    fontSize: "18px"
  } as CSSStyleDeclaration);
  titleEl.textContent = title;
  wrapper.appendChild(titleEl);

  const rows = fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== "");
  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.style.opacity = ".7";
    empty.textContent = "(sem valores)";
    wrapper.appendChild(empty);
    return wrapper;
  }

  for (const field of rows) {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "grid",
      gridTemplateColumns: "max-content 12px minmax(0, 1fr)",
      alignItems: "start",
      margin: "3px 0",
      columnGap: "0"
    } as CSSStyleDeclaration);

    const label = document.createElement("div");
    label.style.textAlign = "right";
    label.style.color = "#444";
    label.textContent = field.label;

    const spacer = document.createElement("div");

    const valueEl = document.createElement("div");
    Object.assign(valueEl.style, {
      textAlign: "left",
      fontWeight: "600",
      minWidth: "0",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      wordBreak: "break-word"
    } as CSSStyleDeclaration);
    const raw =
      typeof field.value === "number" && isFinite(field.value) ? field.value.toLocaleString() : String(field.value);
    valueEl.textContent = raw;

    row.appendChild(label);
    row.appendChild(spacer);
    row.appendChild(valueEl);
    wrapper.appendChild(row);
  }

  return wrapper;
}

// --- cor/contraste ---
function hexToRgb(hex: string | null | undefined): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const h = hex.replace("#", "");
  const m = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const int = parseInt(m, 16);
  if (isNaN(int) || m.length !== 6) return null;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}
function srgbToLin(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function relLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const R = srgbToLin(rgb.r),
    G = srgbToLin(rgb.g),
    B = srgbToLin(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function bestTextColor(bg: string): { text: string; outline: string } {
  const L = relLuminance(bg);
  return L < 0.5 ? { text: "#FFFFFF", outline: "#000000" } : { text: "#000000", outline: "#FFFFFF" };
}

// --- rótulos ---
type GeometryBBox = { x: number; y: number; width: number; height: number };
type LabelPlacement = { x: number; y: number; fits: boolean };
const SVG_GEOMETRY_SELECTOR = "path, polygon, rect, circle, ellipse";
const POLYLABEL_ANCHOR_VERSION = "polylabel-v3";

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
  const shapes: SVGElement[] = [];
  if (typeof el.matches === "function" && el.matches(SVG_GEOMETRY_SELECTOR)) {
    shapes.push(el);
  }

  shapes.push(...Array.from(el.querySelectorAll<SVGElement>(SVG_GEOMETRY_SELECTOR)));

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

function transformBBoxWithMatrix(bbox: GeometryBBox, matrix: DOMMatrix): GeometryBBox | null {
  const points = [
    { x: bbox.x, y: bbox.y },
    { x: bbox.x + bbox.width, y: bbox.y },
    { x: bbox.x, y: bbox.y + bbox.height },
    { x: bbox.x + bbox.width, y: bbox.y + bbox.height }
  ];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    const x = matrix.a * point.x + matrix.c * point.y + matrix.e;
    const y = matrix.b * point.x + matrix.d * point.y + matrix.f;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
}

function getRegionBBoxInAncestorSpace(el: SVGElement, ancestor: SVGGraphicsElement): GeometryBBox | null {
  const bbox = getRegionBBox(el);
  if (!(bbox.width > 0) || !(bbox.height > 0)) return null;
  const graphicsEl = el as unknown as SVGGraphicsElement;
  if (typeof graphicsEl.getCTM !== "function" || typeof ancestor.getCTM !== "function") return null;

  try {
    const elementCtm = graphicsEl.getCTM();
    const ancestorCtm = ancestor.getCTM();
    if (!elementCtm || !ancestorCtm) return null;
    const localToAncestor = ancestorCtm.inverse().multiply(elementCtm);
    return transformBBoxWithMatrix(bbox, localToAncestor);
  } catch {
    return null;
  }
}

type BoundaryPoint = { x: number; y: number };
type BoundarySegment = { ax: number; ay: number; bx: number; by: number };
type PolylabelCell = { x: number; y: number; h: number; distance: number; max: number };

function pointInPolygon(x: number, y: number, points: BoundaryPoint[]): boolean {
  if (points.length < 3) return false;

  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const pi = points[i];
    const pj = points[j];
    const crosses = pi.y > y !== pj.y > y;
    if (!crosses) continue;

    const denominator = pj.y - pi.y;
    if (Math.abs(denominator) < Number.EPSILON) continue;

    const intersectionX = ((pj.x - pi.x) * (y - pi.y)) / denominator + pi.x;
    if (x < intersectionX) {
      inside = !inside;
    }
  }

  return inside;
}

function geometryContainsPointBySampledBoundary(geometry: SVGElement, x: number, y: number): boolean | null {
  const bbox = getGeometryBBox(geometry);
  if (!(bbox.width > 0) || !(bbox.height > 0)) return null;
  if (x < bbox.x || x > bbox.x + bbox.width || y < bbox.y || y > bbox.y + bbox.height) {
    return false;
  }

  const points = sampleGeometryBoundary(geometry, bbox);
  if (points.length < 3) return null;

  return pointInPolygon(x, y, points);
}

function regionContainsPointStrict(el: SVGElement, x: number, y: number): boolean {
  const geometries = getRegionGeometryElements(el);
  for (const geometry of geometries) {
    let exactResultAvailable = false;
    try {
      const svgGeometry = geometry as unknown as SVGGeometryElement;
      if (typeof svgGeometry.isPointInFill === "function") {
        exactResultAvailable = true;
        if (svgGeometry.isPointInFill({ x, y })) {
          return true;
        }
      }
    } catch {
      exactResultAvailable = false;
      // Use the sampled-boundary fallback below.
    }

    if (exactResultAvailable) {
      continue;
    }

    const sampledContains = geometryContainsPointBySampledBoundary(geometry, x, y);
    if (sampledContains === true) {
      return true;
    }
  }
  return false;
}

function regionContainsPoint(el: SVGElement, x: number, y: number): boolean {
  return regionContainsPointStrict(el, x, y);
}

function labelRectFitsRegion(el: SVGElement, cx: number, cy: number, width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) return regionContainsPoint(el, cx, cy);

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const samplePoints = [
    { x: cx, y: cy },
    { x: cx - halfWidth, y: cy },
    { x: cx + halfWidth, y: cy },
    { x: cx, y: cy - halfHeight },
    { x: cx, y: cy + halfHeight },
    { x: cx - halfWidth, y: cy - halfHeight },
    { x: cx + halfWidth, y: cy - halfHeight },
    { x: cx - halfWidth, y: cy + halfHeight },
    { x: cx + halfWidth, y: cy + halfHeight }
  ];

  return samplePoints.every((point) => regionContainsPoint(el, point.x, point.y));
}

function estimatePlacementClearance(el: SVGElement, x: number, y: number, bbox: GeometryBBox): number {
  const baseStep = Math.max(2, Math.min(bbox.width, bbox.height) / 24);
  const maxRadius = Math.max(baseStep, Math.min(bbox.width, bbox.height) / 2);
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 0.7071, y: 0.7071 },
    { x: 0.7071, y: -0.7071 },
    { x: -0.7071, y: 0.7071 },
    { x: -0.7071, y: -0.7071 }
  ];

  let clearance = 0;
  for (let radius = baseStep; radius <= maxRadius; radius += baseStep) {
    const isInsideRing = directions.every((dir) => regionContainsPoint(el, x + dir.x * radius, y + dir.y * radius));
    if (!isInsideRing) break;
    clearance = radius;
  }
  return clearance;
}

function pointToSegmentDistanceSq(px: number, py: number, segment: BoundarySegment): number {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  if (dx === 0 && dy === 0) {
    const pointDx = px - segment.ax;
    const pointDy = py - segment.ay;
    return pointDx * pointDx + pointDy * pointDy;
  }

  const t = Math.max(0, Math.min(1, ((px - segment.ax) * dx + (py - segment.ay) * dy) / (dx * dx + dy * dy)));
  const x = segment.ax + t * dx;
  const y = segment.ay + t * dy;
  const pointDx = px - x;
  const pointDy = py - y;
  return pointDx * pointDx + pointDy * pointDy;
}

function sampleGeometryBoundary(geometry: SVGElement, bbox: GeometryBBox): BoundaryPoint[] {
  const svgGeometry = geometry as unknown as SVGGeometryElement;
  if (typeof svgGeometry.getTotalLength !== "function" || typeof svgGeometry.getPointAtLength !== "function") {
    return [];
  }

  try {
    const totalLength = svgGeometry.getTotalLength();
    if (!(totalLength > 0)) return [];

    const diagonal = Math.max(1, Math.hypot(bbox.width, bbox.height));
    const targetStep = Math.max(diagonal / 96, totalLength / 192, 0.5);
    const steps = Math.max(12, Math.min(192, Math.ceil(totalLength / targetStep)));
    const points: BoundaryPoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const point = svgGeometry.getPointAtLength((totalLength * i) / steps);
      points.push({ x: point.x, y: point.y });
    }
    return points;
  } catch {
    return [];
  }
}

function getBoundarySegments(el: SVGElement): BoundarySegment[] {
  const segments: BoundarySegment[] = [];
  for (const geometry of getRegionGeometryElements(el)) {
    const bbox = getGeometryBBox(geometry);
    if (!(bbox.width > 0) || !(bbox.height > 0)) continue;

    const points = sampleGeometryBoundary(geometry, bbox);
    if (points.length >= 2) {
      for (let i = 1; i < points.length; i++) {
        segments.push({ ax: points[i - 1].x, ay: points[i - 1].y, bx: points[i].x, by: points[i].y });
      }
      continue;
    }

    segments.push(
      { ax: bbox.x, ay: bbox.y, bx: bbox.x + bbox.width, by: bbox.y },
      { ax: bbox.x + bbox.width, ay: bbox.y, bx: bbox.x + bbox.width, by: bbox.y + bbox.height },
      { ax: bbox.x + bbox.width, ay: bbox.y + bbox.height, bx: bbox.x, by: bbox.y + bbox.height },
      { ax: bbox.x, ay: bbox.y + bbox.height, bx: bbox.x, by: bbox.y }
    );
  }
  return segments;
}

function distanceToBoundary(x: number, y: number, segments: BoundarySegment[]): number {
  if (!segments.length) return 0;
  let minDistanceSq = Number.POSITIVE_INFINITY;
  for (const segment of segments) {
    minDistanceSq = Math.min(minDistanceSq, pointToSegmentDistanceSq(x, y, segment));
  }
  return Math.sqrt(minDistanceSq);
}

function createPolylabelCell(
  el: SVGElement,
  segments: BoundarySegment[],
  x: number,
  y: number,
  h: number
): PolylabelCell | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const inside = regionContainsPointStrict(el, x, y);
  const distance = inside ? distanceToBoundary(x, y, segments) : -distanceToBoundary(x, y, segments);
  return { x, y, h, distance, max: distance + h * Math.SQRT2 };
}

function findPolylabelAnchor(el: SVGElement): LabelPlacement | null {
  const bbox = getRegionBBox(el);
  if (!(bbox.width > 0) || !(bbox.height > 0)) return null;

  const segments = getBoundarySegments(el);
  if (!segments.length) return null;

  const minSide = Math.min(bbox.width, bbox.height);
  const precision = Math.max(0.25, minSide / 128);
  let best: PolylabelCell | null = null;

  const consider = (cell: PolylabelCell | null) => {
    if (!cell || cell.distance < 0) return;
    if (!best || cell.distance > best.distance) best = cell;
  };

  consider(createPolylabelCell(el, segments, bbox.x + bbox.width / 2, bbox.y + bbox.height / 2, 0));
  for (const geometry of getRegionGeometryElements(el)) {
    const shapeBBox = getGeometryBBox(geometry);
    if (shapeBBox.width > 0 && shapeBBox.height > 0) {
      consider(createPolylabelCell(el, segments, shapeBBox.x + shapeBBox.width / 2, shapeBBox.y + shapeBBox.height / 2, 0));
    }
  }

  const cellSize = minSide;
  let h = cellSize / 2;
  const queue: PolylabelCell[] = [];
  for (let x = bbox.x; x < bbox.x + bbox.width; x += cellSize) {
    for (let y = bbox.y; y < bbox.y + bbox.height; y += cellSize) {
      const cell = createPolylabelCell(el, segments, x + h, y + h, h);
      if (cell) {
        queue.push(cell);
        consider(cell);
      }
    }
  }

  let iterations = 0;
  while (queue.length && best && iterations < 384) {
    queue.sort((a, b) => b.max - a.max);
    const cell = queue.shift()!;
    if (cell.max - best.distance <= precision) continue;

    h = cell.h / 2;
    const children = [
      createPolylabelCell(el, segments, cell.x - h, cell.y - h, h),
      createPolylabelCell(el, segments, cell.x + h, cell.y - h, h),
      createPolylabelCell(el, segments, cell.x - h, cell.y + h, h),
      createPolylabelCell(el, segments, cell.x + h, cell.y + h, h)
    ];
    for (const child of children) {
      if (!child) continue;
      consider(child);
      if (best && child.max - best.distance > precision) {
        queue.push(child);
      }
    }
    iterations++;
  }

  return best ? { x: best.x, y: best.y, fits: false } : null;
}

function findInteriorLabelAnchor(el: SVGElement): LabelPlacement | null {
  const bbox = getRegionBBox(el);
  if (!(bbox.width > 0) || !(bbox.height > 0)) return null;

  type Candidate = { x: number; y: number; score: number };
  let best: Candidate | null = null;
  const bboxCenterX = bbox.x + bbox.width / 2;
  const bboxCenterY = bbox.y + bbox.height / 2;
  const maxCenterDistance = Math.max(1, Math.hypot(bbox.width, bbox.height) / 2);

  const evaluate = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !regionContainsPoint(el, x, y)) return;
    const clearance = estimatePlacementClearance(el, x, y, bbox);
    const centerDistance = Math.hypot(x - bboxCenterX, y - bboxCenterY) / maxCenterDistance;
    const score = clearance * 1000 - centerDistance;
    if (!best || score > best.score) {
      best = { x, y, score };
    }
  };

  const scanBox = (scanBBox: GeometryBBox, divisions: number) => {
    if (!(scanBBox.width > 0) || !(scanBBox.height > 0)) return;
    for (let row = 0; row <= divisions; row++) {
      for (let col = 0; col <= divisions; col++) {
        evaluate(scanBBox.x + (scanBBox.width * col) / divisions, scanBBox.y + (scanBBox.height * row) / divisions);
      }
    }
  };

  evaluate(bboxCenterX, bboxCenterY);
  scanBox(bbox, 10);

  for (const geometry of getRegionGeometryElements(el)) {
    const shapeBBox = getGeometryBBox(geometry);
    evaluate(shapeBBox.x + shapeBBox.width / 2, shapeBBox.y + shapeBBox.height / 2);
    scanBox(shapeBBox, 8);
  }

  return best ? { x: best.x, y: best.y, fits: false } : null;
}

function getInteriorLabelAnchor(el: SVGElement): LabelPlacement | null {
  const cachedVersion = el.getAttribute("data-sp-label-anchor-version");
  const cachedX = Number(el.getAttribute("data-sp-label-anchor-x"));
  const cachedY = Number(el.getAttribute("data-sp-label-anchor-y"));
  if (
    cachedVersion === POLYLABEL_ANCHOR_VERSION &&
    Number.isFinite(cachedX) &&
    Number.isFinite(cachedY) &&
    regionContainsPoint(el, cachedX, cachedY)
  ) {
    return { x: cachedX, y: cachedY, fits: false };
  }

  const anchor = findPolylabelAnchor(el) || findInteriorLabelAnchor(el);
  if (!anchor) {
    el.removeAttribute("data-sp-label-anchor-version");
    el.removeAttribute("data-sp-label-anchor-x");
    el.removeAttribute("data-sp-label-anchor-y");
    return null;
  }
  el.setAttribute("data-sp-label-anchor-version", POLYLABEL_ANCHOR_VERSION);
  el.setAttribute("data-sp-label-anchor-x", String(anchor.x));
  el.setAttribute("data-sp-label-anchor-y", String(anchor.y));
  return anchor;
}

function findLabelPlacement(el: SVGElement, labelWidth: number, labelHeight: number): LabelPlacement {
  const bbox = getRegionBBox(el);
  const interiorFallback = getInteriorLabelAnchor(el);
  const fallback = interiorFallback || {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
    fits: false
  };

  if (!(bbox.width > 0) || !(bbox.height > 0)) return fallback;

  type Candidate = { x: number; y: number; fits: boolean; score: number };

  const evaluateCandidate = (x: number, y: number): Candidate | null => {
    if (!regionContainsPoint(el, x, y)) return null;
    const fits = labelRectFitsRegion(el, x, y, labelWidth, labelHeight);
    const clearance = estimatePlacementClearance(el, x, y, bbox);
    return {
      x,
      y,
      fits,
      score: (fits ? 1_000_000 : 0) + clearance
    };
  };

  let best = evaluateCandidate(fallback.x, fallback.y);
  const geometries = getRegionGeometryElements(el);
  for (const geometry of geometries) {
    const shapeBBox = getGeometryBBox(geometry);
    const candidate = evaluateCandidate(shapeBBox.x + shapeBBox.width / 2, shapeBBox.y + shapeBBox.height / 2);
    if (candidate && (!best || candidate.score > best.score)) best = candidate;
  }

  const scanAround = (centerX: number, centerY: number, spanX: number, spanY: number, divisions: number) => {
    for (let row = 0; row <= divisions; row++) {
      for (let col = 0; col <= divisions; col++) {
        const x = centerX - spanX / 2 + (spanX * col) / divisions;
        const y = centerY - spanY / 2 + (spanY * row) / divisions;
        const candidate = evaluateCandidate(x, y);
        if (candidate && (!best || candidate.score > best.score)) {
          best = candidate;
        }
      }
    }
  };

  scanAround(fallback.x, fallback.y, bbox.width, bbox.height, 12);
  if (best) {
    scanAround(best.x, best.y, Math.max(labelWidth * 2, bbox.width / 3), Math.max(labelHeight * 2, bbox.height / 3), 10);
    scanAround(best.x, best.y, Math.max(labelWidth, bbox.width / 6), Math.max(labelHeight, bbox.height / 6), 8);
  }

  return best || fallback;
}

function upsertLabel(el: SVGElement, text: string, fillColorForContrast: string, cfg: SvgSettings, simplePlacement = false) {
  const bbox = getRegionBBox(el);

  let t = el.parentNode?.querySelector(
    "text.sp-label[data-for='" + (el as any).id + "']"
  ) as SVGTextElement | null;
  if (!t) {
    t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.classList.add("sp-label");
    t.setAttribute("data-for", (el as any).id || "");
    (t as any).style.pointerEvents = "none";
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "central");
    el.parentNode?.appendChild(t);
  }

  const min = Math.max(6, Number(cfg.labelMin) || 9);
  const max = Math.max(min, Number(cfg.labelMax) || 26);
  const rawSize = Math.min(0.5 * (bbox?.height ?? 20), 0.35 * Math.max(bbox?.width ?? 20, 20));
  let fontSize = Math.max(min, Math.min(rawSize, max));

  t.setAttribute("font-weight", cfg.labelBold ? "700" : "400");
  t.textContent = text;

  const c = bestTextColor(fillColorForContrast);
  t.setAttribute("fill", c.text);
  const factor = Math.max(0, Number(cfg.labelOutlineFactor) || 0.12);
  t.setAttribute("stroke", c.outline);
  t.setAttribute("stroke-width", String(Math.max(0, Math.round(fontSize * factor))));
  t.setAttribute("vector-effect", "non-scaling-stroke");
  t.setAttribute("paint-order", "stroke");
  (t as any).style.display = "";

  if (simplePlacement) {
    const strokeWidth = Math.max(0, Math.round(fontSize * factor));
    const placement = getInteriorLabelAnchor(el) || {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2,
      fits: false
    };
    t.setAttribute("font-size", String(fontSize));
    t.setAttribute("stroke-width", String(strokeWidth));
    t.setAttribute("data-sp-base-font-size", String(fontSize));
    t.setAttribute("data-sp-base-stroke-width", String(strokeWidth));
    t.setAttribute("x", String(placement.x));
    t.setAttribute("y", String(placement.y));
    return;
  }

  let bestPlacement: LabelPlacement = {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
    fits: false
  };

  for (let size = fontSize; size >= min; size -= 1) {
    t.setAttribute("font-size", String(size));
    t.setAttribute("stroke-width", String(Math.max(0, Math.round(size * factor))));
    const measured = getGeometryBBox(t);
    const placement = findLabelPlacement(el, measured.width, measured.height);
    bestPlacement = placement;
    fontSize = size;
    if (placement.fits || size === min) break;
  }

  t.setAttribute("font-size", String(fontSize));
  const finalStrokeWidth = Math.max(0, Math.round(fontSize * factor));
  t.setAttribute("stroke-width", String(finalStrokeWidth));
  t.setAttribute("data-sp-base-font-size", String(fontSize));
  t.setAttribute("data-sp-base-stroke-width", String(finalStrokeWidth));
  t.setAttribute("x", String(bestPlacement.x));
  t.setAttribute("y", String(bestPlacement.y));
}
function getLabel(el: SVGElement): SVGTextElement | null {
  return (el.parentNode?.querySelector(
    "text.sp-label[data-for='" + (el as any).id + "']"
  ) as SVGTextElement) || null;
}
function removeLabel(el: SVGElement) {
  const lab = getLabel(el);
  if (lab) lab.remove();
}

// --- tooltip leve (HTML) ---
// IMPORTANTE: agora é position: fixed, para NÃO ser clipado pelo overflow:hidden do container.
function makeTooltipHost(container: HTMLElement): HTMLDivElement {
  let tip = container.querySelector<HTMLDivElement>(".sp-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "sp-tooltip";
    Object.assign(tip.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      pointerEvents: "none",
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.15)",
      boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
      borderRadius: "8px",
      padding: "12px 14px",
      fontFamily: "Segoe UI, -apple-system, Roboto, Arial, sans-serif",
      fontSize: "16px",
      lineHeight: "1.35",
      color: "#111",
      zIndex: "999999",
      display: "none",
      maxWidth: "520px",
      minWidth: "220px",
      // wrap para garantir quebra de linha
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      wordBreak: "break-word"
    } as CSSStyleDeclaration);
    container.appendChild(tip);
  }
  return tip;
}

// --- Data URI utils ---
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

// --- SVG sanitization (security) ---
type SanitizationReport = {
  removedTags: Record<string, number>;
  removedAttrs: Record<string, number>;
  removedStyleParts: number;
};

type UiLanguage = "pt" | "en";

function resolveLanguage(pref: string | undefined | null): UiLanguage {
  if (pref === "pt" || pref === "en") return pref;
  try {
    const sys = (navigator.language || "en").toLowerCase();
    return sys.startsWith("pt") ? "pt" : "en";
  } catch {
    return "en";
  }
}

function createSanitizationReport(): SanitizationReport {
  return {
    removedTags: {},
    removedAttrs: {},
    removedStyleParts: 0
  };
}

function bumpRecord(record: Record<string, number>, key: string) {
  const k = key.toLowerCase();
  record[k] = (record[k] || 0) + 1;
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
      bumpRecord(report.removedAttrs, lower);
      continue;
    }
    if (lower === "href" || lower === "xlink:href") {
      const tag = el.tagName.toLowerCase();
      if (tag !== "image" || !isSafeImageHref(value)) {
        el.removeAttribute(name);
        bumpRecord(report.removedAttrs, lower);
      }
      continue;
    }
    if (lower === "style") {
      const safe = sanitizeStyleValue(value, report);
      if (safe) {
        el.setAttribute(name, safe);
      } else {
        el.removeAttribute(name);
        bumpRecord(report.removedAttrs, lower);
      }
      continue;
    }
    if (isUnsafeAttrValue(value)) {
      el.removeAttribute(name);
      bumpRecord(report.removedAttrs, lower);
      continue;
    }
    if (URL_ATTRS.has(lower) && !isSafeUrlRef(value)) {
      el.removeAttribute(name);
      bumpRecord(report.removedAttrs, lower);
      continue;
    }
    if (!ALLOWED_SVG_ATTRS.has(lower) && !lower.startsWith("data-") && !lower.startsWith("aria-")) {
      el.removeAttribute(name);
      bumpRecord(report.removedAttrs, lower);
    }
  }

  const children = Array.from(el.children);
  for (const child of children) {
    const tag = child.tagName.toLowerCase();
    if (!ALLOWED_SVG_TAGS.has(tag)) {
      child.remove();
      bumpRecord(report.removedTags, tag);
      continue;
    }
    sanitizeSvgElement(child, report);
  }
}

function sanitizeSvgDocument(doc: Document): { svg: SVGSVGElement | null; report: SanitizationReport } {
  const report = createSanitizationReport();
  if (doc.querySelector("parsererror")) return { svg: null, report };
  const svg = doc.querySelector("svg");
  if (!svg) return { svg: null, report };
  sanitizeSvgElement(svg, report);
  return { svg: svg as SVGSVGElement, report };
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function extractColorValue(v: any): string | undefined {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (typeof v !== "object") return undefined;

  const solid = (v as any).solid;
  if (solid) {
    if (typeof solid.color === "string") return solid.color;
    if (typeof solid.color?.value === "string") return solid.color.value;
  }

  if (typeof (v as any).color === "string") return (v as any).color;
  if (typeof (v as any).color?.value === "string") return (v as any).color.value;
  if (typeof (v as any).value === "string") return (v as any).value;

  return undefined;
}

function tryGetFillColorFromObjects(objects: any, objectName: string, prop: string): string | undefined {
  try {
    if (!objects || typeof objects !== "object") return undefined;

    const directObj = (objects as any)[objectName];
    const direct = extractColorValue(directObj?.[prop]);
    if (direct) return direct;

    const instMap = directObj?.$instances;
    if (instMap && typeof instMap === "object") {
      for (const inst of Object.values(instMap as Record<string, any>)) {
        const c = extractColorValue((inst as any)?.[prop]);
        if (c) return c;
      }
    }

    const rootDirect = extractColorValue((objects as any)[prop]);
    if (rootDirect) return rootDirect;

    const rootInst = (objects as any).$instances;
    if (rootInst && typeof rootInst === "object") {
      for (const inst of Object.values(rootInst as Record<string, any>)) {
        const c = extractColorValue((inst as any)?.[prop]);
        if (c) return c;
      }
    }

    // Fallback: scan any object for the property (covers cases where objectName differs)
    for (const obj of Object.values(objects as Record<string, any>)) {
      if (!obj || typeof obj !== "object") continue;
      if (prop in obj) {
        const c = extractColorValue((obj as any)[prop]);
        if (c) return c;
      }
      const objInst = (obj as any)?.$instances;
      if (objInst && typeof objInst === "object") {
        for (const inst of Object.values(objInst as Record<string, any>)) {
          const c = extractColorValue((inst as any)?.[prop]);
          if (c) return c;
        }
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function tryGetSelectionIdSelector(selectionId: ISelectionId | null | undefined): powerbi.data.Selector | undefined {
  try {
    const selector = (selectionId as any)?.getSelector?.();
    return selector && typeof selector === "object" ? selector : undefined;
  } catch {
    return undefined;
  }
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

function stringifyManifest(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function cloneJsonObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getCalloutLabel(el: SVGElement): SVGGElement | null {
  return (el.parentNode?.querySelector(
    "g.sp-callout-label[data-for='" + (el as any).id + "']"
  ) as SVGGElement) || null;
}

function removeCalloutLabel(el: SVGElement) {
  const lab = getCalloutLabel(el);
  if (lab) lab.remove();
}

function getRowLabelText(row: CatRow, labelContent: string): string {
  const valueText = row.value === null || row.value === undefined ? "" : Math.round(row.value).toString();
  const categoryText = row.legendRawKey || row.rawKey;
  if (labelContent === "Category") return categoryText;
  if (labelContent === "CategoryAndValue") return valueText ? `${categoryText}: ${valueText}` : categoryText;
  return valueText;
}

function getAllowedCalloutSides(cfg: LabelsSettings): CalloutSide[] {
  const sides: CalloutSide[] = [];
  if (cfg.calloutAllowRight) sides.push("right");
  if (cfg.calloutAllowLeft) sides.push("left");
  if (cfg.calloutAllowTop) sides.push("top");
  if (cfg.calloutAllowBottom) sides.push("bottom");
  return sides.length > 0 ? sides : ["right"];
}

function sideDistance(side: CalloutSide, anchorX: number, anchorY: number, mapBBox: GeometryBBox): number {
  if (side === "right") return Math.abs(mapBBox.x + mapBBox.width - anchorX);
  if (side === "left") return Math.abs(anchorX - mapBBox.x);
  if (side === "top") return Math.abs(anchorY - mapBBox.y);
  return Math.abs(mapBBox.y + mapBBox.height - anchorY);
}

function resolveCalloutSide(
  anchorX: number,
  anchorY: number,
  mapBBox: GeometryBBox,
  cfg: LabelsSettings,
  override?: LabelOverride | MapRegistryArea
): CalloutSide {
  const overrideSide = override?.calloutSide;
  if (overrideSide === "right" || overrideSide === "left" || overrideSide === "top" || overrideSide === "bottom") {
    return overrideSide;
  }

  const candidates = getAllowedCalloutSides(cfg);
  return candidates.reduce((best, side) =>
    sideDistance(side, anchorX, anchorY, mapBBox) < sideDistance(best, anchorX, anchorY, mapBBox) ? side : best
  );
}

function computeCalloutLayout(
  el: SVGElement,
  textWidth: number,
  textHeight: number,
  cfg: LabelsSettings,
  mapBBox: GeometryBBox,
  override?: LabelOverride | MapRegistryArea
): CalloutPlacement {
  const bbox = getRegionBBox(el);
  const areaAnchor = (override as MapRegistryArea | undefined)?.labelAnchor;
  const labelAnchor = (override as LabelOverride | undefined)?.anchor;
  const anchor = areaAnchor || labelAnchor;
  const anchorX = Number.isFinite(anchor?.x) ? Number(anchor?.x) : bbox.x + bbox.width / 2;
  const anchorY = Number.isFinite(anchor?.y) ? Number(anchor?.y) : bbox.y + bbox.height / 2;
  const side = resolveCalloutSide(anchorX, anchorY, mapBBox, cfg, override);
  const distance = Math.max(8, Number(cfg.calloutDistance) || 36);
  const offsetX = Number.isFinite(override?.calloutOffsetX) ? Number(override?.calloutOffsetX) : 0;
  const offsetY = Number.isFinite(override?.calloutOffsetY) ? Number(override?.calloutOffsetY) : 0;

  if (side === "left") return { anchorX, anchorY, textX: mapBBox.x - distance - textWidth / 2 + offsetX, textY: anchorY + offsetY, side, textWidth, textHeight };
  if (side === "top") return { anchorX, anchorY, textX: anchorX + offsetX, textY: mapBBox.y - distance - textHeight / 2 + offsetY, side, textWidth, textHeight };
  if (side === "bottom") return { anchorX, anchorY, textX: anchorX + offsetX, textY: mapBBox.y + mapBBox.height + distance + textHeight / 2 + offsetY, side, textWidth, textHeight };
  return { anchorX, anchorY, textX: mapBBox.x + mapBBox.width + distance + textWidth / 2 + offsetX, textY: anchorY + offsetY, side, textWidth, textHeight };
}

function resolveCalloutTextAnchor(side: CalloutSide, textAlign: string): "start" | "middle" | "end" {
  if (textAlign === "Center") return "middle";
  if (textAlign === "Right") return "end";
  if (textAlign === "Left") return "start";
  if (side === "left") return "end";
  if (side === "right") return "start";
  return "middle";
}

function resolveCalloutTextAlignValue(
  cfg: LabelsSettings,
  override?: LabelOverride | MapRegistryArea
): string {
  const candidate = (override as LabelOverride | undefined)?.textAlign;
  return candidate === "Center" || candidate === "Right" || candidate === "Left" ? candidate : cfg.calloutTextAlign;
}

function getCalloutHorizontalBounds(
  textX: number,
  textWidth: number,
  anchor: "start" | "middle" | "end"
): { left: number; right: number } {
  if (anchor === "start") return { left: textX, right: textX + textWidth };
  if (anchor === "end") return { left: textX - textWidth, right: textX };
  return { left: textX - textWidth / 2, right: textX + textWidth / 2 };
}

function getCalloutEndpoint(
  placement: CalloutPlacement,
  cfg: LabelsSettings,
  override?: LabelOverride | MapRegistryArea
): { x: number; y: number } {
  const pad = 4;
  const align = resolveCalloutTextAnchor(placement.side, resolveCalloutTextAlignValue(cfg, override));
  const horizontalBounds = getCalloutHorizontalBounds(placement.textX, placement.textWidth, align);
  if (placement.side === "right") return { x: horizontalBounds.left - pad, y: placement.textY };
  if (placement.side === "left") return { x: horizontalBounds.right + pad, y: placement.textY };
  if (placement.side === "top") return { x: clamp(placement.textX, horizontalBounds.left, horizontalBounds.right), y: placement.textY + placement.textHeight / 2 + pad };
  return { x: clamp(placement.textX, horizontalBounds.left, horizontalBounds.right), y: placement.textY - placement.textHeight / 2 - pad };
}

function buildCalloutConnectorPath(
  placement: CalloutPlacement,
  cfg: LabelsSettings,
  override?: LabelOverride | MapRegistryArea
): string {
  const end = getCalloutEndpoint(placement, cfg, override);
  if (cfg.calloutRouteStyle === "Straight") {
    return `M ${placement.anchorX} ${placement.anchorY} L ${end.x} ${end.y}`;
  }

  const curve = Math.max(4, Number(cfg.calloutCurveSize) || 22);
  const deltaX = end.x - placement.anchorX;
  const deltaY = end.y - placement.anchorY;

  if (placement.side === "right" || placement.side === "left") {
    if (Math.abs(deltaY) <= 0.5) {
      return `M ${placement.anchorX} ${placement.anchorY} L ${end.x} ${end.y}`;
    }

    const radius = Math.min(curve, Math.abs(deltaY), Math.abs(deltaX));
    const cornerY = end.y;
    const verticalEndY = cornerY - Math.sign(deltaY) * radius;
    const horizontalStartX = placement.anchorX + Math.sign(deltaX) * radius;
    return [
      `M ${placement.anchorX} ${placement.anchorY}`,
      `L ${placement.anchorX} ${verticalEndY}`,
      `Q ${placement.anchorX} ${cornerY} ${horizontalStartX} ${cornerY}`,
      `L ${end.x} ${end.y}`
    ].join(" ");
  }

  if (Math.abs(deltaX) <= 0.5) {
    return `M ${placement.anchorX} ${placement.anchorY} L ${end.x} ${end.y}`;
  }

  const radius = Math.min(curve, Math.abs(deltaX), Math.abs(deltaY));
  const cornerX = end.x;
  const horizontalEndX = cornerX - Math.sign(deltaX) * radius;
  const verticalStartY = placement.anchorY + Math.sign(deltaY) * radius;
  return [
    `M ${placement.anchorX} ${placement.anchorY}`,
    `L ${horizontalEndX} ${placement.anchorY}`,
    `Q ${cornerX} ${placement.anchorY} ${cornerX} ${verticalStartY}`,
    `L ${end.x} ${end.y}`
  ].join(" ");
}

function upsertCalloutLabel(
  el: SVGElement,
  text: string,
  cfg: SvgSettings,
  labelCfg: LabelsSettings,
  inHighContrast: boolean,
  hcPalette: { foreground: string; background: string; foregroundSelected: string } | null,
  mapBBox: GeometryBBox,
  override?: LabelOverride | MapRegistryArea
) {
  let g = getCalloutLabel(el);
  if (!g) {
    g = document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement;
    g.classList.add("sp-callout-label");
    g.setAttribute("data-for", (el as any).id || "");
    (g as any).style.pointerEvents = "none";
    el.parentNode?.appendChild(g);
  }
  g.textContent = "";

  const fontSize = Math.max(Math.max(6, Number(cfg.labelMin) || 9), Math.min(Number(cfg.labelMax) || 26, 14));
  const textWidth = Math.max(24, text.length * fontSize * 0.58);
  const textHeight = fontSize * 1.25;
  const placement = computeCalloutLayout(el, textWidth, textHeight, labelCfg, mapBBox, override);
  const resolvedTextAlign = resolveCalloutTextAlignValue(labelCfg, override);
  g.setAttribute("data-anchor-x", String(placement.anchorX));
  g.setAttribute("data-anchor-y", String(placement.anchorY));
  g.setAttribute("data-side", placement.side);
  g.setAttribute("data-text-width", String(placement.textWidth));
  g.setAttribute("data-text-height", String(placement.textHeight));
  g.setAttribute("data-text-align", resolvedTextAlign);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", inHighContrast && hcPalette ? hcPalette.foreground : labelCfg.calloutLineColor);
  line.setAttribute("stroke-width", String(Math.max(1, Number(labelCfg.calloutLineWidth) || 1)));
  line.setAttribute("vector-effect", "non-scaling-stroke");
  line.setAttribute("d", buildCalloutConnectorPath(placement, labelCfg, override));

  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.classList.add("sp-label");
  t.setAttribute("data-for", (el as any).id || "");
  t.setAttribute("x", String(placement.textX));
  t.setAttribute("y", String(placement.textY));
  t.setAttribute("text-anchor", resolveCalloutTextAnchor(placement.side, resolvedTextAlign));
  t.setAttribute("dominant-baseline", "central");
  t.setAttribute("font-size", String(fontSize));
  t.setAttribute("font-weight", cfg.labelBold ? "700" : "400");
  t.setAttribute("fill", inHighContrast && hcPalette ? hcPalette.foreground : labelCfg.calloutTextColor);
  t.setAttribute("stroke", inHighContrast && hcPalette ? hcPalette.background : "#FFFFFF");
  const strokeWidth = Math.max(0, Math.round(fontSize * Math.max(0, Number(cfg.labelOutlineFactor) || 0.12)));
  t.setAttribute("stroke-width", String(strokeWidth));
  t.setAttribute("vector-effect", "non-scaling-stroke");
  t.setAttribute("data-sp-base-font-size", String(fontSize));
  t.setAttribute("data-sp-base-stroke-width", String(strokeWidth));
  t.setAttribute("paint-order", "stroke");
  t.textContent = text;

  g.appendChild(line);
  g.appendChild(t);
}


export class Visual implements IVisual {
  private host: any;
  private container: HTMLElement;
  private storageService: ILocalVisualStorageService | null = null;

  private svgRoot: SVGSVGElement | null = null;
  private zoomRoot: SVGGElement | null = null;
  private regionElementsById: Map<string, SVGElement> = new Map<string, SVGElement>();
  private regionBBoxesById: Map<string, GeometryBBox> = new Map<string, GeometryBBox>();
  private regionIds: string[] = [];
  private lastRenderedSvgSignature: string | null = null;
  private regionStyleBatchId: number | null = null;
  private regionStyleBatchToken = 0;
  private pendingDrillFocus = false;
  private drillFocusPhase: DrillFocusPhase = "idle";
  private drillFocusToken = 0;
  private drillFocusSettleToken = 0;
  private drillLoadingTimeout: number | null = null;
  private suppressSelectionFocusForPotentialDrill = false;
  private potentialDrillFocusSuppressionMs = 2500;
  private potentialDrillSelectionVisualDelayMs = 180;
  private potentialDrillClickTimer: number | null = null;
  private potentialDrillSelectionTimer: number | null = null;
  private pendingPotentialDrillSelectionIds: ISelectionId[] | null = null;
  private pendingPotentialDrillSelectionContext: { token: number; mapId: string; categoryName: string | null } | null = null;
  private potentialDrillVisualKey: string | null = null;
  private pendingDrillSource: PendingDrillSource | null = null;
  private lastDrillResolutionTrace: DrillMapResolutionTrace | null = null;
  private drillRouteDiagnosticKeys = new Set<string>();
  private renderScope: RenderScopeState = {
    active: false,
    mode: "AllMapAreas",
    boundIds: new Set<string>(),
    unboundIds: new Set<string>(),
    spatialOutlierIds: new Set<string>()
  };

  private selectionManager: ISelectionManager | null = null;
  private settings: VisualSettings = new VisualSettings();
  private formattingSettingsService: FormattingSettingsService;
  private formattingSettingsModel: VisualFormattingSettingsModel;

  private dataMap: Map<string, CatRow> = new Map();

  // seleção/foco
  private selectedKeys: Set<string> = new Set();
  private highlightedKeys: Set<string> = new Set();
  private hasHighlights = false;
  private selectionSource: SelectionSource = "none";

  // zoom/pan
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private isPanning = false;
  private panStartPt: { x: number; y: number } | null = null;
  private panStartT: { x: number; y: number } | null = null;
  private fitTransform: { scale: number; tx: number; ty: number } = { scale: 1, tx: 0, ty: 0 };
  private fitRafId: number | null = null;

  // tooltip
  private tooltipEl!: HTMLDivElement;
  private tooltipVisible = false;

  // upload controls
  private uploadCta!: HTMLDivElement;
  private fileInput!: HTMLInputElement;
  private uploadBtn!: HTMLButtonElement;
  private uploadBtnEmphasis = false;
  private svgWarning!: HTMLDivElement;
  private svgWarningTitle!: HTMLDivElement;
  private svgWarningBody!: HTMLDivElement;
  private svgWarningCloseBtn!: HTMLButtonElement;
  private helpEl!: HTMLDivElement;
  private helpTitleEl!: HTMLDivElement;
  private helpListEl!: HTMLUListElement;
  private helpDotsEl!: HTMLDivElement;
  private helpPrevBtn!: HTMLButtonElement;
  private helpNextBtn!: HTMLButtonElement;
  private helpCloseBtn!: HTMLButtonElement;
  private helpPageIndex = 0;
  private helpDismissed = false;
  private helpSeenPersisted = false;
  private helpShownThisSession = false;
  private helpInitialized = false;
  private lastHelpShow = false;
  private warningInitialized = false;
  private warningForceShow = false;
  private lastWarningShow = false;
  private warningDismissedSig: string | null = null;
  private currentSvgSig: string | null = null;
  private lastSvgSig: string | null = null;
  private lastSanitizationReport: SanitizationReport | null = null;
  private lastSanitizationSig: string | null = null;

  // legend
  private contentHost!: HTMLDivElement;
  private svgHost!: HTMLDivElement;
  private drillLoadingHost!: HTMLDivElement;
  private legendHost!: HTMLDivElement;
  private editorHost!: HTMLDivElement;
  private editorButton!: HTMLButtonElement;
  private editorOpen = false;
  private editorActiveTab: EditorTabKey = "Mapas";
  private editorDraftManifestJson: string | null = null;
  private editorDraftLabelOverridesJson: string | null = null;
  private editorSelectedMapId: string | null = null;
  private editorViewMode: EditorViewMode = "browser";
  private editorSelectedAreaId: string | null = null;
  private editorAreaSearch = "";
  private editorInspectorTab: EditorInspectorTab = "General";
  private editorStatusMessage = "";
  private editorStatusIsError = false;
  private drillRevealSvgRoot: SVGSVGElement | null = null;

  // host env
  private hostEnv: number | undefined;
  private lastUpdateOptions?: VisualUpdateOptions;
  private canHostDrillControls = false;
  private canHostDrillDown = false;
  private canHostDrillUp = false;
  private lastSetCanDrillValue: boolean | null = null;
  private hasCategoryDrillHierarchy = false;
  private currentDrillPath: string[] = [];
  private lastDataDrillLevel = 0;
  private lastDataDrillPath: string[] = [];
  private activeCategoryQueryName: string | null = null;
  private svgAreaIdCache = new Map<string, Set<string>>();
  private activeMap: ActiveMapResolution = {
    manifest: { schemaVersion: 1, maps: [] },
    map: null,
    svgText: "",
    mapId: "default"
  };
  private labelOverridesManifest: LabelOverridesManifest = { schemaVersion: 1, maps: {} };

  constructor(options: VisualConstructorOptions) {
    this.host = options.host as any;
    this.container = options.element;
    this.storageService = (this.host as any)?.storageService ?? null;

    this.hostEnv = (this.host as any)?.hostEnv as number | undefined;
    const localizationManager =
      (this.host as any)?.createLocalizationManager ? (this.host as any).createLocalizationManager() : undefined;
    this.formattingSettingsService = new FormattingSettingsService(localizationManager);
    this.formattingSettingsModel = new VisualFormattingSettingsModel();

    this.selectionManager = (this.host as any)?.createSelectionManager
      ? (this.host as any).createSelectionManager()
      : null;

    this.container.style.position = "relative";
    this.container.style.overflow = "hidden";

    this.tooltipEl = makeTooltipHost(this.container);

    this.contentHost = this.createContentHost();
    this.svgHost = this.createSvgHost();
    this.drillLoadingHost = this.createDrillLoadingHost();
    this.legendHost = this.createLegendUI();
    this.editorHost = this.createEditorHost();
    this.editorButton = this.createEditorButton();

    this.createUploadUI();
    this.helpDismissed = false;
    void this.loadPersistedUiState();
    this.svgWarning = this.createSanitizationWarning();
    this.helpEl = this.createHelpOverlay();

    if (this.selectionManager?.registerOnSelectCallback) {
      this.selectionManager.registerOnSelectCallback((ids: ISelectionId[]) => {
        const src: SelectionSource = ids && ids.length > 0 ? "self" : "none";
        this.setSelectionFromIds(ids, src);
      });
    }

    this.wireContainerContextMenu();
  }

  // --- tooltip positioning: garante visibilidade (sem clipping e sem estourar tela) ---
  private positionTooltip(clientX: number, clientY: number) {
    const tip = this.tooltipEl;
    if (!this.tooltipVisible) return;

    const margin = 10;
    const offset = 16;

    // posição inicial (canto inferior direito do cursor)
    let left = clientX + offset;
    let top = clientY + offset;

    // aplica para medir
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;

    const rect = tip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // se estourar à direita -> joga para esquerda
    if (rect.right > vw - margin) {
      left = clientX - rect.width - offset;
    }
    // se estourar embaixo -> joga para cima
    if (rect.bottom > vh - margin) {
      top = clientY - rect.height - offset;
    }

    // clamp final dentro da viewport
    left = clamp(left, margin, vw - rect.width - margin);
    top = clamp(top, margin, vh - rect.height - margin);

    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  private showTooltip(row: CatRow, ev: MouseEvent) {
    const content = buildTooltipContent(row.rawKey, row.fields);
    this.tooltipEl.textContent = "";
    this.tooltipEl.appendChild(content);
    this.tooltipEl.style.display = "block";
    this.tooltipVisible = true;
    this.positionTooltip(ev.clientX, ev.clientY);
  }

  private getRootSelectionId(): ISelectionId | null {
    try {
      const builder = (this.host as any)?.createSelectionIdBuilder?.();
      if (builder?.createSelectionId) {
        return builder.createSelectionId();
      }
    } catch {
      return null;
    }
    return null;
  }

  private showContextMenuAt(selectionId: ISelectionId | null | undefined, x: number, y: number) {
    if (!this.selectionManager?.showContextMenu) return;
    const id = selectionId ?? this.getRootSelectionId() ?? ({} as ISelectionId);
    this.selectionManager.showContextMenu(id as any, { x, y });
  }

  private hideTooltip() {
    this.tooltipEl.style.display = "none";
    this.tooltipVisible = false;
  }

  private clearRegionHoverState(): void {
    for (const el of this.regionElementsById.values()) {
      (el as any).style.filter = "";
    }
    this.hideTooltip();
  }

  private isRegionTarget(target: Element | null): boolean {
    if (!target || !(target as any).closest) return false;
    return !!target.closest("[data-sp-region='1']");
  }

  private getRegionEventElement(target: Element | null): SVGElement | null {
    if (!target || !(target as any).closest) return null;
    const el = target.closest("[data-sp-region='1']") as SVGElement | null;
    if (!el) return null;
    const id = ((el as any).id as string) || "";
    return id && this.regionElementsById.get(id) === el ? el : null;
  }

  private delegateSvgRegionEvent(ev: MouseEvent | KeyboardEvent, kind: "click" | "keydown" | "mouseenter" | "mousemove" | "mouseleave" | "contextmenu"): void {
    const el = this.getRegionEventElement(ev.target as Element | null);
    if (!el) return;
    const id = ((el as any).id as string) || "";
    const row = this.getBoundRowForElementId(id);

    if (kind === "mouseenter") {
      if (!row) return;
      (el as any).style.filter = "brightness(0.88)";
      this.showTooltip(row, ev as MouseEvent);
      return;
    }
    if (kind === "mousemove") {
      if (!row) return;
      const mouseEv = ev as MouseEvent;
      this.positionTooltip(mouseEv.clientX, mouseEv.clientY);
      return;
    }
    if (kind === "mouseleave") {
      if (!row) return;
      (el as any).style.filter = "";
      this.hideTooltip();
      return;
    }
    if (kind === "contextmenu") {
      const mouseEv = ev as MouseEvent;
      mouseEv.stopPropagation();
      mouseEv.preventDefault();
      this.hideTooltip();
      if (!row) {
        this.showContextMenuAt(null, mouseEv.clientX, mouseEv.clientY);
        return;
      }
      if (this.selectedKeys.has(row.key)) {
        this.showContextMenuAt(row.identity as any, mouseEv.clientX, mouseEv.clientY);
        return;
      }
      this.selectRow(row, false, () => this.showContextMenuAt(row.identity as any, mouseEv.clientX, mouseEv.clientY));
      return;
    }
    if (kind === "click") {
      const mouseEv = ev as MouseEvent;
      if (mouseEv.button !== 0 || !row) return;
      const multiSelect = mouseEv.ctrlKey || mouseEv.metaKey;
      const drillRoute = this.getDrillRouteForRow(row);
      this.selectRow(row, multiSelect, undefined, drillRoute, {
        suppressHostSelect: this.shouldSuppressHostSelectionForUnmappedDrill(drillRoute, multiSelect)
      });
      return;
    }
    if (kind === "keydown") {
      const keyEv = ev as KeyboardEvent;
      if (!row) return;
      if (keyEv.key === "Enter" || keyEv.key === " ") {
        keyEv.preventDefault();
        const multiSelect = keyEv.ctrlKey || keyEv.metaKey;
        const drillRoute = this.getDrillRouteForRow(row);
        this.selectRow(row, multiSelect, undefined, drillRoute, {
          suppressHostSelect: this.shouldSuppressHostSelectionForUnmappedDrill(drillRoute, multiSelect)
        });
        return;
      }
      if (keyEv.key === "ContextMenu" || (keyEv.shiftKey && keyEv.key === "F10")) {
        keyEv.preventDefault();
        const rect = el.getBoundingClientRect();
        this.showContextMenuAt(row.identity as any, Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2));
      }
    }
  }

  private selectionIdEquals(a: ISelectionId | null | undefined, b: ISelectionId | null | undefined): boolean {
    if (!a || !b) return false;
    const aAny = a as any;
    if (typeof aAny.equals === "function") return aAny.equals(b);
    if (typeof aAny.includes === "function") return aAny.includes(b, true) || aAny.includes(b);
    const bAny = b as any;
    if (typeof bAny.equals === "function") return bAny.equals(a);
    if (typeof bAny.includes === "function") return bAny.includes(a, true) || bAny.includes(a);
    return a === b;
  }

  private setSelectionFromIds(ids?: ISelectionId[] | null, source?: SelectionSource) {
    const hadLocalSelection = this.selectionSource === "self" && this.selectedKeys.size > 0;
    if (source) {
      this.selectionSource = source;
    }
    const nextSource = this.selectionSource;
    this.selectedKeys.clear();

    if (!ids || ids.length === 0) {
      if (this.selectionSource === "self") {
        this.selectionSource = "none";
      }
      this.applySelectionVisualState(hadLocalSelection && (nextSource === "self" || nextSource === "none"));
      return;
    }

    for (const [key, row] of this.dataMap.entries()) {
      const rowId = row.identity as ISelectionId | null | undefined;
      if (!rowId) continue;

      for (const id of ids) {
        if (this.selectionIdEquals(rowId, id)) {
          this.selectedKeys.add(key);
          break;
        }
      }
    }

    if (nextSource === "self" && this.getSelectedRegionElementsForActiveMap().length > 0) {
      this.cancelPendingDrillFocus();
    }
    this.applySelectionVisualState();
  }

  private beginDrillFocusTransition(): void {
    const currentLevel = Math.max(0, this.currentDrillPath.length - 1);
    const isAreaOverride = this.lastDrillResolutionTrace?.reason === "areaOverride";
    if (!this.settings.drillMaps.focusDataAreas || (currentLevel <= 0 && !isAreaOverride)) {
      this.cancelPendingDrillFocus();
      return;
    }

    this.clearPotentialDrillClickTransition(false);
    this.hideTooltip();
    this.clearRegionHoverState();
    this.pendingDrillFocus = true;
    this.drillFocusPhase = "mapResolved";
    this.drillFocusToken++;
    this.drillFocusSettleToken++;
    this.showDrillLoading();
    this.armDrillLoadingTimeout();
  }

  private shouldBeginDrillFocusTransition(
    previousActiveMapId: string,
    previousCategoryName: string | null,
    previousLevelRaw: number,
    hasSvg: boolean,
    hadRenderableSvg: boolean
  ): boolean {
    if (!hasSvg || !hadRenderableSvg || !this.settings.drillMaps.focusDataAreas) return false;

    const changed = previousActiveMapId !== this.activeMap.mapId || previousCategoryName !== this.activeCategoryQueryName;
    if (!changed) return false;

    const previousLevel = Number.isFinite(previousLevelRaw) ? previousLevelRaw : 0;
    const currentLevel = Math.max(0, this.currentDrillPath.length - 1);
    const resolvedByAreaOverride = this.lastDrillResolutionTrace?.reason === "areaOverride";
    return resolvedByAreaOverride || currentLevel > previousLevel || (currentLevel > 0 && previousActiveMapId !== this.activeMap.mapId);
  }

  private clearDrillLoadingTimeout(): void {
    if (this.drillLoadingTimeout === null) return;
    window.clearTimeout(this.drillLoadingTimeout);
    this.drillLoadingTimeout = null;
  }

  private armDrillLoadingTimeout(): void {
    this.clearDrillLoadingTimeout();
    const token = this.drillFocusToken;
    this.drillLoadingTimeout = window.setTimeout(() => {
      this.drillLoadingTimeout = null;
      if (!this.pendingDrillFocus || token !== this.drillFocusToken) return;
      this.cancelPendingDrillFocus();
      if (this.svgRoot && this.zoomRoot) {
        this.scheduleFitToHost();
      }
    }, 8000);
  }

  private markDrillFocusDomInserted(): void {
    if (!this.pendingDrillFocus) return;
    if (this.drillFocusPhase === "mapResolved") {
      this.drillFocusPhase = "domInserted";
    }
  }

  private markDrillFocusStylesApplied(): void {
    if (!this.pendingDrillFocus) return;
    if (this.drillFocusPhase === "mapResolved") {
      this.drillFocusPhase = "domInserted";
    }
    if (this.drillFocusPhase === "domInserted") {
      this.drillFocusPhase = "stylesApplied";
    }
  }

  private completeDrillFocusTransition(): void {
    this.clearDrillLoadingTimeout();
    this.pendingDrillFocus = false;
    this.drillFocusPhase = "focusApplied";
    this.revealDrillSvgAfterFit();
  }

  private cancelPendingDrillFocus(): void {
    this.clearDrillLoadingTimeout();
    this.pendingDrillFocus = false;
    this.drillFocusPhase = "idle";
    this.drillFocusToken++;
    this.drillFocusSettleToken++;
    this.drillRevealSvgRoot = null;
    this.clearPotentialDrillClickTransition(false);
    this.hideDrillLoading();
  }

  private clearPotentialDrillClickTransition(restoreSelectionFocus: boolean): void {
    const pendingSelectionIds = this.pendingPotentialDrillSelectionIds;
    const wasSuppressed = this.suppressSelectionFocusForPotentialDrill;
    this.clearPotentialDrillClickState(false);
    if (restoreSelectionFocus && wasSuppressed && pendingSelectionIds) {
      this.setSelectionFromIds(pendingSelectionIds, "self");
      return;
    }
    if (restoreSelectionFocus && wasSuppressed && !this.pendingDrillFocus && this.selectedKeys.size > 0) {
      this.applySelectionVisualState();
    }
  }

  private clearPotentialDrillClickState(clearPendingSource = true): void {
    if (this.potentialDrillClickTimer !== null) {
      window.clearTimeout(this.potentialDrillClickTimer);
      this.potentialDrillClickTimer = null;
    }
    if (this.potentialDrillSelectionTimer !== null) {
      window.clearTimeout(this.potentialDrillSelectionTimer);
      this.potentialDrillSelectionTimer = null;
    }
    this.pendingPotentialDrillSelectionIds = null;
    this.pendingPotentialDrillSelectionContext = null;
    this.potentialDrillVisualKey = null;
    this.suppressSelectionFocusForPotentialDrill = false;
    this.hideDrillLoading();
    if (clearPendingSource) {
      this.pendingDrillSource = null;
    }
  }

  private deferPotentialDrillSelection(ids?: ISelectionId[] | null): void {
    this.pendingPotentialDrillSelectionIds = ids ? [...ids] : [];
    this.schedulePotentialDrillSelectionFlush();
  }

  private schedulePotentialDrillSelectionFlush(): void {
    if (this.potentialDrillSelectionTimer !== null) {
      window.clearTimeout(this.potentialDrillSelectionTimer);
    }
    const token = this.pendingPotentialDrillSelectionContext?.token ?? this.drillFocusToken;
    this.potentialDrillSelectionTimer = window.setTimeout(() => {
      this.potentialDrillSelectionTimer = null;
      this.flushPotentialDrillSelection(token);
    }, this.potentialDrillSelectionVisualDelayMs);
  }

  private flushPotentialDrillSelection(token: number): void {
    if (this.pendingDrillFocus || token !== this.drillFocusToken) return;
    const context = this.pendingPotentialDrillSelectionContext;
    if (context && (context.mapId !== this.activeMap.mapId || context.categoryName !== this.activeCategoryQueryName)) {
      this.clearPotentialDrillClickState(true);
      return;
    }
    const pendingSelectionIds = this.pendingPotentialDrillSelectionIds;
    if (!pendingSelectionIds) return;
    this.clearPotentialDrillClickState(true);
    this.setSelectionFromIds(pendingSelectionIds, "self");
  }

  private armPotentialDrillClickTransition(): void {
    this.clearRegionHoverState();
    this.hideTooltip();
    this.showDrillLoading();
    this.suppressSelectionFocusForPotentialDrill = true;

    if (this.potentialDrillClickTimer !== null) {
      window.clearTimeout(this.potentialDrillClickTimer);
    }

    const mapId = this.activeMap.mapId;
    const categoryName = this.activeCategoryQueryName;
    const token = this.drillFocusToken;
    this.pendingPotentialDrillSelectionContext = { token, mapId, categoryName };
    this.potentialDrillClickTimer = window.setTimeout(() => {
      this.potentialDrillClickTimer = null;
      if (this.pendingDrillFocus || token !== this.drillFocusToken) return;
      const stillSameLevel = this.activeMap.mapId === mapId && this.activeCategoryQueryName === categoryName;
      if (stillSameLevel) {
        const pendingSelectionIds = this.pendingPotentialDrillSelectionIds;
        this.clearPotentialDrillClickState(true);
        if (pendingSelectionIds) {
          this.setSelectionFromIds(pendingSelectionIds, "self");
          return;
        }
        this.applyLabelZoomCompensation();
        return;
      }
      this.clearPotentialDrillClickState(true);
    }, this.potentialDrillFocusSuppressionMs);
  }

  private getRegionElementForRow(row: CatRow): SVGElement | null {
    const directCandidates = [row.rawKey, row.legendRawKey, row.key].filter((value) => !!value);
    for (const candidate of directCandidates) {
      const direct = this.regionElementsById.get(candidate);
      if (direct && !this.isAreaHidden(candidate) && !this.isHiddenByRenderScope(candidate)) return direct;
    }

    for (const id of this.regionIds) {
      if (this.isAreaHidden(id) || this.isHiddenByRenderScope(id)) continue;
      const boundRow = this.getBoundRowForElementId(id);
      if (!boundRow || boundRow.key !== row.key) continue;
      return this.regionElementsById.get(id) || null;
    }

    return null;
  }

  private preFocusPotentialDrillSource(row: CatRow): void {
    if (!this.settings.drillMaps.preFocusSourceOnDrill) return;
    if (this.isPanning || !this.svgRoot || !this.zoomRoot) return;
    const el = this.getRegionElementForRow(row);
    if (!el) return;
    this.potentialDrillVisualKey = row.key;
    this.applySelectionVisualState();
    this.focusElements([el]);
  }

  private getRowAreaId(row: CatRow): string {
    const el = this.getRegionElementForRow(row);
    const areaId = ((el as any)?.id || row.rawKey || row.legendRawKey || row.key || "").toString();
    return areaId;
  }

  private getDrillRouteForRow(row: CatRow): DrillClickRoute | null {
    if (!this.settings.drillMaps.enabled) return null;
    if (!this.canHostDrillDown) return null;
    const svgAreaId = this.getRowAreaId(row);
    if (!svgAreaId) return null;
    const resolvedArea = this.findAreaDefinitionForRuntime(svgAreaId);
    const areaOverride = resolvedArea?.area;
    const resolvedAreaKey = this.getAreaManifestKeyForRuntime(svgAreaId);
    if (!areaOverride) {
      this.warnDrillRouteDiagnostic("Area clicada nao encontrou configuracao no manifesto.", {
        svgAreaId,
        mapId: this.activeMap.mapId,
        availableAreaKeys: Object.keys(this.activeMap.map?.areas || {}).slice(0, 20)
      });
      return null;
    }
    if (areaOverride.drillMode === "none") return null;
    const targetMapId = areaOverride?.drillToMapId;
    if (!targetMapId) {
      this.warnDrillRouteDiagnostic("Area encontrada, mas sem drillToMapId.", {
        svgAreaId,
        areaKey: resolvedAreaKey,
        mapId: this.activeMap.mapId,
        drillMode: areaOverride.drillMode
      });
      return null;
    }
    if (targetMapId === this.activeMap.mapId) return null;
    const targetMap = this.activeMap.manifest.maps.find((map) => map.mapId === targetMapId);
    if (!targetMap || !(targetMap.svgText || "").trim()) {
      this.warnDrillRouteDiagnostic("drillToMapId aponta para mapa inexistente ou sem SVG.", {
        svgAreaId,
        areaKey: resolvedAreaKey,
        targetMapId
      });
      return null;
    }
    return {
      sourceMapId: this.activeMap.mapId,
      sourceAreaId: svgAreaId,
      targetMapId
    };
  }

  private getCurrentDataDrillLevel(): number {
    return Math.max(0, this.currentDrillPath.length - 1);
  }

  private getCurrentResolvedLevel(): number {
    const pathLevel = this.getCurrentDataDrillLevel();
    const mapLevel = Number(this.activeMap?.map?.level);
    if (Number.isFinite(mapLevel) && mapLevel >= 0) {
      return Math.max(pathLevel, mapLevel);
    }
    return pathLevel;
  }

  private getDrillNavigationDirection(currentLevel: number, currentPath: string[] = this.currentDrillPath): "down" | "up" | "same" {
    if (currentLevel > this.lastDataDrillLevel) return "down";
    if (currentLevel < this.lastDataDrillLevel) return "up";
    const currentPathKey = currentPath.map((part) => norm(part)).join("\u0000");
    const lastPathKey = this.lastDataDrillPath.map((part) => norm(part)).join("\u0000");
    if (currentPathKey !== lastPathKey) return "same";
    return "same";
  }

  private capturePendingDrillSource(route: DrillClickRoute): void {
    this.pendingDrillSource = {
      sourceMapId: route.sourceMapId,
      sourceAreaId: route.sourceAreaId,
      targetMapId: route.targetMapId,
      sourceLevel: this.getCurrentDataDrillLevel(),
      sourcePath: [...this.currentDrillPath]
    };
  }

  private activeMapHasExplicitNextDrillTarget(): boolean {
    const manifest = this.activeMap?.manifest;
    const map = this.activeMap?.map;
    if (!manifest || !map?.areas) return false;

    return Object.values(map.areas).some((area) => {
      if (!area?.drillToMapId) return false;
      if (area.drillMode === "none") return false;
      const target = manifest.maps.find((candidate) => candidate.mapId === area.drillToMapId);
      return !!target?.svgText?.trim();
    });
  }

  private updateHostDrillState(dv?: DataView): void {
    const dataRoles = (dv as any)?.metadata?.dataRoles;
    const drillableRoles = dataRoles?.drillableRoles;
    const categoryDrillTypes = drillableRoles?.category;
    const drillTypes = Array.isArray(categoryDrillTypes) ? categoryDrillTypes : [];
    const categoryColumnCount = this.getCategoryColumns(dv).length;
    const currentLevel = this.getCurrentResolvedLevel();
    const hostReportsDrillUp = drillTypes.includes(1);
    const hostReportsDrillDown = drillTypes.length > 0 ? drillTypes.includes(2) : categoryColumnCount > 1;
    const hostReportsAnyDrill = drillTypes.length > 0;
    const hasHierarchyInDataView = categoryColumnCount > 1;
    const isInsideDrillHierarchy = currentLevel > 0;
    const activeMapHasNext = this.activeMapHasExplicitNextDrillTarget();

    this.hasCategoryDrillHierarchy =
      hasHierarchyInDataView ||
      isInsideDrillHierarchy ||
      hostReportsAnyDrill;

    this.canHostDrillDown =
      this.settings.drillMaps.enabled &&
      activeMapHasNext &&
      (hostReportsDrillDown || hasHierarchyInDataView || isInsideDrillHierarchy);

    this.canHostDrillUp = isInsideDrillHierarchy || hostReportsDrillUp;

    const shouldEnableDrillControls =
      this.settings.drillMaps.enabled &&
      this.hasCategoryDrillHierarchy &&
      (this.canHostDrillUp || this.canHostDrillDown || isInsideDrillHierarchy || activeMapHasNext);

    this.canHostDrillControls = shouldEnableDrillControls;
    const setCanDrill = (this.host as any)?.setCanDrill;
    if (typeof setCanDrill === "function" && this.lastSetCanDrillValue !== shouldEnableDrillControls) {
      try {
        setCanDrill.call(this.host, shouldEnableDrillControls);
        this.lastSetCanDrillValue = shouldEnableDrillControls;
      } catch {
        // Older hosts can expose the method but reject it in some surfaces.
      }
    }
  }

  private syncSelectionFromHighlights(): boolean {
    if (!this.hasHighlights) return false;
    this.selectionSource = "external";
    this.selectedKeys.clear();
    for (const key of this.highlightedKeys) this.selectedKeys.add(key);
    return true;
  }

  private applyLocalRowSelection(row: CatRow, multiSelect: boolean): void {
    this.selectionSource = "self";
    if (multiSelect) {
      if (this.selectedKeys.has(row.key)) this.selectedKeys.delete(row.key);
      else this.selectedKeys.add(row.key);
    } else {
      this.selectedKeys.clear();
      this.selectedKeys.add(row.key);
    }
    this.applySelectionVisualState();
  }

  private shouldSuppressHostSelectionForUnmappedDrill(drillRoute: DrillClickRoute | null, multiSelect: boolean): boolean {
    if (multiSelect) return false;
    if (!this.settings.drillMaps.enabled) return false;
    if (!this.canHostDrillDown) return false;
    return !drillRoute;
  }

  private selectRow(
    row: CatRow,
    multiSelect: boolean,
    after?: () => void,
    drillRoute: DrillClickRoute | null = null,
    options: { suppressHostSelect?: boolean } = {}
  ) {
    this.selectionSource = "self";
    this.cancelPendingDrillFocus();
    const deferPotentialDrillSelection = !!drillRoute && !multiSelect;
    if (deferPotentialDrillSelection && drillRoute) {
      this.armPotentialDrillClickTransition();
      this.capturePendingDrillSource(drillRoute);
      this.preFocusPotentialDrillSource(row);
    } else {
      this.pendingDrillSource = null;
      this.clearRegionHoverState();
    }

    if (options.suppressHostSelect) {
      this.pendingDrillSource = null;
      this.clearPotentialDrillClickState(true);
      this.clearRegionHoverState();
      this.applyLocalRowSelection(row, multiSelect);
      after?.();
      return;
    }

    if (!this.selectionManager?.select) {
      this.applyLocalRowSelection(row, multiSelect);
      after?.();
      return;
    }

    if (deferPotentialDrillSelection) {
      this.selectionManager
        .select(row.identity as any, multiSelect)
        .then((ids) => {
          this.deferPotentialDrillSelection(ids as ISelectionId[]);
          after?.();
        })
        .catch(() => {
          this.clearPotentialDrillClickState(true);
          after?.();
        });
      return;
    }

    this.applyLocalRowSelection(row, multiSelect);
    this.selectionManager
      .select(row.identity as any, multiSelect)
      .then((ids) => {
        this.setSelectionFromIds(ids as ISelectionId[], "self");
        after?.();
      })
      .catch(() => {
        after?.();
      });
  }

  private selectRows(rows: CatRow[], multiSelect: boolean, after?: () => void) {
    const validRows = rows.filter((r) => !!r);
    if (validRows.length === 0) return;

    this.selectionSource = "self";
    this.cancelPendingDrillFocus();
    const groupKeys = validRows.map((r) => r.key);
    const groupIds = validRows.map((r) => r.identity);
    const allSelected = groupKeys.every((k) => this.selectedKeys.has(k));

    const applyLocalSelection = () => {
      if (multiSelect) {
        if (allSelected) groupKeys.forEach((k) => this.selectedKeys.delete(k));
        else groupKeys.forEach((k) => this.selectedKeys.add(k));
      } else {
        this.selectedKeys.clear();
        groupKeys.forEach((k) => this.selectedKeys.add(k));
      }
      this.applySelectionVisualState();
    };

    if (!this.selectionManager?.select) {
      applyLocalSelection();
      after?.();
      return;
    }

    applyLocalSelection();
    this.selectionManager
      .select(groupIds as any, multiSelect)
      .then((ids) => {
        this.setSelectionFromIds(ids as ISelectionId[], "self");
        after?.();
      })
      .catch(() => {
        after?.();
      });
  }

  // --- regra: permitir upload SOMENTE no Power BI Desktop ---
  private canShowSvgPickerUI(): boolean {
    const env = this.hostEnv ?? (this.host as any)?.hostEnv;
    if (env === undefined || env === null) return false;

    // CustomVisualHostEnv.Desktop = 1<<2 = 4
    const DESKTOP_FLAG = 1 << 2;
    return (env & DESKTOP_FLAG) === DESKTOP_FLAG;
  }

  private persistSvgText(text: string): void {
    if (!this.canShowSvgPickerUI()) return;
    const persist = (this.host as any)?.persistProperties;
    if (typeof persist !== "function") return;

    persist({
      merge: [
        {
          objectName: "svgSettings",
          selector: null,
          properties: { svgText: text }
        }
      ]
    });
  }

  private persistHelpShow(show: boolean): void {
    const persist = (this.host as any)?.persistProperties;
    if (typeof persist !== "function") return;
    persist({
      merge: [
        {
          objectName: "help",
          selector: null,
          properties: { show }
        }
      ]
    });
  }

  private persistWarningShow(show: boolean): void {
    const persist = (this.host as any)?.persistProperties;
    if (typeof persist !== "function") return;
    persist({
      merge: [
        {
          objectName: "warning",
          selector: null,
          properties: { show }
        }
      ]
    });
  }

  private readStoredValue(key: string): Promise<string | null> {
    const storage = this.storageService;
    if (!storage?.get) return Promise.resolve(null);
    return new Promise((resolve) => {
      storage
        .get(key)
        .then((value) => resolve(typeof value === "string" ? value : null))
        .catch(() => resolve(null));
    });
  }

  private writeStoredValue(key: string, value: string): void {
    const storage = this.storageService;
    if (!storage?.set) return;
    storage.set(key, value).catch(() => {
      return;
    });
  }

  private async loadPersistedUiState(): Promise<void> {
    const [helpSeenRaw, warningSig, lastSvgSig] = await Promise.all([
      this.readStoredValue(UI_STORAGE_KEYS.helpSeen),
      this.readStoredValue(UI_STORAGE_KEYS.warningDismissedSig),
      this.readStoredValue(UI_STORAGE_KEYS.lastSvgSig)
    ]);

    this.helpSeenPersisted = helpSeenRaw === "1";
    this.helpDismissed = this.helpSeenPersisted;
    this.warningDismissedSig = warningSig;
    this.lastSvgSig = lastSvgSig;
  }

  private createContentHost(): HTMLDivElement {
    const host = document.createElement("div");
    host.className = "sp-content";
    Object.assign(host.style, {
      position: "absolute",
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
      display: "flex",
      flexDirection: "column",
      zIndex: "1",
      overflow: "hidden"
    } as CSSStyleDeclaration);
    this.container.appendChild(host);
    return host;
  }

  private createSvgHost(): HTMLDivElement {
    const host = document.createElement("div");
    host.className = "sp-svg-host";
    Object.assign(host.style, {
      position: "relative",
      flex: "1 1 auto",
      minWidth: "0",
      minHeight: "0"
    } as CSSStyleDeclaration);
    this.contentHost.appendChild(host);
    return host;
  }

  private createDrillLoadingHost(): HTMLDivElement {
    const host = document.createElement("div");
    host.className = "sp-drill-loading";
    host.setAttribute("aria-live", "polite");
    host.setAttribute("aria-hidden", "true");

    const spinner = document.createElement("span");
    spinner.className = "sp-drill-spinner";
    spinner.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "sp-drill-loading-text";
    text.textContent = "Carregando mapa";

    host.append(spinner, text);
    this.container.appendChild(host);
    return host;
  }

  private prefersReducedMotion(): boolean {
    try {
      return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    } catch {
      return false;
    }
  }

  private showDrillLoading(): void {
    if (!this.drillLoadingHost) return;
    this.drillLoadingHost.classList.add("is-visible");
    this.drillLoadingHost.setAttribute("aria-hidden", "false");
    if (this.svgHost) this.svgHost.style.pointerEvents = "none";
  }

  private hideDrillLoading(): void {
    if (this.drillLoadingHost) {
      this.drillLoadingHost.classList.remove("is-visible");
      this.drillLoadingHost.setAttribute("aria-hidden", "true");
    }
    if (this.svgHost) this.svgHost.style.pointerEvents = "";
  }

  private prepareSvgForDrillReveal(svgNode: SVGSVGElement): void {
    if (!this.pendingDrillFocus) return;
    this.drillRevealSvgRoot = svgNode;
    svgNode.classList.add("sp-drill-reveal-pending");
    svgNode.setAttribute("data-drill-reveal-pending", "1");
    svgNode.style.pointerEvents = "none";
  }

  private removeStaleSvgRoots(activeRoot: SVGSVGElement): void {
    if (!this.svgHost) return;
    this.svgHost.querySelectorAll("svg").forEach((el) => {
      if (el !== activeRoot) el.remove();
    });
  }

  private revealDrillSvgAfterFit(): void {
    const svgNode = this.drillRevealSvgRoot;
    if (!svgNode) {
      this.hideDrillLoading();
      return;
    }

    this.drillRevealSvgRoot = null;
    svgNode.removeAttribute("data-drill-reveal-pending");
    svgNode.classList.remove("sp-drill-reveal-pending");
    svgNode.classList.add("sp-drill-reveal-ready");
    svgNode.style.pointerEvents = "";

    if (this.prefersReducedMotion()) {
      svgNode.classList.remove("sp-drill-reveal-ready");
      this.removeStaleSvgRoots(svgNode);
      this.hideDrillLoading();
      return;
    }

    window.setTimeout(() => {
      svgNode.classList.remove("sp-drill-reveal-ready");
      this.removeStaleSvgRoots(svgNode);
      this.hideDrillLoading();
    }, 220);
  }

  private createEditorHost(): HTMLDivElement {
    const host = document.createElement("div");
    host.className = "sp-editor";
    Object.assign(host.style, {
      position: "absolute",
      inset: "0",
      zIndex: "40",
      display: "none",
      overflow: "hidden",
      background: "rgba(248, 250, 252, 0.98)",
      color: "#172033",
      fontFamily: "Segoe UI, -apple-system, Roboto, Arial, sans-serif"
    } as CSSStyleDeclaration);
    this.container.appendChild(host);
    return host;
  }

  private createEditorButton(): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sp-editor-open";
    button.setAttribute("aria-label", "Abrir editor de mapa");
    button.setAttribute("aria-hidden", "true");
    button.tabIndex = -1;

    const icon = document.createElement("span");
    icon.className = "sp-editor-open-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "</>";

    const label = document.createElement("span");
    label.textContent = "Editor";

    button.append(icon, label);
    button.addEventListener("click", () => {
      const hasSvgConfigured = !!(this.activeMap?.svgText || "").trim();
      if (!this.canShowEditorButton(this.lastUpdateOptions, hasSvgConfigured)) return;

      if (this.canUseModalEditor(this.lastUpdateOptions)) {
        void this.openMapEditorDialog();
        return;
      }
      this.setEditorOpen(!this.editorOpen);
    });
    this.container.appendChild(button);
    return button;
  }

  private canExposeEditorUi(options?: VisualUpdateOptions): boolean {
    if (!this.settings.editor.enabled) return false;
    if (!this.canShowSvgPickerUI()) return false;
    return true;
  }

  private canShowEditorButton(options?: VisualUpdateOptions, hasSvgConfigured = false): boolean {
    return this.canExposeEditorUi(options) && this.settings.editor.showEditorButton && hasSvgConfigured;
  }

  private canUseModalEditor(options?: VisualUpdateOptions): boolean {
    return (
      this.canExposeEditorUi(options) &&
      typeof (this.host as any)?.openModalDialog === "function" &&
      !!(this.host as any)?.hostCapabilities?.allowModalDialog
    );
  }

  private buildMapEditorDialogInitialState(): MapEditorDialogInitialState {
    const state = this.getEditorWorkingState();
    const rowsByKey: MapEditorDialogInitialState["rowsByKey"] = {};
    for (const row of this.dataMap.values()) {
      rowsByKey[row.key] = {
        rawKey: row.rawKey,
        legendRawKey: row.legendRawKey,
        displayName: row.legendRawKey || row.rawKey
      };
    }
    return {
      manifestJson: this.editorDraftManifestJson || stringifyManifest(state.manifest),
      labelOverridesJson: this.editorDraftLabelOverridesJson || stringifyManifest(state.labelOverrides),
      selectedMapId: this.editorSelectedMapId || state.activeMap.mapId,
      selectedAreaId: this.editorSelectedAreaId,
      viewMode: this.editorViewMode,
      areaSearch: this.editorAreaSearch,
      inspectorTab: this.editorInspectorTab === "Drill" ? "Drill" : "General",
      allowMapUploads: this.canShowSvgPickerUI(),
      rowsByKey,
      drillContext: {
        currentDrillPath: [...this.currentDrillPath],
        currentLevel: Math.max(0, this.currentDrillPath.length - 1),
        categoryFieldNames: [...this.currentDrillPath],
        activeCategoryQueryName: this.activeCategoryQueryName,
        resolvedMapId: this.activeMap.mapId,
        candidateMaps: this.lastDrillResolutionTrace?.candidates || [],
        resolutionReason: this.lastDrillResolutionTrace?.reason || "none",
        warnings: this.lastDrillResolutionTrace?.warnings || []
      }
    };
  }

  private async openMapEditorDialog(): Promise<void> {
    if (!this.canUseModalEditor(this.lastUpdateOptions)) {
      this.setEditorOpen(true);
      return;
    }

    const dialogHost = (this.host as any)?.openModalDialog;
    if (typeof dialogHost !== "function") {
      this.setEditorOpen(true);
      return;
    }

    const win = this.container.ownerDocument?.defaultView;
    const viewportWidth = win?.innerWidth || 1600;
    const viewportHeight = win?.innerHeight || 900;
    const width = Math.min(1360, Math.max(1120, Math.floor(viewportWidth * 0.9)));
    const height = Math.min(900, Math.max(720, Math.floor(viewportHeight * 0.88)));

    try {
      const dialogResult = (await dialogHost.call(
        this.host,
        MapEditorDialog.id,
        {
          title: "Editor de mapas",
          size: { width, height },
          actionButtons: [powerbi.DialogAction.Close]
        },
        this.buildMapEditorDialogInitialState()
      )) as powerbi.extensibility.visual.ModalDialogResult | undefined;

      const result = (dialogResult?.resultState || {}) as Partial<MapEditorDialogResult>;
      const manifest = parseMapRegistryManifest(
        typeof result.manifestJson === "string" ? result.manifestJson : this.editorDraftManifestJson ?? this.settings.mapRegistry.manifestJson
      );
      const labelOverrides = parseLabelOverridesManifest(
        typeof result.labelOverridesJson === "string"
          ? result.labelOverridesJson
          : this.editorDraftLabelOverridesJson ?? this.settings.labelOverrides.overridesJson
      );

      this.applyEditorDraftState(
        manifest,
        labelOverrides,
        result.selectedMapId ?? this.editorSelectedMapId,
        result.selectedAreaId ?? this.editorSelectedAreaId,
        result.viewMode === "detail" ? "detail" : "browser"
      );
      this.editorAreaSearch = typeof result.areaSearch === "string" ? result.areaSearch : this.editorAreaSearch;
      this.editorInspectorTab = result.inspectorTab === "Drill" ? "Drill" : "General";

      if (result.shouldPersist) {
        const validationErrors = this.validateMapRegistryManifest(manifest);
        if (validationErrors.length > 0) {
          this.setEditorStatus(validationErrors.join(" | "), true);
          return;
        }
        this.persistMapRegistryManifest(this.editorDraftManifestJson || stringifyManifest(manifest));
        this.persistLabelOverridesManifest(this.editorDraftLabelOverridesJson || stringifyManifest(labelOverrides));
        this.setEditorStatus(`Editor salvo. Mapa ativo: ${result.selectedMapId || this.editorSelectedMapId || this.activeMap.mapId}.`, false);
      }
    } catch {
      this.setEditorOpen(true);
    }
  }

  private setEditorOpen(open: boolean): void {
    this.editorOpen = open;
    this.renderAdvancedEditor(this.lastUpdateOptions, undefined);
  }

  private createUploadUI() {
    this.uploadCta = document.createElement("div");
    this.uploadCta.className = "sp-upload-cta";
    Object.assign(this.uploadCta.style, {
      position: "absolute",
      inset: "0",
      display: "none",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      padding: "24px",
      background: "rgba(0,0,0,0.08)",
      color: "#fff",
      textAlign: "center",
      backdropFilter: "blur(1px)",
      zIndex: "20",
      userSelect: "none"
    } as CSSStyleDeclaration);

    const ctaText = document.createElement("div");
    const ctaTitle = document.createElement("div");
    ctaTitle.style.fontSize = "16px";
    ctaTitle.style.fontWeight = "700";
    ctaTitle.textContent = "Nenhum mapa configurado";

    const ctaSubtitle = document.createElement("div");
    Object.assign(ctaSubtitle.style, {
      opacity: ".9",
      fontSize: "12px",
      maxWidth: "320px"
    } as CSSStyleDeclaration);
    ctaSubtitle.textContent = "Adicione um arquivo .svg para iniciar o editor de mapas.";

    ctaText.appendChild(ctaTitle);
    ctaText.appendChild(ctaSubtitle);
    this.uploadCta.appendChild(ctaText);
    const ctaButton = document.createElement("button");
    ctaButton.type = "button";
    ctaButton.textContent = "Adicionar Mapa";
    Object.assign(ctaButton.style, {
      padding: "12px 18px",
      borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.32)",
      background: "rgba(16, 185, 129, 0.88)",
      color: "#fff",
      cursor: "pointer",
      fontFamily: "Segoe UI, -apple-system, Roboto, Arial, sans-serif",
      fontSize: "13px",
      fontWeight: "700"
    } as CSSStyleDeclaration);
    ctaButton.addEventListener("click", () => {
      if (!this.canShowSvgPickerUI()) return;
      this.fileInput.click();
    });
    this.uploadCta.appendChild(ctaButton);
    this.container.appendChild(this.uploadCta);

    this.fileInput = document.createElement("input");
    this.fileInput.type = "file";
    this.fileInput.accept = ".svg,image/svg+xml";
    this.fileInput.style.display = "none";
    this.fileInput.addEventListener("change", async () => {
      if (!this.canShowSvgPickerUI()) return;
      const file = this.fileInput.files?.[0];
      if (!file) return;

      const text = await file.text();
      const dataUri = "data:image/svg+xml;utf8," + encodeURIComponent(text);
      this.persistSvgText(dataUri);
      this.seedDraftFromUploadedSvg(dataUri, file.name, false);
      this.editorOpen = !this.canUseModalEditor(this.lastUpdateOptions);
      this.editorViewMode = "browser";

      this.fileInput.value = "";
      if (this.canUseModalEditor(this.lastUpdateOptions)) {
        void this.openMapEditorDialog();
        return;
      }
      this.renderAdvancedEditor(this.lastUpdateOptions, undefined);
    });
    this.container.appendChild(this.fileInput);

    this.uploadBtn = document.createElement("button");
    this.uploadBtn.type = "button";
    this.uploadBtn.textContent = "Adicionar Mapa";
    const uploadHint = "Selecione um arquivo .svg (IDs = categoria).";
    this.uploadBtn.title = uploadHint;
    this.uploadBtn.setAttribute("aria-label", uploadHint);
    Object.assign(this.uploadBtn.style, {
      position: "absolute",
      top: "10px",
      right: "10px",
      zIndex: "30",
      padding: "8px 10px",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,0.2)",
      background: "rgba(0,0,0,0.22)",
      color: "#fff",
      cursor: "pointer",
      fontFamily: "Segoe UI, -apple-system, Roboto, Arial, sans-serif",
      fontSize: "12px",
      opacity: "0.2",
      transition: "opacity 120ms ease, transform 120ms ease",
      userSelect: "none"
    } as CSSStyleDeclaration);

    this.uploadBtn.addEventListener("mouseenter", () => {
      if (this.uploadBtnEmphasis) return;
      this.uploadBtn.style.opacity = "1";
      this.uploadBtn.style.transform = "translateY(-1px)";
    });
    this.uploadBtn.addEventListener("mouseleave", () => {
      if (this.uploadBtnEmphasis) return;
      this.uploadBtn.style.opacity = "0.2";
      this.uploadBtn.style.transform = "translateY(0)";
    });
    this.uploadBtn.addEventListener("click", () => {
      if (!this.canShowSvgPickerUI()) return;
      this.fileInput.click();
    });

    this.container.appendChild(this.uploadBtn);
  }

  private setUploadButtonEmphasis(active: boolean) {
    if (!this.uploadBtn) return;
    this.uploadBtnEmphasis = active;
    if (active) {
      this.uploadBtn.style.opacity = "1";
      this.uploadBtn.style.transform = "translateY(0)";
      this.uploadBtn.style.background = "rgba(0,0,0,0.45)";
      this.uploadBtn.style.border = "1px solid rgba(255,255,255,0.5)";
      this.uploadBtn.style.boxShadow = "0 6px 14px rgba(0,0,0,0.28)";
    } else {
      this.uploadBtn.style.opacity = "0.2";
      this.uploadBtn.style.transform = "translateY(0)";
      this.uploadBtn.style.background = "rgba(0,0,0,0.22)";
      this.uploadBtn.style.border = "1px solid rgba(255,255,255,0.2)";
      this.uploadBtn.style.boxShadow = "";
    }
  }

  private createSanitizationWarning(): HTMLDivElement {
    const host = document.createElement("div");
    host.className = "sp-svg-warning";
    Object.assign(host.style, {
      position: "absolute",
      bottom: "10px",
      left: "10px",
      right: "auto",
      maxWidth: "560px",
      padding: "10px 12px",
      borderRadius: "10px",
      border: "1px solid rgba(204, 152, 0, 0.35)",
      background: "rgba(255, 244, 214, 0.95)",
      color: "#5c4700",
      fontFamily: "Segoe UI, -apple-system, Roboto, Arial, sans-serif",
      fontSize: "12px",
      lineHeight: "1.35",
      zIndex: "25",
      display: "none",
      pointerEvents: "auto",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
    } as CSSStyleDeclaration);

    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "8px"
    } as CSSStyleDeclaration);

    this.svgWarningTitle = document.createElement("div");
    Object.assign(this.svgWarningTitle.style, {
      fontWeight: "700",
      marginBottom: "4px"
    } as CSSStyleDeclaration);
    this.svgWarningTitle.textContent = "";

    this.svgWarningCloseBtn = document.createElement("button");
    this.svgWarningCloseBtn.type = "button";
    this.svgWarningCloseBtn.textContent = "×";
    this.svgWarningCloseBtn.setAttribute("aria-label", "Fechar");
    Object.assign(this.svgWarningCloseBtn.style, {
      border: "none",
      background: "transparent",
      color: "#5c4700",
      fontSize: "16px",
      lineHeight: "1",
      cursor: "pointer",
      padding: "0 2px"
    } as CSSStyleDeclaration);
    this.svgWarningCloseBtn.addEventListener("click", () => {
      if (this.currentSvgSig) {
        this.warningDismissedSig = this.currentSvgSig;
        this.writeStoredValue(UI_STORAGE_KEYS.warningDismissedSig, this.currentSvgSig);
      }
      this.persistWarningShow(false);
      if (this.settings?.warning) {
        this.settings.warning.show = false;
      }
      this.lastWarningShow = false;
      host.style.display = "none";
    });

    this.svgWarningBody = document.createElement("div");
    this.svgWarningBody.textContent = "";

    header.appendChild(this.svgWarningTitle);
    header.appendChild(this.svgWarningCloseBtn);
    host.appendChild(header);
    host.appendChild(this.svgWarningBody);
    this.container.appendChild(host);

    return host;
  }

  private setSanitizationWarning(
    report: SanitizationReport | null,
    svgSig: string | null,
    forceShow: boolean = false
  ) {
    void forceShow;
    const hasReportChanges =
      !!report &&
      (Object.keys(report.removedTags).length > 0 ||
        Object.keys(report.removedAttrs).length > 0 ||
        report.removedStyleParts > 0);
    this.currentSvgSig = svgSig;
    if (svgSig) {
      this.lastSvgSig = svgSig;
      this.writeStoredValue(UI_STORAGE_KEYS.lastSvgSig, svgSig);
    }
    this.lastSanitizationReport = hasReportChanges ? report : null;
    this.lastSanitizationSig = hasReportChanges ? svgSig : null;
    this.warningForceShow = false;
    this.lastWarningShow = false;
    if (this.svgWarning) {
      this.svgWarning.style.display = "none";
    }
    if (this.svgWarningTitle) this.svgWarningTitle.textContent = "";
    if (this.svgWarningBody) this.svgWarningBody.textContent = "";
  }

  private createHelpOverlay(): HTMLDivElement {
    const host = document.createElement("div");
    host.className = "sp-help";
    host.setAttribute("role", "note");
    host.setAttribute("aria-label", "Dicas de uso do visual");

    const header = document.createElement("div");
    header.className = "sp-help-header";

    this.helpTitleEl = document.createElement("div");
    this.helpTitleEl.className = "sp-help-title";
    this.helpTitleEl.textContent = "Dicas de uso";

    this.helpCloseBtn = document.createElement("button");
    this.helpCloseBtn.type = "button";
    this.helpCloseBtn.className = "sp-help-close";
    this.helpCloseBtn.setAttribute("aria-label", "Fechar dicas");
    this.helpCloseBtn.textContent = "×";
    this.helpCloseBtn.addEventListener("click", () => {
      this.helpDismissed = true;
      this.helpSeenPersisted = true;
      this.writeStoredValue(UI_STORAGE_KEYS.helpSeen, "1");
      this.persistHelpShow(false);
      this.lastHelpShow = false;
      host.style.display = "none";
    });

    header.appendChild(this.helpTitleEl);
    header.appendChild(this.helpCloseBtn);

    const body = document.createElement("div");
    body.className = "sp-help-body";

    this.helpListEl = document.createElement("ul");
    this.helpListEl.className = "sp-help-list";
    body.appendChild(this.helpListEl);

    const nav = document.createElement("div");
    nav.className = "sp-help-nav";

    this.helpPrevBtn = document.createElement("button");
    this.helpPrevBtn.type = "button";
    this.helpPrevBtn.className = "sp-help-nav-btn";
    this.helpPrevBtn.textContent = "Anterior";
    this.helpPrevBtn.addEventListener("click", () => this.setHelpPage(this.helpPageIndex - 1));

    this.helpNextBtn = document.createElement("button");
    this.helpNextBtn.type = "button";
    this.helpNextBtn.className = "sp-help-nav-btn";
    this.helpNextBtn.textContent = "Proxima";
    this.helpNextBtn.addEventListener("click", () => this.setHelpPage(this.helpPageIndex + 1));

    this.helpDotsEl = document.createElement("div");
    this.helpDotsEl.className = "sp-help-dots";

    nav.appendChild(this.helpPrevBtn);
    nav.appendChild(this.helpDotsEl);
    nav.appendChild(this.helpNextBtn);

    host.appendChild(header);
    host.appendChild(body);
    host.appendChild(nav);
    this.container.appendChild(host);
    this.setHelpPage(0);
    return host;
  }

  private getHelpPages(lang: UiLanguage): { title: string; bullets: string[] }[] {
    if (lang === "en") {
      return [
        {
          title: "Tip 1: Prepare the SVG",
          bullets: [
            "Make sure each area has a unique, stable ID.",
            "Use IDs that match the category (e.g., curral_1, curral_2).",
            "Avoid groups without IDs: only IDs map data.",
            "If using images, prefer embedded PNG (data:image/png)."
          ]
        },
        {
          title: "Tip 2: Replace SVG button",
          bullets: [
            "Use the \"Trocar SVG\" button to select a .svg file.",
            "It lives in the top-right corner of the visual.",
            "It works only in Power BI Desktop."
          ]
        },
        {
          title: "Tip 3: SVG security",
          bullets: [
            "The visual cleans SVG markup before rendering.",
            "Scripts, event handlers and unsafe external references are removed.",
            "Prefer clean SVGs with unique and stable IDs."
          ]
        },
        {
          title: "Tip 4: Configure in Power BI",
          bullets: [
            "Paste the SVG in Format > SVG (text or data URI).",
            "Adjust colors for matched/unmatched areas.",
            "Enable/disable labels and set min/max sizes.",
            "If the SVG doesn't show, check the viewBox."
          ]
        },
        {
          title: "Tip 5: Interactions",
          bullets: [
            "Click an area to filter.",
            "Ctrl + click for multi-select.",
            "Click outside areas to clear selection.",
            "Right-click to open the context menu."
          ]
        },
        {
          title: "Tip 6: Navigation and zoom",
          bullets: [
            "Use the mouse wheel to zoom in/out.",
            "Drag the background to pan when zoomed.",
            "If zoom gets odd, zoom out until it resets.",
            "Avoid SVGs with very different width/height scales."
          ]
        }
      ];
    }

    return [
      {
        title: "Dica 1: Preparar o SVG",
        bullets: [
          "Garanta que cada area tenha um ID unico e estavel.",
          "Use IDs que casem com a categoria (ex.: curral_1, curral_2).",
          "Evite grupos sem ID: somente IDs mapeiam dados.",
          "Se usar imagens, prefira PNG embutido (data:image/png)."
        ]
      },
      {
        title: "Dica 2: Botao Trocar SVG",
        bullets: [
          "Use o botao \"Trocar SVG\" para selecionar um arquivo .svg.",
          "Ele fica no canto superior direito do visual.",
          "Funciona apenas no Power BI Desktop."
        ]
      },
      {
        title: "Dica 3: Seguranca do SVG",
        bullets: [
          "O visual limpa o SVG automaticamente antes de renderizar.",
          "Scripts, eventos e referencias externas inseguras sao removidos.",
          "Prefira SVGs limpos, com IDs unicos e estaveis."
        ]
      },
      {
        title: "Dica 4: Configurar no Power BI",
        bullets: [
          "Cole o SVG em Formatar > SVG (texto ou data URI).",
          "Ajuste as cores em Area para correspondencia e nao correspondencia.",
          "Ative/desative rotulos e defina tamanhos minimo e maximo.",
          "Se o SVG nao aparecer, confira o viewBox do arquivo."
        ]
      },
      {
        title: "Dica 5: Interacoes",
        bullets: [
          "Clique em uma area para filtrar.",
          "Ctrl + clique para multisselecao.",
          "Clique fora das areas para limpar selecao.",
          "Clique com o botao direito para menu de contexto."
        ]
      },
      {
        title: "Dica 6: Navegacao e zoom",
        bullets: [
          "Use o scroll do mouse para zoom in/out.",
          "Arraste o fundo para mover (pan) quando estiver com zoom.",
          "Se o zoom ficar estranho, use zoom out ate o ajuste automatico.",
          "Evite SVGs com escala muito diferente entre width e height."
        ]
      }
    ];
  }

  private setHelpPage(index: number) {
    const helpLang = resolveLanguage(this.settings?.ui?.language);
    const pages = this.getHelpPages(helpLang);
    const clamped = Math.max(0, Math.min(index, pages.length - 1));
    this.helpPageIndex = clamped;
    const page = pages[clamped];

    this.helpTitleEl.textContent = page.title;
    this.helpListEl.textContent = "";
    for (const bullet of page.bullets) {
      const li = document.createElement("li");
      li.textContent = bullet;
      this.helpListEl.appendChild(li);
    }

    this.helpDotsEl.textContent = "";
    const dotLabelPrefix = helpLang === "pt" ? "Ir para dica" : "Go to tip";
    pages.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.className = "sp-help-dot" + (i === clamped ? " is-active" : "");
      dot.setAttribute("role", "button");
      dot.setAttribute("aria-label", `${dotLabelPrefix} ${i + 1}`);
      dot.addEventListener("click", () => this.setHelpPage(i));
      this.helpDotsEl.appendChild(dot);
    });

    this.helpPrevBtn.textContent = helpLang === "pt" ? "Anterior" : "Previous";
    this.helpNextBtn.textContent = helpLang === "pt" ? "Proxima" : "Next";
    this.helpPrevBtn.disabled = clamped === 0;
    this.helpNextBtn.disabled = clamped === pages.length - 1;
    if (this.helpCloseBtn) {
      this.helpCloseBtn.setAttribute("aria-label", helpLang === "pt" ? "Fechar dicas" : "Close tips");
    }

    const highlightUpload = clamped === 1;
    const highlightWarning = clamped === 2;
    const helpVisible = !!this.helpEl && this.helpEl.style.display !== "none";
    const effectiveUpload = highlightUpload && helpVisible;
    const effectiveWarning = highlightWarning && helpVisible;
    if (this.helpEl) {
      if (effectiveUpload) {
        this.helpEl.style.left = "auto";
        this.helpEl.style.right = "10px";
        this.helpEl.style.top = "48px";
        this.helpEl.style.maxWidth = "320px";
        this.helpEl.style.bottom = "";
      } else if (effectiveWarning) {
        this.helpEl.style.left = "10px";
        this.helpEl.style.right = "";
        this.helpEl.style.top = "auto";
        this.helpEl.style.bottom = "60px";
        this.helpEl.style.maxWidth = "360px";
      } else {
        this.helpEl.style.left = "10px";
        this.helpEl.style.right = "";
        this.helpEl.style.top = "10px";
        this.helpEl.style.maxWidth = "360px";
        this.helpEl.style.bottom = "";
      }
    }
    this.setUploadButtonEmphasis(effectiveUpload);
    if (this.lastSanitizationReport && this.lastSanitizationSig) {
      if (effectiveWarning) {
        this.setSanitizationWarning(this.lastSanitizationReport, this.lastSanitizationSig, true);
      } else {
        this.setSanitizationWarning(this.lastSanitizationReport, this.lastSanitizationSig, false);
      }
    }
  }

  private updateHelpVisibility(hasSvg: boolean, forceShow: boolean = false) {
    if (!this.helpEl) return;
    if (!this.canShowSvgPickerUI()) {
      this.helpEl.style.display = "none";
      return;
    }
    const show = !!this.settings?.help?.show;
    if (forceShow) {
      this.helpDismissed = false;
      this.helpShownThisSession = true;
    }
    const shouldShow =
      show && hasSvg && !this.helpDismissed && (forceShow || !this.helpSeenPersisted || this.helpShownThisSession);
    if (shouldShow) {
      this.helpShownThisSession = true;
      if (!this.helpSeenPersisted) {
        this.helpSeenPersisted = true;
        this.writeStoredValue(UI_STORAGE_KEYS.helpSeen, "1");
      }
    }
    this.helpEl.style.display = shouldShow ? "block" : "none";
  }

  private createLegendUI(): HTMLDivElement {
    const host = document.createElement("div");
    host.className = "sp-legend";
    Object.assign(host.style, {
      display: "none",
      flex: "0 0 auto",
      padding: "6px 8px",
      overflow: "auto",
      fontFamily: "Segoe UI, -apple-system, Roboto, Arial, sans-serif",
      color: "#111"
    } as CSSStyleDeclaration);
    this.contentHost.appendChild(host);
    return host;
  }

  private hideLegend(): void {
    this.legendHost.style.display = "none";
    this.legendHost.textContent = "";
    this.contentHost.style.flexDirection = "column";
    this.contentHost.style.gap = "0";
    this.legendHost.style.width = "";
    this.legendHost.style.height = "";
    this.legendHost.style.maxWidth = "";
    this.legendHost.style.maxHeight = "";
    this.legendHost.style.order = "1";
    this.svgHost.style.order = "0";
  }

  private getLegendLabelForRow(row: CatRow): string {
    const label = String(row.legendRawKey || "").trim();
    if (label) return label;
    const raw = String(row.rawKey || "").trim();
    if (raw) return raw;
    const key = String(row.key || "").trim();
    return key || "(sem legenda)";
  }

  private getLegendGroupKeyForRow(row: CatRow): string {
    return legendGroupKey(this.getLegendLabelForRow(row));
  }

  private updateLegend(dv?: DataView, hasSvg?: boolean) {
    const legend = this.settings.legend;
    void dv;
    if (!legend?.show || !hasSvg || this.dataMap.size === 0) {
      this.hideLegend();
      return;
    }

    this.legendHost.textContent = "";

    const titleText = (legend.title || "").trim();
    if (titleText) {
      const title = document.createElement("div");
      title.textContent = titleText;
      Object.assign(title.style, {
        fontWeight: "700",
        marginBottom: "4px"
      } as CSSStyleDeclaration);
      this.legendHost.appendChild(title);
    }

    const items = document.createElement("div");
    const pos = (legend.position || "Bottom").toLowerCase();
    const vertical = pos === "left" || pos === "right";
    Object.assign(items.style, {
      display: "flex",
      flexDirection: vertical ? "column" : "row",
      flexWrap: vertical ? "nowrap" : "wrap",
      gap: "6px 12px"
    } as CSSStyleDeclaration);

    const fontSize = Math.max(8, Number(legend.fontSize) || 12);
    const labelColor = legend.labelColor || "#111111";
    const inHighContrast = this.isHighContrastMode();
    const hcPalette = inHighContrast ? this.getHighContrastPalette() : null;
    const effectiveLabelColor = inHighContrast && hcPalette ? hcPalette.foreground : labelColor;

    const legendRowsByKey = new Map<string, CatRow[]>();
    const uniqueLegendRows = new Map<string, CatRow>();
    for (const row of this.dataMap.values()) {
      const legendKey = this.getLegendGroupKeyForRow(row);
      if (!legendRowsByKey.has(legendKey)) legendRowsByKey.set(legendKey, []);
      legendRowsByKey.get(legendKey)?.push(row);
      if (!uniqueLegendRows.has(legendKey)) {
        uniqueLegendRows.set(legendKey, row);
      }
    }

    for (const row of uniqueLegendRows.values()) {
      const legendKey = this.getLegendGroupKeyForRow(row);
      const rowsForLegend = legendRowsByKey.get(legendKey) || [row];
      const contextRow = rowsForLegend[0] || row;
      const legendLabel = this.getLegendLabelForRow(row);

      const item = document.createElement("div");
      item.setAttribute("data-sp-legend-group", legendKey);
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.setAttribute("aria-label", `Legenda: ${legendLabel}`);
      Object.assign(item.style, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        minWidth: "0",
        cursor: "pointer",
        userSelect: "none"
      } as CSSStyleDeclaration);

      const swatchColor =
        inHighContrast && hcPalette ? hcPalette.foreground : row.fillColor || this.settings.area.matchedFill;
      const swatch = document.createElement("span");
      Object.assign(swatch.style, {
        width: "10px",
        height: "10px",
        borderRadius: "2px",
        flex: "0 0 auto",
        background: swatchColor,
        border: `1px solid ${swatchColor}`
      } as CSSStyleDeclaration);
      swatch.style.setProperty("-webkit-print-color-adjust", "exact");
      swatch.style.setProperty("print-color-adjust", "exact");

      const label = document.createElement("span");
      label.textContent = legendLabel;
      Object.assign(label.style, {
        fontSize: `${fontSize}px`,
        color: effectiveLabelColor,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "220px"
      } as CSSStyleDeclaration);

      item.appendChild(swatch);
      item.appendChild(label);
      items.appendChild(item);

      item.addEventListener("click", (ev: MouseEvent) => {
        if (ev.button !== 0) return;
        ev.stopPropagation();
        const multi = ev.ctrlKey || ev.metaKey;
        this.selectRows(rowsForLegend, multi);
      });

      item.addEventListener("contextmenu", (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
        const x = ev.clientX;
        const y = ev.clientY;
        const selectedInLegend = rowsForLegend.some((r) => this.selectedKeys.has(r.key));
        if (selectedInLegend) {
          this.showContextMenuAt(contextRow.identity as any, x, y);
          return;
        }
        this.selectRows(rowsForLegend, false, () => this.showContextMenuAt(contextRow.identity as any, x, y));
      });

      item.addEventListener("keydown", (ev: KeyboardEvent) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ev.stopPropagation();
          const multi = ev.ctrlKey || ev.metaKey;
          this.selectRows(rowsForLegend, multi);
          return;
        }
        if (ev.key === "ContextMenu" || (ev.shiftKey && ev.key === "F10")) {
          ev.preventDefault();
          ev.stopPropagation();
          const rect = item.getBoundingClientRect();
          const x = Math.round(rect.left + rect.width / 2);
          const y = Math.round(rect.top + rect.height / 2);
          const selectedInLegend = rowsForLegend.some((r) => this.selectedKeys.has(r.key));
          if (selectedInLegend) {
            this.showContextMenuAt(contextRow.identity as any, x, y);
            return;
          }
          this.selectRows(rowsForLegend, false, () => this.showContextMenuAt(contextRow.identity as any, x, y));
        }
      });
    }

    this.legendHost.appendChild(items);

    const verticalLayout = pos === "left" || pos === "right";
    this.contentHost.style.flexDirection = verticalLayout ? "row" : "column";
    this.contentHost.style.gap = "6px";

    Object.assign(this.legendHost.style, {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      flex: "0 0 auto"
    } as CSSStyleDeclaration);

    const legendFirst = pos === "top" || pos === "left";
    this.legendHost.style.order = legendFirst ? "0" : "1";
    this.svgHost.style.order = legendFirst ? "1" : "0";
    this.svgHost.style.flex = "1 1 auto";

    if (verticalLayout) {
      this.legendHost.style.height = "100%";
      this.legendHost.style.maxWidth = "35%";
      this.legendHost.style.width = "";
      this.legendHost.style.maxHeight = "";
    } else {
      this.legendHost.style.width = "100%";
      this.legendHost.style.maxHeight = "35%";
      this.legendHost.style.height = "";
      this.legendHost.style.maxWidth = "";
    }

    this.applySelectionVisualState();
  }

  private setUploadUIVisibility(hasSvgConfigured: boolean) {
    const allow = this.canShowSvgPickerUI();
    this.uploadBtn.style.display = "none";
    this.uploadCta.style.display = !hasSvgConfigured && allow ? "flex" : "none";
  }

  private setEditorButtonVisibility(hasSvgConfigured: boolean, options?: VisualUpdateOptions) {
    if (!this.editorButton) return;
    const show = this.canShowEditorButton(options, hasSvgConfigured);
    this.editorButton.style.display = show ? "inline-flex" : "none";
    this.editorButton.setAttribute("aria-hidden", show ? "false" : "true");
    this.editorButton.tabIndex = show ? 0 : -1;
    if (!show && this.editorOpen) {
      this.editorOpen = false;
    }
  }

  private showNoSvgMessageOutsideDesktop() {
    this.clearSvg();

    const msg = document.createElement("div");
    msg.className = "sp-no-svg-msg";
    Object.assign(msg.style, {
      position: "absolute",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "18px",
      textAlign: "center",
      color: "rgba(255,255,255,0.85)",
      fontFamily: "Segoe UI, -apple-system, Roboto, Arial, sans-serif"
    } as CSSStyleDeclaration);

    const msgBody = document.createElement("div");
    msgBody.style.maxWidth = "520px";

    const msgTitle = document.createElement("div");
    Object.assign(msgTitle.style, {
      fontWeight: "800",
      fontSize: "16px",
      marginBottom: "6px"
    } as CSSStyleDeclaration);
    msgTitle.textContent = "SVG nao configurado";

    const msgText = document.createElement("div");
    Object.assign(msgText.style, {
      opacity: ".85",
      fontSize: "13px",
      lineHeight: "1.35"
    } as CSSStyleDeclaration);
    msgText.appendChild(document.createTextNode("Abra o relatorio no "));
    const msgStrong = document.createElement("span");
    msgStrong.style.fontWeight = "700";
    msgStrong.textContent = "Power BI Desktop";
    msgText.appendChild(msgStrong);
    msgText.appendChild(document.createTextNode(" para selecionar/configurar o SVG deste visual."));

    msgBody.appendChild(msgTitle);
    msgBody.appendChild(msgText);
    msg.appendChild(msgBody);
    this.container.appendChild(msg);
  }

  private clearSvg(preserveDrillFocus = false): void {
    if (this.fitRafId !== null) {
      cancelAnimationFrame(this.fitRafId);
      this.fitRafId = null;
    }
    this.cancelRegionStyleBatch();
    if (this.svgRoot && !preserveDrillFocus) {
      this.svgRoot.remove();
      this.svgRoot = null;
      this.zoomRoot = null;
    }
    this.regionElementsById.clear();
    this.regionBBoxesById.clear();
    this.regionIds = [];
    this.lastRenderedSvgSignature = null;
    if (!preserveDrillFocus) {
      this.pendingDrillFocus = false;
      this.drillFocusPhase = "idle";
      this.drillRevealSvgRoot = null;
      this.clearPotentialDrillClickTransition(false);
      this.clearDrillLoadingTimeout();
      this.hideDrillLoading();
    }
    if (this.svgHost && !preserveDrillFocus) {
      this.svgHost.querySelectorAll("svg").forEach((el) => el.remove());
    }
    this.container.querySelectorAll(".sp-no-svg-msg").forEach((e) => e.remove());
    this.setSanitizationWarning(null, null);
  }

  // --- coord utils ---
  private clientToSvgPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!this.svgRoot) return null;
    const ctm = this.svgRoot.getScreenCTM();
    if (!ctm) return null;

    const pt = this.svgRoot.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;

    const inv = ctm.inverse();
    const res = pt.matrixTransform(inv);
    return { x: res.x, y: res.y };
  }

  private applyZoomTransform() {
    if (!this.zoomRoot) return;
    this.zoomRoot.setAttribute("transform", `translate(${this.tx} ${this.ty}) scale(${this.scale})`);
    this.applyLabelZoomCompensation();
  }

  private resetToFit() {
    this.scale = this.fitTransform.scale;
    this.tx = this.fitTransform.tx;
    this.ty = this.fitTransform.ty;
    this.applyZoomTransform();
  }

  private applyLabelZoomCompensation(): void {
    if (!this.zoomRoot || this.settings.svgSettings.labelScaleMode !== "FixedScreenSize") return;
    const scale = Number.isFinite(this.scale) && this.scale > 0 ? this.scale : 1;
    const minScreen = Math.max(1, Number(this.settings.svgSettings.labelMinScreenPx) || 8);
    const maxScreen = Math.max(minScreen, Number(this.settings.svgSettings.labelMaxScreenPx) || 22);
    const rawHideBelow = Number(this.settings.svgSettings.labelHideBelowAreaPx);
    const hideBelow = Number.isFinite(rawHideBelow) ? Math.max(0, rawHideBelow) : 0;

    const labels = Array.from(this.zoomRoot.querySelectorAll<SVGTextElement>("text.sp-label[data-for]"));
    for (const label of labels) {
      const areaId = label.getAttribute("data-for") || "";
      const region = areaId ? this.regionElementsById.get(areaId) : null;
      if (region && hideBelow > 0) {
        const bbox = this.getCachedRegionBBox(region);
        const screenMinSide = Math.min(bbox.width * scale, bbox.height * scale);
        if (Number.isFinite(screenMinSide) && screenMinSide < hideBelow) {
          (label as any).style.display = "none";
          continue;
        }
      }

      const baseFont = Number(label.getAttribute("data-sp-base-font-size")) || Number(label.getAttribute("font-size")) || 12;
      const baseStroke =
        Number(label.getAttribute("data-sp-base-stroke-width")) || Number(label.getAttribute("stroke-width")) || 0;
      const fontSize = clamp(baseFont / scale, minScreen / scale, maxScreen / scale);
      const strokeScreenMax = Math.max(1, Math.round(maxScreen * Math.max(0, Number(this.settings.svgSettings.labelOutlineFactor) || 0.12)));
      const strokeScreen = clamp(baseStroke, 0, strokeScreenMax);
      label.setAttribute("font-size", String(fontSize));
      label.setAttribute("stroke-width", String(Math.max(0, strokeScreen / scale)));
      label.setAttribute("vector-effect", "non-scaling-stroke");
      (label as any).style.display = "";
    }
  }

  private getRenderableRegionElements(): SVGElement[] {
    return this.regionIds
      .map((id) => this.regionElementsById.get(id))
      .filter((el): el is SVGElement => !!el);
  }

  private rebuildRegionCache(): void {
    this.regionElementsById.clear();
    this.regionBBoxesById.clear();
    this.regionIds = [];
    if (!this.zoomRoot) return;
    const selector = "path[id], polygon[id], rect[id], circle[id], ellipse[id], g[id]";
    const regions = Array.from(this.zoomRoot.querySelectorAll<SVGElement>(selector));
    for (const el of regions) {
      const id = ((el as any).id as string) || "";
      if (!id || this.regionElementsById.has(id)) continue;
      if (el.tagName.toLowerCase() === "g") {
        const nested = el.querySelector("path[id], polygon[id], rect[id], circle[id], ellipse[id], g[id]");
        if (nested) continue;
      }
      this.regionElementsById.set(id, el);
      this.regionIds.push(id);
    }
  }

  private isSvgRegionCandidate(el: SVGElement): boolean {
    if (!((el as any).id as string)) return false;
    if (el.tagName.toLowerCase() === "g") {
      const nested = el.querySelector("path[id], polygon[id], rect[id], circle[id], ellipse[id], g[id]");
      if (nested) return false;
    }
    return true;
  }

  private shouldPruneSvgToDrillDataScope(): boolean {
    return (
      this.settings.drillMaps.enabled &&
      this.settings.drillMaps.normalizeDrillFocus &&
      this.settings.drillMaps.drillRenderScopeMode === "DrillDataOnly" &&
      this.settings.drillMaps.noDataBehavior === "Hide" &&
      Number(this.activeMap.map?.level) > 0 &&
      this.dataMap.size > 0
    );
  }

  private pruneEmptySvgGroups(svg: SVGSVGElement): void {
    let removed = true;
    while (removed) {
      removed = false;
      const groups = Array.from(svg.querySelectorAll<SVGGElement>("g")).reverse();
      for (const group of groups) {
        if (group.querySelector("path, polygon, rect, circle, ellipse, line, polyline, text, image, use")) continue;
        if (group.children.length === 0 && !group.textContent?.trim()) {
          group.remove();
          removed = true;
        }
      }
    }
  }

  private pruneSvgToDrillDataScope(svg: SVGSVGElement): DrillSvgPruneResult {
    const result: DrillSvgPruneResult = { pruned: false, keptIds: new Set<string>(), removedCount: 0 };
    if (!this.shouldPruneSvgToDrillDataScope()) return result;

    const selector = "path[id], polygon[id], rect[id], circle[id], ellipse[id], g[id]";
    const regions = Array.from(svg.querySelectorAll<SVGElement>(selector)).filter((el) =>
      this.isSvgRegionCandidate(el)
    );
    if (!regions.length) return result;

    for (const el of regions) {
      const id = ((el as any).id as string) || "";
      if (!id || this.isAreaHidden(id)) continue;
      if (this.getBoundRowForElementId(id)) {
        result.keptIds.add(id);
      }
    }

    if (result.keptIds.size === 0 || result.keptIds.size === regions.length) {
      return result;
    }

    for (const el of regions) {
      const id = ((el as any).id as string) || "";
      if (!id || result.keptIds.has(id)) continue;
      el.remove();
      result.removedCount++;
    }
    this.pruneEmptySvgGroups(svg);
    result.pruned = result.removedCount > 0;
    return result;
  }

  private getDrillSvgScopeSignature(pruneResult: DrillSvgPruneResult): string {
    if (!this.shouldPruneSvgToDrillDataScope()) return "scope_all";
    if (pruneResult.keptIds.size > 0) {
      const ids = Array.from(pruneResult.keptIds).sort().join("|");
      return `scope_${hashString(ids)}_${pruneResult.keptIds.size}_${pruneResult.removedCount}`;
    }
    const dataKeys = Array.from(this.dataMap.keys()).sort().join("|");
    return `scope_empty_${hashString(dataKeys)}_${this.dataMap.size}`;
  }

  private getCachedRegionBBox(el: SVGElement): GeometryBBox {
    const id = ((el as any).id as string) || "";
    if (id) {
      const cached = this.regionBBoxesById.get(id);
      if (cached) return cached;
    }
    const bbox = getRegionBBox(el);
    if (id && bbox.width > 0 && bbox.height > 0) {
      this.regionBBoxesById.set(id, bbox);
    }
    return bbox;
  }

  private isDenseMap(): boolean {
    return !!this.settings.performance.denseModeEnabled &&
      this.regionIds.length >= Math.max(1, Number(this.settings.performance.denseAreaThreshold) || 1000);
  }

  private getSelectedRegionElementsForActiveMap(): SVGElement[] {
    if (this.selectedKeys.size === 0) return [];
    const selected: SVGElement[] = [];
    for (const id of this.regionIds) {
      if (this.isAreaHidden(id)) continue;
      if (this.isHiddenByRenderScope(id)) continue;
      const row = this.getBoundRowForElementId(id);
      const el = this.regionElementsById.get(id);
      if (row && el && this.selectedKeys.has(row.key)) selected.push(el);
    }
    return selected;
  }

  private getBoundRegionElementsForActiveMap(): SVGElement[] {
    const bound: SVGElement[] = [];
    for (const id of this.regionIds) {
      if (this.isAreaHidden(id)) continue;
      if (this.isHiddenByRenderScope(id)) continue;
      const row = this.getBoundRowForElementId(id);
      const el = this.regionElementsById.get(id);
      if (row && el) bound.push(el);
    }
    return bound;
  }

  private getDrillSpatialOutlierIds(bound: SVGElement[]): Set<string> {
    const outliers = new Set<string>();
    if (bound.length < 20) return outliers;

    const points = bound
      .map((el) => {
        const id = ((el as any).id as string) || "";
        const bbox = this.getCachedRegionBBox(el);
        if (!id || !(bbox.width > 0) || !(bbox.height > 0)) return null;
        return {
          id,
          cx: bbox.x + bbox.width / 2,
          cy: bbox.y + bbox.height / 2
        };
      })
      .filter((point): point is { id: string; cx: number; cy: number } => !!point);

    if (points.length < 20) return outliers;

    const nearestDistances: number[] = [];
    for (let i = 0; i < points.length; i++) {
      let nearest = Number.POSITIVE_INFINITY;
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        const distance = Math.hypot(points[i].cx - points[j].cx, points[i].cy - points[j].cy);
        if (distance < nearest) nearest = distance;
      }
      if (Number.isFinite(nearest)) nearestDistances.push(nearest);
    }
    if (!nearestDistances.length) return outliers;

    nearestDistances.sort((a, b) => a - b);
    const p75Index = Math.min(nearestDistances.length - 1, Math.max(0, Math.floor(nearestDistances.length * 0.75)));
    const typicalNeighbor = nearestDistances[p75Index];
    const bbox = this.getElementBBox(bound);
    const shorterSide = bbox ? Math.min(bbox.width, bbox.height) : 0;
    const clusterDistance = Math.max(typicalNeighbor * 8, shorterSide * 0.12, 8);

    const parent = Array.from({ length: points.length }, (_, index) => index);
    const find = (index: number): number => {
      let root = index;
      while (parent[root] !== root) root = parent[root];
      while (parent[index] !== index) {
        const next = parent[index];
        parent[index] = root;
        index = next;
      }
      return root;
    };
    const union = (a: number, b: number) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent[rootB] = rootA;
    };

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (Math.hypot(points[i].cx - points[j].cx, points[i].cy - points[j].cy) <= clusterDistance) {
          union(i, j);
        }
      }
    }

    const components = new Map<number, number[]>();
    for (let i = 0; i < points.length; i++) {
      const root = find(i);
      const list = components.get(root) || [];
      list.push(i);
      components.set(root, list);
    }
    if (components.size <= 1) return outliers;

    const sorted = Array.from(components.values()).sort((a, b) => b.length - a.length);
    const main = sorted[0];
    if (!main || main.length < points.length * 0.65) return outliers;

    const maxMinorSize = Math.max(2, Math.ceil(points.length * 0.03));
    for (const component of sorted.slice(1)) {
      if (component.length > maxMinorSize) continue;
      for (const index of component) outliers.add(points[index].id);
    }

    return outliers;
  }

  private getDrillDataRegionState(): { active: boolean; bound: SVGElement[]; unbound: SVGElement[] } {
    const regions = this.getRenderableRegionElements().filter((el) => {
      const id = ((el as any).id as string) || "";
      return !!id && !this.isAreaHidden(id);
    });
    if (!(this.settings.drillMaps.enabled && Number(this.activeMap.map?.level) > 0)) {
      return { active: false, bound: regions, unbound: [] };
    }
    const bound: SVGElement[] = [];
    const unbound: SVGElement[] = [];
    for (const el of regions) {
      const id = ((el as any).id as string) || "";
      const row = this.getBoundRowForElementId(id);
      if (row) bound.push(el);
      else unbound.push(el);
    }
    const active = bound.length > 0 && unbound.length > 0;
    return { active, bound, unbound };
  }

  private computeRenderScope(): RenderScopeState {
    const state = this.getDrillDataRegionState();
    const mode =
      this.settings.drillMaps.enabled &&
      this.settings.drillMaps.normalizeDrillFocus &&
      this.settings.drillMaps.drillRenderScopeMode === "DrillDataOnly" &&
      this.settings.drillMaps.noDataBehavior === "Hide" &&
      state.bound.length > 0 &&
      Number(this.activeMap.map?.level) > 0
        ? "DrillDataOnly"
        : "AllMapAreas";
    const spatialOutlierIds = mode === "DrillDataOnly" ? this.getDrillSpatialOutlierIds(state.bound) : new Set<string>();
    const boundIds = new Set(
      state.bound
        .map((el) => ((el as any).id as string) || "")
        .filter((id) => !!id && !spatialOutlierIds.has(id))
    );
    const unboundIds = new Set(state.unbound.map((el) => ((el as any).id as string) || "").filter(Boolean));
    for (const id of spatialOutlierIds) unboundIds.add(id);

    return {
      active: mode === "DrillDataOnly" && (state.unbound.length > 0 || spatialOutlierIds.size > 0),
      mode,
      boundIds,
      unboundIds,
      spatialOutlierIds
    };
  }

  private refreshRenderScope(): RenderScopeState {
    this.renderScope = this.computeRenderScope();
    return this.renderScope;
  }

  private isHiddenByRenderScope(id: string): boolean {
    return (
      this.renderScope.active &&
      this.renderScope.mode === "DrillDataOnly" &&
      (this.renderScope.unboundIds.has(id) || this.renderScope.spatialOutlierIds.has(id))
    );
  }

  private containsBoundRenderScopeRegion(el: SVGElement): boolean {
    if (!this.renderScope.active || this.renderScope.boundIds.size === 0) return false;
    for (const id of this.renderScope.boundIds) {
      const bound = this.regionElementsById.get(id);
      if (bound && bound !== el && el.contains(bound)) return true;
    }
    return false;
  }

  private getElementBBox(elements: SVGElement[]): GeometryBBox | null {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const el of elements) {
      const bbox = this.getCachedRegionBBox(el);
      if (!(bbox.width > 0) || !(bbox.height > 0)) continue;
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private getElementFocusBBox(el: SVGElement): GeometryBBox {
    const zoomRoot = this.zoomRoot as unknown as SVGGraphicsElement | undefined;
    if (zoomRoot) {
      const transformed = getRegionBBoxInAncestorSpace(el, zoomRoot);
      if (transformed && transformed.width > 0 && transformed.height > 0) {
        return transformed;
      }
    }
    return this.getCachedRegionBBox(el);
  }

  private getCombinedFocusBBox(elements: SVGElement[]): GeometryBBox | null {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const el of elements) {
      const bbox = this.getElementFocusBBox(el);
      if (!(bbox.width > 0) || !(bbox.height > 0)) continue;
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private calculateDynamicDrillScale(
    elements: SVGElement[],
    fitScale: number,
    viewportW: number,
    viewportH: number,
    hostW: number,
    hostH: number
  ): number {
    const minScale = Math.max(1, Number(this.settings.drillMaps.drillMinFocusScale) || 2.5);
    const maxScale = Math.max(minScale, Number(this.settings.drillMaps.drillMaxFocusScale) || 24);
    if (!this.settings.drillMaps.normalizeDrillFocus || elements.length === 0) {
      return Math.min(Math.max(fitScale, minScale), maxScale);
    }

    const targetScreenPx = clamp(Number(this.settings.drillMaps.drillTargetAreaScreenPx) || 28, 1, 512);
    const percentile = clamp(Number(this.settings.drillMaps.drillAreaScalePercentile) || 35, 1, 99);
    const hostToViewBoxScale = Math.min(hostW / Math.max(viewportW, 1), hostH / Math.max(viewportH, 1));
    if (!Number.isFinite(hostToViewBoxScale) || hostToViewBoxScale <= 0) {
      return Math.min(Math.max(fitScale, minScale), maxScale);
    }

    const dimensions: number[] = [];
    for (const el of elements) {
      const bbox = this.getElementFocusBBox(el);
      if (!(bbox.width > 0) || !(bbox.height > 0)) continue;
      const geometricSize = Math.sqrt(bbox.width * bbox.height);
      if (Number.isFinite(geometricSize) && geometricSize > 0) {
        dimensions.push(geometricSize);
      }
    }
    if (!dimensions.length) {
      return Math.min(Math.max(fitScale, minScale), maxScale);
    }

    dimensions.sort((a, b) => a - b);
    const percentileIndex = Math.min(
      dimensions.length - 1,
      Math.max(0, Math.round(((percentile - 1) / 98) * (dimensions.length - 1)))
    );
    const typicalAreaSize = dimensions[percentileIndex];
    const normalizedScale = targetScreenPx / (typicalAreaSize * hostToViewBoxScale);
    const scale = Math.max(fitScale, minScale, normalizedScale);
    return Math.min(scale, maxScale);
  }

  private focusNormalizedBBox(elements: SVGElement[], useDrillMinimum = false, durationOverrideMs?: number): void {
    if (!this.zoomRoot || !this.svgRoot || elements.length === 0) return;

    const bbox = this.getCombinedFocusBBox(elements);
    if (!bbox || !(bbox.width > 0) || !(bbox.height > 0)) return;

    const hostW = this.svgHost.clientWidth;
    const hostH = this.svgHost.clientHeight;
    const vb = this.svgRoot.viewBox?.baseVal;
    const viewportX = vb && Number.isFinite(vb.x) ? vb.x : 0;
    const viewportY = vb && Number.isFinite(vb.y) ? vb.y : 0;
    const viewportW = vb && vb.width > 0 ? vb.width : hostW;
    const viewportH = vb && vb.height > 0 ? vb.height : hostH;
    const configuredPadding = useDrillMinimum
      ? Number(this.settings.drillMaps.drillFocusPaddingPct)
      : Number(this.settings.interaction.focusPadding);
    const padPct = clamp(Number.isFinite(configuredPadding) ? configuredPadding : 10, 0, 45) / 100;
    const padX = viewportW * padPct;
    const padY = viewportH * padPct;
    const fitW = viewportW - padX * 2;
    const fitH = viewportH - padY * 2;
    if (!(fitW > 0) || !(fitH > 0)) return;

    let scale = Math.min(fitW / bbox.width, fitH / bbox.height);
    if (useDrillMinimum && this.settings.drillMaps.normalizeDrillFocus) {
      scale = this.calculateDynamicDrillScale(elements, scale, viewportW, viewportH, hostW, hostH);
    } else {
      scale = Math.min(scale, this.getMaxInteractiveZoomScale());
    }
    if (!Number.isFinite(scale) || scale <= 0) return;

    const tx = viewportX + viewportW / 2 - (bbox.x + bbox.width / 2) * scale;
    const ty = viewportY + viewportH / 2 - (bbox.y + bbox.height / 2) * scale;
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
    const durationMs =
      durationOverrideMs === undefined ? this.settings.interaction.focusAnimationMs : durationOverrideMs;
    this.animateZoomTransform({ scale, tx, ty }, durationMs);
  }

  private focusElements(elements: SVGElement[]): void {
    this.focusNormalizedBBox(elements, false);
  }

  private getMaxInteractiveZoomScale(): number {
    const drillMax = Number(this.settings.drillMaps.drillMaxFocusScale) || 24;
    const fitRelativeMax = (Number(this.fitTransform.scale) || 1) * 16;
    return Math.max(24, drillMax * 4, fitRelativeMax);
  }

  private focusDrillDataAreas(settle = false): void {
    if (!this.settings.drillMaps.focusDataAreas || this.isPanning) return;
    const duration = settle ? 0 : undefined;
    const state = this.getDrillDataRegionState();
    if (!state.active) {
      const bound = this.getBoundRegionElementsForActiveMap();
      if (bound.length > 0 && (Number(this.activeMap.map?.level) > 0 || bound.length < this.regionIds.length)) {
        this.focusNormalizedBBox(bound, true, duration);
      } else {
        this.animateZoomTransform(this.fitTransform, this.settings.interaction.focusAnimationMs);
      }
      return;
    }
    this.focusNormalizedBBox(state.bound, true, duration);
  }

  private getCurrentDrillFocusElements(): SVGElement[] {
    const state = this.getDrillDataRegionState();
    if (state.active && state.bound.length > 0) return state.bound;
    return this.getBoundRegionElementsForActiveMap();
  }

  private getFocusedElementsScreenBBox(elements: SVGElement[]): ScreenBBox | null {
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    for (const el of elements) {
      if (!el.isConnected || this.isHiddenByRenderScope(el.getAttribute("data-sp-id") || el.id || "")) continue;
      const rect = el.getBoundingClientRect();
      if (!(rect.width > 0) || !(rect.height > 0)) continue;
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    }

    if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) return null;
    const width = right - left;
    const height = bottom - top;
    return { left, top, right, bottom, width, height, centerX: left + width / 2, centerY: top + height / 2 };
  }

  private getSvgViewScale(): number {
    if (!this.svgRoot) return 1;
    const rect = this.svgRoot.getBoundingClientRect();
    const vb = this.svgRoot.viewBox?.baseVal;
    if (!vb || !(vb.width > 0) || !(vb.height > 0) || !(rect.width > 0) || !(rect.height > 0)) return 1;
    const scale = Math.min(rect.width / vb.width, rect.height / vb.height);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  private correctDrillFocusScreenFit(elements: SVGElement[]): boolean {
    if (!this.svgHost || !this.svgRoot || !this.zoomRoot || !elements.length || this.isPanning) return false;
    const hostRect = this.svgHost.getBoundingClientRect();
    let screenBBox = this.getFocusedElementsScreenBBox(elements);
    if (!screenBBox || !(hostRect.width > 0) || !(hostRect.height > 0)) return false;

    const padPct = clamp(Number(this.settings.drillMaps.drillFocusPaddingPct) || 10, 0, 45) / 100;
    const padPx = Math.max(8, Math.min(hostRect.width, hostRect.height) * padPct);
    const availableW = Math.max(1, hostRect.width - padPx * 2);
    const availableH = Math.max(1, hostRect.height - padPx * 2);
    const scaleCorrection = Math.min(1, availableW / screenBBox.width, availableH / screenBBox.height);
    if (Number.isFinite(scaleCorrection) && scaleCorrection > 0 && scaleCorrection < 0.995) {
      const bbox = this.getCombinedFocusBBox(elements);
      if (!bbox) return false;
      const vb = this.svgRoot.viewBox?.baseVal;
      const viewportX = vb && Number.isFinite(vb.x) ? vb.x : 0;
      const viewportY = vb && Number.isFinite(vb.y) ? vb.y : 0;
      const viewportW = vb && vb.width > 0 ? vb.width : this.svgHost.clientWidth;
      const viewportH = vb && vb.height > 0 ? vb.height : this.svgHost.clientHeight;
      this.scale = this.scale * scaleCorrection;
      this.tx = viewportX + viewportW / 2 - (bbox.x + bbox.width / 2) * this.scale;
      this.ty = viewportY + viewportH / 2 - (bbox.y + bbox.height / 2) * this.scale;
      this.applyZoomTransform();
      screenBBox = this.getFocusedElementsScreenBBox(elements);
      if (!screenBBox) return true;
    }

    const dxPx = hostRect.left + hostRect.width / 2 - screenBBox.centerX;
    const dyPx = hostRect.top + hostRect.height / 2 - screenBBox.centerY;
    if (Math.abs(dxPx) <= 1 && Math.abs(dyPx) <= 1) return false;
    const viewScale = this.getSvgViewScale();
    this.tx += dxPx / viewScale;
    this.ty += dyPx / viewScale;
    this.applyZoomTransform();
    return true;
  }

  private resetFocusToCurrentScope(): void {
    if (!this.svgRoot || !this.zoomRoot || this.isPanning) return;
    this.computeFitTransform();
    this.refreshRenderScope();
    if (this.settings.drillMaps.focusDataAreas && Number(this.activeMap.map?.level) > 0) {
      const bound = this.getBoundRegionElementsForActiveMap();
      if (bound.length > 0) {
        this.focusNormalizedBBox(bound, true);
        return;
      }
    }
    this.animateZoomTransform(this.fitTransform, this.settings.interaction.focusAnimationMs);
  }

  private scheduleDrillFocusSettle(): void {
    if (!this.settings.drillMaps.focusDataAreas || Number(this.activeMap.map?.level) <= 0) return;
    const focusToken = this.drillFocusToken;
    const token = ++this.drillFocusSettleToken;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (focusToken !== this.drillFocusToken || token !== this.drillFocusSettleToken || !this.svgRoot || !this.zoomRoot || this.isPanning) return;
          if (this.getSelectedRegionElementsForActiveMap().length > 0) return;
          this.computeFitTransform();
          this.refreshRenderScope();
          this.focusDrillDataAreas(true);
          this.correctDrillFocusScreenFit(this.getCurrentDrillFocusElements());
        }, 80);
      });
    });
  }

  private scheduleFinalDrillFocusFit(focusToken: number, completeTransition = false): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (focusToken !== this.drillFocusToken || !this.svgRoot || !this.zoomRoot || this.isPanning) return;
          this.correctDrillFocusScreenFit(this.getCurrentDrillFocusElements());
          if (completeTransition && this.pendingDrillFocus) {
            this.completeDrillFocusTransition();
            this.scheduleDrillFocusSettle();
          }
        }, 40);
      });
    });
  }

  private computeFitTransform() {
    this.fitTransform = { scale: 1, tx: 0, ty: 0 };
    if (!this.svgRoot || !this.zoomRoot) return;

    const hostW = this.svgHost.clientWidth;
    const hostH = this.svgHost.clientHeight;
    if (!(hostW > 0) || !(hostH > 0)) return;

    let bbox: DOMRect | null = null;
    try {
      const measured = this.zoomRoot.getBBox();
      if (
        Number.isFinite(measured.x) &&
        Number.isFinite(measured.y) &&
        Number.isFinite(measured.width) &&
        Number.isFinite(measured.height) &&
        measured.width > 0 &&
        measured.height > 0
      ) {
        bbox = measured;
      }
    } catch {
      bbox = null;
    }
    if (!bbox) return;

    const vb = this.svgRoot.viewBox?.baseVal;
    const viewportX = vb && Number.isFinite(vb.x) ? vb.x : 0;
    const viewportY = vb && Number.isFinite(vb.y) ? vb.y : 0;
    const viewportW = vb && vb.width > 0 ? vb.width : hostW;
    const viewportH = vb && vb.height > 0 ? vb.height : hostH;
    const padPx = Math.max(8, Math.min(hostW, hostH) * 0.02);
    const padX = viewportW > 0 && hostW > 0 ? padPx * (viewportW / hostW) : padPx;
    const padY = viewportH > 0 && hostH > 0 ? padPx * (viewportH / hostH) : padPx;
    const fitW = viewportW - padX * 2;
    const fitH = viewportH - padY * 2;
    if (!(fitW > 0) || !(fitH > 0)) return;

    const scale = Math.min(fitW / bbox.width, fitH / bbox.height);
    if (!Number.isFinite(scale) || scale <= 0) return;

    const tx = viewportX + padX + (fitW - bbox.width * scale) / 2 - bbox.x * scale;
    const ty = viewportY + padY + (fitH - bbox.height * scale) / 2 - bbox.y * scale;
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

    this.fitTransform = { scale, tx, ty };
  }

  private scheduleFitToHost() {
    if (this.fitRafId !== null) {
      cancelAnimationFrame(this.fitRafId);
    }

    this.fitRafId = requestAnimationFrame(() => {
      this.fitRafId = null;
      if (!this.svgRoot || !this.zoomRoot) return;
      this.computeFitTransform();
      if (this.pendingDrillFocus && this.settings.drillMaps.focusDataAreas) {
        this.runDrillFocusStateMachine();
        return;
      }

      const selectedEls = this.getSelectedRegionElementsForActiveMap();
      if (selectedEls.length > 0) {
        this.focusElements(selectedEls);
      } else if (this.getDrillDataRegionState().active && this.settings.drillMaps.focusDataAreas) {
        this.focusDrillDataAreas();
      } else {
        this.resetToFit();
      }
    });
  }

  private runDrillFocusStateMachine(): void {
    if (!this.pendingDrillFocus || !this.settings.drillMaps.focusDataAreas) return;
    const token = this.drillFocusToken;

    if (this.drillFocusPhase === "mapResolved") {
      this.markDrillFocusDomInserted();
    }

    if (this.drillFocusPhase === "domInserted") {
      requestAnimationFrame(() => {
        if (token === this.drillFocusToken && this.pendingDrillFocus) {
          this.scheduleFitToHost();
        }
      });
      return;
    }

    if (this.drillFocusPhase !== "stylesApplied") return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (token !== this.drillFocusToken || !this.pendingDrillFocus || !this.svgRoot || !this.zoomRoot || this.isPanning) {
          return;
        }
        if (this.drillFocusPhase !== "stylesApplied") return;
        if (this.getSelectedRegionElementsForActiveMap().length > 0) {
          this.completeDrillFocusTransition();
          return;
        }

        this.computeFitTransform();
        this.refreshRenderScope();
        this.focusDrillDataAreas(true);
        this.scheduleFinalDrillFocusFit(token, true);
      });
    });
  }

  private getThemeColorForKey(key: string): string | null {
    try {
      const colorPalette = (this.host as any)?.colorPalette;
      if (!colorPalette?.getColor) return null;
      const color = colorPalette.getColor(key);
      const value = (color as any)?.value;
      return typeof value === "string" && value.trim() ? value : null;
    } catch {
      return null;
    }
  }

  private getThemeColorKey(
    row: Pick<CatRow, "rawKey" | "legendRawKey" | "colorKey"> | undefined,
    areaId: string
  ): string {
    const candidates = [row?.colorKey, row?.legendRawKey, row?.rawKey, areaId];
    const value = candidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
    return String(value || areaId || "area");
  }

  private getPowerBIThemeColor(
    row: Pick<CatRow, "rawKey" | "legendRawKey" | "colorKey"> | undefined,
    areaId: string,
    fallback: string
  ): string {
    const color = this.getThemeColorForKey(this.getThemeColorKey(row, areaId));
    return color || fallback;
  }

  private isHighContrastMode(): boolean {
    try {
      return !!((this.host as any)?.colorPalette?.isHighContrast);
    } catch {
      return false;
    }
  }

  private getHighContrastPalette(): { foreground: string; background: string; foregroundSelected: string } {
    const palette = (this.host as any)?.colorPalette;
    const fallbackForeground = "#000000";
    const fallbackBackground = "#FFFFFF";
    const readColor = (name: string, fallback: string): string => {
      const value = (palette as any)?.[name]?.value;
      return typeof value === "string" && value.trim() ? value : fallback;
    };
    const foreground = readColor("foreground", fallbackForeground);
    const background = readColor("background", fallbackBackground);
    const foregroundSelected = readColor("foregroundSelected", foreground);
    return { foreground, background, foregroundSelected };
  }

  private applyHighContrastHostStyles(): void {
    if (!this.isHighContrastMode()) {
      this.container.style.background = "";
      this.container.style.color = "";
      if (this.legendHost) this.legendHost.style.color = "#111";
      return;
    }
    const palette = this.getHighContrastPalette();
    this.container.style.background = palette.background;
    this.container.style.color = palette.foreground;
    if (this.legendHost) this.legendHost.style.color = palette.foreground;
  }

  private isAdvancedEditMode(options?: VisualUpdateOptions): boolean {
    const editMode = (options as any)?.editMode;
    return editMode === 1 || editMode === "Advanced" || String(editMode ?? "").toLowerCase() === "advanced";
  }

  private getCategoryColumns(dv?: DataView): DataViewCategoryColumn[] {
    const cat = dv?.categorical as DataViewCategorical | undefined;
    return (cat?.categories ?? []).filter((column) => !!column?.source?.roles?.category);
  }

  private getCategoryColumnName(column?: DataViewCategoryColumn | null): string | null {
    const name = column?.source?.queryName || column?.source?.displayName || "";
    return typeof name === "string" && name.trim().length > 0 ? name : null;
  }

  private getSingleCategoryValue(column: DataViewCategoryColumn): string | null {
    const unique = new Set<string>();
    for (const value of column.values || []) {
      const text = String(value ?? "").trim();
      if (!text) continue;
      unique.add(text);
      if (unique.size > 1) return null;
    }
    return unique.size === 1 ? Array.from(unique)[0] : null;
  }

  private getCurrentDrillValuePath(categoryColumns: DataViewCategoryColumn[]): string[] {
    if (categoryColumns.length <= 1) return [];
    const path: string[] = [];
    for (const column of categoryColumns.slice(0, categoryColumns.length - 1)) {
      const value = this.getSingleCategoryValue(column);
      if (!value) return [];
      path.push(value);
    }
    return path;
  }

  private isRenderableAreaElement(el: Element): boolean {
    const tag = el.tagName.toLowerCase();
    if (tag === "path") return typeof el.getAttribute("d") === "string" && !!el.getAttribute("d")?.trim();
    if (tag === "polygon" || tag === "polyline") return typeof el.getAttribute("points") === "string" && !!el.getAttribute("points")?.trim();
    if (tag === "rect") return !!el.getAttribute("width") && !!el.getAttribute("height");
    if (tag === "circle") return !!el.getAttribute("r");
    if (tag === "ellipse") return !!el.getAttribute("rx") && !!el.getAttribute("ry");
    if (tag === "g") {
      return !!el.querySelector("path[d], polygon[points], polyline[points], rect[width][height], circle[r], ellipse[rx][ry]");
    }
    return false;
  }

  private getSvgAreaIds(svgText: string): Set<string> {
    const key = `${hashString(svgText)}_${svgText.length}`;
    const cached = this.svgAreaIdCache.get(key);
    if (cached) return cached;

    const parser = new DOMParser();
    const doc = parser.parseFromString(decodeSvgDataUri(svgText), "image/svg+xml");
    const ids = new Set<string>();
    doc.querySelectorAll("[id]").forEach((el) => {
      if (el.closest("defs, pattern, clipPath, mask, marker, symbol")) return;
      if (!this.isRenderableAreaElement(el)) return;
      const id = norm(el.getAttribute("id") || "");
      if (id) ids.add(id);
    });
    this.svgAreaIdCache.set(key, ids);
    return ids;
  }

  private getCategoryMapMatchScore(mapSvgText: string, categoryColumn: DataViewCategoryColumn): number {
    const ids = this.getSvgAreaIds(mapSvgText);
    if (ids.size === 0) return 0;

    const uniqueValues = new Set<string>();
    for (const value of categoryColumn.values || []) {
      const normalized = norm(String(value ?? ""));
      if (normalized) uniqueValues.add(normalized);
      if (uniqueValues.size >= 500) break;
    }
    if (uniqueValues.size === 0) return 0;

    let matches = 0;
    uniqueValues.forEach((value) => {
      if (ids.has(value)) matches += 1;
    });
    return matches / uniqueValues.size;
  }

  private resolveActiveMapFromDrillPath(defaultSvgText: string, dv?: DataView): ActiveMapResolution {
    const manifest = parseMapRegistryManifest(this.settings.mapRegistry.manifestJson);
    const categoryColumns = this.getCategoryColumns(dv);
    const currentPath = categoryColumns
      .map((column) => this.getCategoryColumnName(column))
      .filter((name): name is string => !!name)
      .map((name) => name.trim())
      .filter((name) => !!name);
    const currentValuePath = this.getCurrentDrillValuePath(categoryColumns);
    this.currentDrillPath = currentPath;
    const currentLevel = Math.max(0, categoryColumns.length - 1);
    const navDirection = this.getDrillNavigationDirection(currentLevel, currentPath);
    const currentCategory = categoryColumns[currentLevel] || categoryColumns[categoryColumns.length - 1] || null;
    this.activeCategoryQueryName = this.getCategoryColumnName(currentCategory);
    const categoryMatchScores: DrillMapContext["categoryMatchScores"] = {};
    let pendingDrillSource = this.pendingDrillSource;
    if (pendingDrillSource) {
      const sourcePath = pendingDrillSource.sourcePath || [];
      const sourceStillPrefix = sourcePath.every((part, index) => norm(part) === norm(currentPath[index]));
      const awaitingNativeDrill =
        currentLevel === pendingDrillSource.sourceLevel && navDirection === "same" && sourceStillPrefix;
      const advancedExactlyOneLevel = currentLevel === pendingDrillSource.sourceLevel + 1 && sourceStillPrefix;
      if (!awaitingNativeDrill && !advancedExactlyOneLevel) {
        pendingDrillSource = null;
        this.clearPotentialDrillClickState(true);
      }
    }

    if (this.settings.drillMaps.enabled && categoryColumns.length > 0) {
      manifest.maps.forEach((candidate) => {
        const svgText = (candidate.svgText || "").trim();
        if (!svgText) return;
        categoryColumns.forEach((column, categoryIndex) => {
          const rawScore = this.getCategoryMapMatchScore(svgText, column);
          const levelBonus = Number.isFinite(candidate.level) && candidate.level === categoryIndex ? 1 : 0;
          const currentLevelBonus = categoryIndex === currentLevel ? 2 : 0;
          const score = rawScore + levelBonus + currentLevelBonus;
          const existing = categoryMatchScores[candidate.mapId];
          if (!existing || score > existing.score) {
            categoryMatchScores[candidate.mapId] = {
              score,
              categoryName: this.getCategoryColumnName(column)
            };
          }
        });
      });
    }

    const normalizedValuePath = currentValuePath.map((part) => norm(part)).filter(Boolean);
    const hasExplicitValuePathMap = manifest.maps.some((map) => {
      const mapPath = Array.isArray(map.drillPath) ? map.drillPath.map((part) => norm(part)).filter(Boolean) : [];
      return (
        mapPath.length > 0 &&
        mapPath.length === normalizedValuePath.length &&
        mapPath.every((part, index) => part === normalizedValuePath[index])
      );
    });
    const requireExplicitDrillPath =
      this.settings.drillMaps.enabled &&
      currentLevel > 0 &&
      normalizedValuePath.length === currentLevel &&
      !pendingDrillSource &&
      !hasExplicitValuePathMap;

    const resolution = resolveDrillMap(
      manifest,
      {
        currentDrillPath: currentPath,
        currentDrillValuePath: currentValuePath,
        currentLevel,
        categoryFieldNames: currentPath,
        activeCategoryQueryName: this.activeCategoryQueryName,
        pendingDrillSource,
        categoryMatchScores,
        requireExplicitDrillPath
      },
      {
        enabled: this.settings.drillMaps.enabled,
        fallbackToDefaultMap: this.settings.drillMaps.fallbackToDefaultMap
      }
    );
    this.lastDrillResolutionTrace = resolution;

    const selectedTrace = resolution.mapId
      ? resolution.candidates.find((candidate) => candidate.mapId === resolution.mapId)
      : null;
    if (selectedTrace?.autoMatchCategoryName && resolution.reason === "automatch") {
      this.activeCategoryQueryName = selectedTrace.autoMatchCategoryName;
    }

    if (pendingDrillSource && currentLevel === pendingDrillSource.sourceLevel + 1) {
      this.clearPotentialDrillClickState(true);
    }
    this.lastDataDrillLevel = currentLevel;
    this.lastDataDrillPath = [...currentPath];

    const map = (resolution.map as MapRegistryMap | null) || null;
    const svgText = (map?.svgText || defaultSvgText || "").trim();
    return {
      manifest,
      map,
      svgText,
      mapId: map?.mapId || "default"
    };
  }

  private findAreaDefinitionForRuntime(areaId: string): ResolvedMapAreaDefinition | null {
    const areas = this.activeMap.map?.areas;
    if (!areas) return null;

    const raw = String(areaId || "").trim();
    if (!raw) return null;
    const normalized = norm(raw);
    const lower = raw.toLowerCase();

    const directCandidates = [raw, normalized, lower];
    for (const key of directCandidates) {
      const area = areas[key];
      if (area) return { key, area };
    }

    for (const [key, area] of Object.entries(areas)) {
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

      if (candidates.includes(normalized)) {
        return { key, area };
      }
    }

    return null;
  }

  private getAreaManifestOverride(areaId: string): MapRegistryArea | undefined {
    return this.findAreaDefinitionForRuntime(areaId)?.area;
  }

  private getAreaManifestKeyForRuntime(areaId: string): string {
    return this.findAreaDefinitionForRuntime(areaId)?.key || areaId;
  }

  private isAreaHidden(areaId: string): boolean {
    return !!this.getAreaManifestOverride(areaId)?.hidden;
  }

  private getLabelOverride(areaId: string): LabelOverride | undefined {
    const maps = this.labelOverridesManifest.maps || {};
    const byMap = maps[this.activeMap.mapId] || maps.default || {};
    return byMap[areaId] || byMap[norm(areaId)] || byMap[areaId.toLowerCase()];
  }

  private getBoundRowForElementId(areaId: string): CatRow | undefined {
    const direct = this.dataMap.get(norm(areaId));
    if (direct) return direct;
    const resolved = this.findAreaDefinitionForRuntime(areaId);
    const override = resolved?.area;
    const candidates = [
      resolved?.key,
      override?.bindKey,
      override?.id,
      override?.virtualId,
      override?.displayName,
      ...(Array.isArray(override?.aliases) ? override.aliases : [])
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => norm(value));
    for (const key of candidates) {
      const row = this.dataMap.get(key);
      if (row) return row;
    }
    return undefined;
  }

  private warnDrillRouteDiagnostic(message: string, data?: Record<string, unknown>): void {
    const key = `${message}:${JSON.stringify(data || {})}`;
    if (this.drillRouteDiagnosticKeys.has(key)) return;
    this.drillRouteDiagnosticKeys.add(key);
    try {
      console.warn(`[Sigfarm Drill] ${message}`, data || {});
    } catch {
      // ignore diagnostic failures
    }
  }

  private persistMapRegistryManifest(manifestJson: string): void {
    const persist = (this.host as any)?.persistProperties;
    if (typeof persist !== "function") return;
    persist({
      merge: [
        {
          objectName: "mapRegistry",
          selector: null,
          properties: { manifestJson }
        }
      ]
    });
  }

  private persistLabelOverridesManifest(overridesJson: string): void {
    const persist = (this.host as any)?.persistProperties;
    if (typeof persist !== "function") return;
    persist({
      merge: [
        {
          objectName: "labelOverrides",
          selector: null,
          properties: { overridesJson }
        }
      ]
    });
  }

  private setEditorStatus(message: string, isError: boolean = false): void {
    this.editorStatusMessage = message;
    this.editorStatusIsError = isError;
  }

  private applyEditorDraftState(
    manifest: MapRegistryManifest,
    labelOverrides: LabelOverridesManifest,
    selectedMapId?: string | null,
    selectedAreaId?: string | null,
    viewMode?: EditorViewMode
  ): void {
    this.editorDraftManifestJson = stringifyManifest(manifest);
    this.editorDraftLabelOverridesJson = stringifyManifest(labelOverrides);
    if (selectedMapId !== undefined) this.editorSelectedMapId = selectedMapId;
    if (selectedAreaId !== undefined) this.editorSelectedAreaId = selectedAreaId;
    if (viewMode) this.editorViewMode = viewMode;
  }

  private applyEditorBrowserInputs(shell: HTMLElement, manifest: MapRegistryManifest, activeMapId: string): void {
    const activeMap = manifest.maps.find((map) => map.mapId === activeMapId);
    if (!activeMap) return;
    const nameInput = shell.querySelector<HTMLInputElement>("[data-editor-browser-map-name='1']");
    const levelInput = shell.querySelector<HTMLInputElement>("[data-editor-browser-map-level='1']");
    const drillInput = shell.querySelector<HTMLInputElement>("[data-editor-browser-map-drill='1']");
    const defaultInput = shell.querySelector<HTMLInputElement>("[data-editor-browser-default='1']");
    activeMap.name = nameInput?.value?.trim() || activeMap.name || activeMap.mapId;
    const levelRaw = levelInput?.value?.trim?.() || "";
    activeMap.level = levelRaw === "" ? undefined : Number(levelRaw);
    activeMap.drillPath = (drillInput?.value || "")
      .split(">")
      .map((value) => value.trim())
      .filter((value) => !!value);
    if (defaultInput?.checked) manifest.defaultMapId = activeMap.mapId;
  }

  private applyEditorAreaInputs(
    shell: HTMLElement,
    manifest: MapRegistryManifest,
    labelOverrides: LabelOverridesManifest,
    activeMapId: string,
    selectedAreaId: string | null
  ): void {
    if (!selectedAreaId) return;
    const activeMap = manifest.maps.find((map) => map.mapId === activeMapId);
    if (!activeMap) return;
    activeMap.areas = activeMap.areas || {};
    activeMap.areas[selectedAreaId] = activeMap.areas[selectedAreaId] || {};
    const area = activeMap.areas[selectedAreaId];
    area.bindKey = shell.querySelector<HTMLInputElement>("[data-editor-area-bind='1']")?.value?.trim() || undefined;
    area.displayName = shell.querySelector<HTMLInputElement>("[data-editor-area-title='1']")?.value?.trim() || undefined;
    area.virtualId = shell.querySelector<HTMLInputElement>("[data-editor-area-virtual='1']")?.value?.trim() || undefined;
    const aliasesRaw = shell.querySelector<HTMLTextAreaElement>("[data-editor-area-aliases='1']")?.value || "";
    const aliases = aliasesRaw
      .split(/[\n,;]+/)
      .map((value) => value.trim())
      .filter((value) => !!value);
    area.aliases = aliases.length > 0 ? aliases : undefined;
    area.hidden = !!shell.querySelector<HTMLInputElement>("[data-editor-area-hidden='1']")?.checked;
    const metadataRaw = shell.querySelector<HTMLTextAreaElement>("[data-editor-area-metadata='1']")?.value?.trim() || "";
    area.metadata = metadataRaw ? safeParseJsonObject<Record<string, unknown>>(metadataRaw, {}) : undefined;
    const drillToMapId = shell.querySelector<HTMLSelectElement>("[data-editor-area-drill-map='1']")?.value || "";
    area.drillToMapId = drillToMapId || undefined;

    labelOverrides.maps = labelOverrides.maps || {};
    labelOverrides.maps[activeMapId] = labelOverrides.maps[activeMapId] || {};
    labelOverrides.maps[activeMapId][selectedAreaId] = labelOverrides.maps[activeMapId][selectedAreaId] || {};
    const override = labelOverrides.maps[activeMapId][selectedAreaId];
    override.mode = shell.querySelector<HTMLSelectElement>("[data-editor-label-mode='1']")?.value || undefined;
    override.calloutSide =
      (shell.querySelector<HTMLSelectElement>("[data-editor-label-side='1']")?.value || undefined) as LabelOverride["calloutSide"];
    override.calloutOffsetX = this.parseOptionalNumber(
      shell.querySelector<HTMLInputElement>("[data-editor-label-offset-x='1']")?.value?.trim?.() || ""
    );
    override.calloutOffsetY = this.parseOptionalNumber(
      shell.querySelector<HTMLInputElement>("[data-editor-label-offset-y='1']")?.value?.trim?.() || ""
    );
    override.textAlign =
      (shell.querySelector<HTMLSelectElement>("[data-editor-label-align='1']")?.value || undefined) as LabelOverride["textAlign"];
    override.hidden = !!shell.querySelector<HTMLInputElement>("[data-editor-label-hidden='1']")?.checked;
  }

  private applyEditorShellInputs(
    shell: HTMLElement,
    manifest: MapRegistryManifest,
    labelOverrides: LabelOverridesManifest,
    activeMapId: string,
    selectedAreaId: string | null
  ): void {
    this.applyEditorBrowserInputs(shell, manifest, activeMapId);
    this.applyEditorAreaInputs(shell, manifest, labelOverrides, activeMapId, selectedAreaId);
  }

  private seedDraftFromUploadedSvg(svgText: string, fileName: string, appendNewMap: boolean): void {
    const state = this.getEditorWorkingState();
    const fileBase = fileName.replace(/\.[^/.]+$/, "").trim() || "mapa";
    const normalizedBase = norm(fileBase) || "mapa";
    let targetMap = state.activeMap;

    if (appendNewMap || !state.manifest.maps.length) {
      let suffix = 1;
      let nextId = normalizedBase;
      const usedIds = new Set(state.manifest.maps.map((map) => norm(map.mapId)));
      while (usedIds.has(norm(nextId))) {
        suffix += 1;
        nextId = `${normalizedBase}_${suffix}`;
      }
      targetMap = {
        mapId: nextId,
        name: fileBase,
        svgText,
        level: state.manifest.maps.length,
        drillPath: [],
        areas: {}
      };
      state.manifest.maps.push(targetMap);
      state.manifest.defaultMapId = state.manifest.defaultMapId || targetMap.mapId;
    } else {
      targetMap.svgText = svgText;
      if (!targetMap.name) targetMap.name = fileBase;
    }

    this.applyEditorDraftState(state.manifest, state.labelOverrides, targetMap.mapId, null, "browser");
    this.setEditorStatus(`SVG preparado no editor: ${fileBase}. Revise e salve quando concluir.`, false);
    this.editorOpen = true;
  }

  private createSanitizedEditorPreview(
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

    const raw = (svgTextRaw || "").trim();
    if (!raw) {
      const empty = document.createElement("div");
      empty.className = "sp-editor-preview-empty";
      empty.textContent = "Nenhum SVG configurado para este mapa.";
      frame.appendChild(empty);
      return frame;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(decodeSvgDataUri(raw), "image/svg+xml");
    const { svg } = sanitizeSvgDocument(doc);
    if (!svg) {
      const empty = document.createElement("div");
      empty.className = "sp-editor-preview-empty";
      empty.textContent = "Nao foi possivel gerar o preview sanitizado deste SVG.";
      frame.appendChild(empty);
      return frame;
    }

    const cloned = svg.cloneNode(true) as SVGSVGElement;
    cloned.removeAttribute("width");
    cloned.removeAttribute("height");
    cloned.setAttribute("preserveAspectRatio", "xMidYMid meet");
    cloned.style.width = "100%";
    cloned.style.height = "100%";
    cloned.style.display = "block";
    cloned.style.background = "#f6faf9";

    const selectedKey = options.selectedAreaId ? norm(options.selectedAreaId) : null;
    const regions = Array.from(
      cloned.querySelectorAll<SVGElement>("path[id], polygon[id], rect[id], circle[id], ellipse[id], g[id]")
    );
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

    frame.appendChild(cloned);
    const fitPreview = () => {
      const bbox = getCombinedRegionBBox(regions);
      if (!(bbox.width > 0) || !(bbox.height > 0)) return;
      const pad = Math.max(8, Math.min(bbox.width, bbox.height) * 0.04);
      cloned.setAttribute("viewBox", `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
    };
    requestAnimationFrame(() => requestAnimationFrame(fitPreview));
    return frame;
  }

  private renderAdvancedEditor(options?: VisualUpdateOptions, dv?: DataView): void {
    if (!this.editorHost) return;
    const canExpose = this.canExposeEditorUi(options);
    if (!canExpose) this.editorOpen = false;
    const showEditor =
      canExpose && !this.canUseModalEditor(options) && (this.isAdvancedEditMode(options) || this.editorOpen);
    this.editorHost.style.display = showEditor ? "block" : "none";
    this.editorHost.setAttribute("aria-hidden", showEditor ? "false" : "true");
    if (!showEditor) {
      this.editorHost.textContent = "";
      return;
    }

    this.editorHost.textContent = "";
    const shell = document.createElement("div");
    shell.className = "sp-editor-shell";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "sp-editor-close";
    closeBtn.textContent = "Fechar";
    closeBtn.addEventListener("click", () => this.setEditorOpen(false));
    shell.appendChild(closeBtn);

    const workingState = this.getEditorWorkingState();
    if (!workingState.manifest.maps.find((map) => map.mapId === workingState.activeMap.mapId)) {
      this.editorSelectedMapId = workingState.activeMap.mapId;
    }
    if (
      this.editorSelectedAreaId &&
      !this.buildEditorAreaRows(workingState.activeMap, workingState.labelOverrides).some((row) => row.areaId === this.editorSelectedAreaId)
    ) {
      this.editorSelectedAreaId = null;
    }

    const captureState = () => {
      const current = this.getEditorWorkingState();
      this.applyEditorShellInputs(shell, current.manifest, current.labelOverrides, current.activeMap.mapId, this.editorSelectedAreaId);
      return current;
    };

    const rerender = () => this.renderAdvancedEditor(options, dv);
    const persistAndValidate = (closeEditor: boolean, returnToBrowser: boolean) => {
      const current = captureState();
      const validationErrors = this.validateMapRegistryManifest(current.manifest);
      if (validationErrors.length > 0) {
        this.setEditorStatus(validationErrors.join(" | "), true);
        rerender();
        return;
      }
      this.applyEditorDraftState(
        current.manifest,
        current.labelOverrides,
        current.activeMap.mapId,
        this.editorSelectedAreaId,
        returnToBrowser ? "browser" : this.editorViewMode
      );
      this.persistMapRegistryManifest(this.editorDraftManifestJson || stringifyManifest(current.manifest));
      this.persistLabelOverridesManifest(this.editorDraftLabelOverridesJson || stringifyManifest(current.labelOverrides));
      this.setEditorStatus(`Editor salvo. Mapa ativo: ${current.activeMap.mapId}.`, false);
      if (closeEditor) {
        this.setEditorOpen(false);
        return;
      }
      if (returnToBrowser) this.editorSelectedAreaId = null;
      rerender();
    };

    const importJson = () => {
      const importInput = document.createElement("input");
      importInput.type = "file";
      importInput.accept = ".json,application/json";
      importInput.style.display = "none";
      shell.appendChild(importInput);
      importInput.addEventListener("change", async () => {
        const file = importInput.files?.[0];
        if (!file) return;
        const raw = await file.text();
        const combined = safeParseJsonObject<any>(raw, {});
        const importedManifest = combined.maps ? parseMapRegistryManifest(raw) : parseMapRegistryManifest(JSON.stringify(combined.manifest || {}));
        const importedLabelOverrides = combined.labelOverrides
          ? parseLabelOverridesManifest(JSON.stringify(combined.labelOverrides))
          : parseLabelOverridesManifest(this.editorDraftLabelOverridesJson || this.settings.labelOverrides.overridesJson);
        this.applyEditorDraftState(
          importedManifest,
          importedLabelOverrides,
          importedManifest.defaultMapId || importedManifest.maps[0]?.mapId || null,
          null,
          "browser"
        );
        this.setEditorStatus("JSON importado no editor. Revise e salve quando concluir.", false);
        importInput.remove();
        rerender();
      });
      importInput.click();
    };

    const exportJson = () => {
      const current = captureState();
      const payload = stringifyManifest({
        manifest: current.manifest,
        labelOverrides: current.labelOverrides
      });
      navigator.clipboard?.writeText(payload).catch(() => {
        return;
      });
      this.applyEditorDraftState(current.manifest, current.labelOverrides, current.activeMap.mapId, this.editorSelectedAreaId, this.editorViewMode);
      this.setEditorStatus("Manifesto combinado copiado para a area de transferencia.", false);
      rerender();
    };

    const body =
      this.editorViewMode === "detail"
        ? this.buildEditorMapDetailView(shell, workingState, {
            captureState,
            rerender,
            persistAndValidate,
            exportJson
          })
        : this.buildEditorMapBrowser(shell, workingState, {
            captureState,
            rerender,
            persistAndValidate,
            importJson,
            exportJson
          });
    shell.appendChild(body);

    if (this.editorStatusIsError && this.editorStatusMessage) {
      const status = document.createElement("div");
      status.className = "sp-editor-status is-error";
      status.textContent = this.editorStatusMessage;
      shell.appendChild(status);
    }

    this.editorHost.appendChild(shell);
  }

  private buildEditorMapBrowser(
    shell: HTMLElement,
    workingState: { manifest: MapRegistryManifest; labelOverrides: LabelOverridesManifest; activeMap: MapRegistryMap },
    actions: {
      captureState: () => { manifest: MapRegistryManifest; labelOverrides: LabelOverridesManifest; activeMap: MapRegistryMap };
      rerender: () => void;
      persistAndValidate: (closeEditor: boolean, returnToBrowser: boolean) => void;
      importJson: () => void;
      exportJson: () => void;
    }
  ): HTMLElement {
    const layout = document.createElement("div");
    layout.className = "sp-editor-browser";

    const sidebar = document.createElement("div");
    sidebar.className = "sp-editor-browser-sidebar";

    const sidebarHeader = document.createElement("div");
    sidebarHeader.className = "sp-editor-browser-header";
    const sidebarTitle = document.createElement("h3");
    sidebarTitle.textContent = "Mapas";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "Adicionar mapa";
    sidebarHeader.append(sidebarTitle, addBtn);
    sidebar.appendChild(sidebarHeader);

    const list = document.createElement("div");
    list.className = "sp-editor-map-list";
    for (const map of workingState.manifest.maps) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "sp-editor-map-item";
      if (map.mapId === workingState.activeMap.mapId) item.classList.add("is-active");
      item.setAttribute("data-editor-map-row", map.mapId);

      const name = document.createElement("div");
      name.className = "sp-editor-map-item-title";
      name.textContent = map.name || map.mapId;

      const meta = document.createElement("div");
      meta.className = "sp-editor-map-item-meta";
      meta.textContent = `${map.mapId}${workingState.manifest.defaultMapId === map.mapId ? " • padrao" : ""}`;

      item.append(name, meta);
      item.addEventListener("click", () => {
        const current = actions.captureState();
        this.applyEditorDraftState(current.manifest, current.labelOverrides, map.mapId, null, "browser");
        this.editorAreaSearch = "";
        actions.rerender();
      });
      list.appendChild(item);
    }
    sidebar.appendChild(list);

    const sidebarActions = document.createElement("div");
    sidebarActions.className = "sp-editor-browser-sidebar-actions";
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remover mapa";
    removeBtn.addEventListener("click", () => {
      const current = actions.captureState();
      const removedMapId = workingState.activeMap.mapId;
      if (current.manifest.maps.length <= 1) {
        this.setEditorStatus("O editor precisa manter ao menos um mapa configurado.", true);
        actions.rerender();
        return;
      }
      current.manifest.maps = current.manifest.maps.filter((map) => map.mapId !== removedMapId);
      delete current.labelOverrides.maps?.[removedMapId];
      current.manifest.maps.forEach((map) => {
        Object.values(map.areas || {}).forEach((area) => {
          if (area.drillToMapId === removedMapId) {
            delete area.drillToMapId;
          }
        });
      });
      const nextMapId = current.manifest.defaultMapId && current.manifest.defaultMapId !== removedMapId
        ? current.manifest.defaultMapId
        : current.manifest.maps[0]?.mapId || null;
      if (current.manifest.defaultMapId === removedMapId) {
        current.manifest.defaultMapId = current.manifest.maps[0]?.mapId;
      }
      this.applyEditorDraftState(current.manifest, current.labelOverrides, nextMapId, null, "browser");
      this.setEditorStatus("Mapa removido do manifesto em edicao.", false);
      actions.rerender();
    });
    sidebarActions.appendChild(removeBtn);
    sidebar.appendChild(sidebarActions);

    const addInput = document.createElement("input");
    addInput.type = "file";
    addInput.accept = ".svg,image/svg+xml";
    addInput.style.display = "none";
    addInput.addEventListener("change", async () => {
      const file = addInput.files?.[0];
      if (!file) return;
      const current = actions.captureState();
      this.applyEditorDraftState(current.manifest, current.labelOverrides, current.activeMap.mapId, this.editorSelectedAreaId, this.editorViewMode);
      const text = await file.text();
      const dataUri = "data:image/svg+xml;utf8," + encodeURIComponent(text);
      this.seedDraftFromUploadedSvg(dataUri, file.name, true);
      addInput.value = "";
      actions.rerender();
    });
    addBtn.addEventListener("click", () => addInput.click());
    sidebar.appendChild(addInput);
    layout.appendChild(sidebar);

    const detail = document.createElement("div");
    detail.className = "sp-editor-browser-detail";

    const detailHeader = document.createElement("div");
    detailHeader.className = "sp-editor-browser-detail-header";
    const detailTitleWrap = document.createElement("div");
    const detailTitle = document.createElement("h3");
    detailTitle.textContent = workingState.activeMap.name || workingState.activeMap.mapId;
    const detailSub = document.createElement("div");
    detailSub.className = "sp-editor-browser-detail-subtitle";
    detailSub.textContent = workingState.activeMap.mapId;
    detailTitleWrap.append(detailTitle, detailSub);
    const detailButtons = document.createElement("div");
    detailButtons.className = "sp-editor-actions";
    const replaceBtn = document.createElement("button");
    replaceBtn.type = "button";
    replaceBtn.textContent = "Trocar SVG";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Editar";
    detailButtons.append(replaceBtn, editBtn);
    detailHeader.append(detailTitleWrap, detailButtons);
    detail.appendChild(detailHeader);

    const replaceInput = document.createElement("input");
    replaceInput.type = "file";
    replaceInput.accept = ".svg,image/svg+xml";
    replaceInput.style.display = "none";
    replaceInput.addEventListener("change", async () => {
      const file = replaceInput.files?.[0];
      if (!file) return;
      const current = actions.captureState();
      this.applyEditorDraftState(current.manifest, current.labelOverrides, current.activeMap.mapId, this.editorSelectedAreaId, this.editorViewMode);
      const text = await file.text();
      const dataUri = "data:image/svg+xml;utf8," + encodeURIComponent(text);
      this.seedDraftFromUploadedSvg(dataUri, file.name, false);
      replaceInput.value = "";
      actions.rerender();
    });
    replaceBtn.addEventListener("click", () => replaceInput.click());
    detail.appendChild(replaceInput);

    const preview = this.createSanitizedEditorPreview(workingState.activeMap.svgText, {
      activeMap: workingState.activeMap,
      compact: true
    });
    detail.appendChild(preview);

    const mapForm = document.createElement("div");
    mapForm.className = "sp-editor-form-grid";
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Nome do mapa";
    const nameInput = document.createElement("input");
    nameInput.className = "sp-editor-input";
    nameInput.value = workingState.activeMap.name || workingState.activeMap.mapId;
    nameInput.setAttribute("data-editor-browser-map-name", "1");
    nameLabel.appendChild(nameInput);
    const levelLabel = document.createElement("label");
    levelLabel.textContent = "Nivel do drill";
    const levelInput = document.createElement("input");
    levelInput.className = "sp-editor-input";
    levelInput.type = "number";
    levelInput.value = workingState.activeMap.level === undefined ? "" : String(workingState.activeMap.level);
    levelInput.setAttribute("data-editor-browser-map-level", "1");
    levelLabel.appendChild(levelInput);
    const defaultLabel = document.createElement("label");
    defaultLabel.className = "sp-editor-checkbox";
    const defaultInput = document.createElement("input");
    defaultInput.type = "checkbox";
    defaultInput.checked = workingState.manifest.defaultMapId === workingState.activeMap.mapId;
    defaultInput.setAttribute("data-editor-browser-default", "1");
    defaultLabel.append(defaultInput, document.createTextNode("Usar como mapa padrao"));
    const drillLabel = document.createElement("label");
    drillLabel.textContent = "Drill path";
    const drillInput = document.createElement("input");
    drillInput.className = "sp-editor-input";
    drillInput.value = (workingState.activeMap.drillPath || []).join(" > ");
    drillInput.placeholder = "ex.: pais > estado > municipio";
    drillInput.setAttribute("data-editor-browser-map-drill", "1");
    drillLabel.appendChild(drillInput);
    mapForm.append(nameLabel, levelLabel, defaultLabel, drillLabel);
    detail.appendChild(mapForm);

    const footer = document.createElement("div");
    footer.className = "sp-editor-actions sp-editor-footer";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Salvar";
    saveBtn.addEventListener("click", () => actions.persistAndValidate(false, false));
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.textContent = "Importar JSON";
    importBtn.addEventListener("click", actions.importJson);
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.textContent = "Exportar JSON";
    exportBtn.addEventListener("click", actions.exportJson);
    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.textContent = "Salvar e fechar";
    doneBtn.addEventListener("click", () => actions.persistAndValidate(true, false));
    editBtn.addEventListener("click", () => {
      const current = actions.captureState();
      this.applyEditorDraftState(current.manifest, current.labelOverrides, current.activeMap.mapId, null, "detail");
      this.editorAreaSearch = "";
      actions.rerender();
    });
    footer.append(saveBtn, importBtn, exportBtn, doneBtn);
    detail.appendChild(footer);
    layout.appendChild(detail);

    return layout;
  }

  private buildEditorMapDetailView(
    shell: HTMLElement,
    workingState: { manifest: MapRegistryManifest; labelOverrides: LabelOverridesManifest; activeMap: MapRegistryMap },
    actions: {
      captureState: () => { manifest: MapRegistryManifest; labelOverrides: LabelOverridesManifest; activeMap: MapRegistryMap };
      rerender: () => void;
      persistAndValidate: (closeEditor: boolean, returnToBrowser: boolean) => void;
      exportJson: () => void;
    }
  ): HTMLElement {
    const layout = document.createElement("div");
    layout.className = "sp-editor-detail";
    const rows = this.buildEditorAreaRows(workingState.activeMap, workingState.labelOverrides);
    const filteredRows = rows.filter((row) => {
      const search = this.editorAreaSearch.trim().toLowerCase();
      if (!search) return true;
      const haystack = [
        row.areaId,
        row.row?.rawKey || "",
        row.mapArea.displayName || "",
        ...(row.mapArea.aliases || [])
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
    const selectedArea =
      filteredRows.find((row) => row.areaId === this.editorSelectedAreaId) ||
      rows.find((row) => row.areaId === this.editorSelectedAreaId) ||
      null;

    const header = document.createElement("div");
    header.className = "sp-editor-detail-header";
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.textContent = "Mapas";
    backBtn.addEventListener("click", () => {
      const current = actions.captureState();
      this.applyEditorDraftState(current.manifest, current.labelOverrides, current.activeMap.mapId, null, "browser");
      actions.rerender();
    });
    const title = document.createElement("h3");
    title.textContent = workingState.activeMap.name || workingState.activeMap.mapId;
    const headerActions = document.createElement("div");
    headerActions.className = "sp-editor-actions";
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.textContent = "Exportar JSON";
    exportBtn.addEventListener("click", actions.exportJson);
    headerActions.appendChild(exportBtn);
    header.append(backBtn, title, headerActions);
    layout.appendChild(header);

    const main = document.createElement("div");
    main.className = "sp-editor-detail-main";

    const previewPane = document.createElement("div");
    previewPane.className = "sp-editor-detail-preview";
    previewPane.appendChild(
      this.createSanitizedEditorPreview(workingState.activeMap.svgText, {
        activeMap: workingState.activeMap,
        selectedAreaId: selectedArea?.areaId || null,
        interactive: true,
        onSelectArea: (areaId) => {
          const current = actions.captureState();
          this.applyEditorDraftState(current.manifest, current.labelOverrides, current.activeMap.mapId, areaId, "detail");
          actions.rerender();
        }
      })
    );
    main.appendChild(previewPane);

    const sidebar = document.createElement("div");
    sidebar.className = "sp-editor-detail-sidebar";

    const searchInput = document.createElement("input");
    searchInput.className = "sp-editor-input";
    searchInput.placeholder = "Buscar area...";
    searchInput.value = this.editorAreaSearch;
    searchInput.addEventListener("input", () => {
      const current = actions.captureState();
      this.applyEditorDraftState(current.manifest, current.labelOverrides, current.activeMap.mapId, this.editorSelectedAreaId, "detail");
      this.editorAreaSearch = searchInput.value;
      actions.rerender();
    });
    sidebar.appendChild(searchInput);

    const list = document.createElement("div");
    list.className = "sp-editor-area-list";
    for (const row of filteredRows) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "sp-editor-area-item";
      if (row.areaId === selectedArea?.areaId) item.classList.add("is-active");
      const titleEl = document.createElement("div");
      titleEl.textContent = row.areaId;
      const metaEl = document.createElement("div");
      metaEl.className = "sp-editor-area-item-meta";
      metaEl.textContent = row.mapArea.displayName || row.row?.rawKey || "sem correspondencia";
      item.append(titleEl, metaEl);
      item.addEventListener("click", () => {
        const current = actions.captureState();
        this.applyEditorDraftState(current.manifest, current.labelOverrides, current.activeMap.mapId, row.areaId, "detail");
        actions.rerender();
      });
      list.appendChild(item);
    }
    sidebar.appendChild(list);

    const inspector = document.createElement("div");
    inspector.className = "sp-editor-inspector";
    if (!selectedArea) {
      const empty = document.createElement("div");
      empty.className = "sp-editor-preview-empty";
      empty.textContent = "Selecione uma area pelo mapa ou pela lista.";
      inspector.appendChild(empty);
    } else {
      const titleWrap = document.createElement("div");
      titleWrap.className = "sp-editor-inspector-title";
      const areaTitle = document.createElement("strong");
      areaTitle.textContent = selectedArea.areaId;
      const areaMeta = document.createElement("span");
      areaMeta.textContent = selectedArea.mapArea.displayName || selectedArea.row?.rawKey || "Area";
      titleWrap.append(areaTitle, areaMeta);
      inspector.appendChild(titleWrap);

      const tabs = document.createElement("div");
      tabs.className = "sp-editor-inspector-tabs";
      for (const tab of ["General", "Drill", "Metadados", "Labels"] as EditorInspectorTab[]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = tab;
        button.classList.toggle("is-active", this.editorInspectorTab === tab);
        button.addEventListener("click", () => {
          const current = actions.captureState();
          this.applyEditorDraftState(current.manifest, current.labelOverrides, current.activeMap.mapId, selectedArea.areaId, "detail");
          this.editorInspectorTab = tab;
          actions.rerender();
        });
        tabs.appendChild(button);
      }
      inspector.appendChild(tabs);

      const panel = document.createElement("div");
      panel.className = "sp-editor-inspector-panel";
      const mapOptions = workingState.manifest.maps.filter((map) => map.mapId !== workingState.activeMap.mapId);
      if (this.editorInspectorTab === "General") {
        const bindLabel = document.createElement("label");
        bindLabel.textContent = "Data point";
        const bindInput = document.createElement("input");
        bindInput.className = "sp-editor-input";
        bindInput.setAttribute("data-editor-area-bind", "1");
        bindInput.value = selectedArea.mapArea.bindKey || "";
        bindInput.placeholder = "(Auto Bind)";
        bindLabel.appendChild(bindInput);

        const titleLabel = document.createElement("label");
        titleLabel.textContent = "Titulo";
        const titleInput = document.createElement("input");
        titleInput.className = "sp-editor-input";
        titleInput.setAttribute("data-editor-area-title", "1");
        titleInput.value = selectedArea.mapArea.displayName || "";
        titleLabel.appendChild(titleInput);

        const virtualLabel = document.createElement("label");
        virtualLabel.textContent = "ID virtual";
        const virtualInput = document.createElement("input");
        virtualInput.className = "sp-editor-input";
        virtualInput.setAttribute("data-editor-area-virtual", "1");
        virtualInput.value = selectedArea.mapArea.virtualId || "";
        virtualLabel.appendChild(virtualInput);

        const aliasesLabel = document.createElement("label");
        aliasesLabel.textContent = "Aliases";
        const aliasesInput = document.createElement("textarea");
        aliasesInput.className = "sp-editor-inline-textarea";
        aliasesInput.setAttribute("data-editor-area-aliases", "1");
        aliasesInput.value = (selectedArea.mapArea.aliases || []).join(", ");
        aliasesLabel.appendChild(aliasesInput);

        const hiddenLabel = document.createElement("label");
        hiddenLabel.className = "sp-editor-checkbox";
        const hiddenInput = document.createElement("input");
        hiddenInput.type = "checkbox";
        hiddenInput.setAttribute("data-editor-area-hidden", "1");
        hiddenInput.checked = !!selectedArea.mapArea.hidden;
        hiddenLabel.append(hiddenInput, document.createTextNode("Ocultar area"));
        panel.append(bindLabel, titleLabel, virtualLabel, aliasesLabel, hiddenLabel);
      } else if (this.editorInspectorTab === "Drill") {
        const drillLabel = document.createElement("label");
        drillLabel.textContent = "Drill para mapa";
        const drillSelect = document.createElement("select");
        drillSelect.className = "sp-editor-select";
        drillSelect.setAttribute("data-editor-area-drill-map", "1");
        const autoOption = document.createElement("option");
        autoOption.value = "";
        autoOption.textContent = "(Sem override)";
        drillSelect.appendChild(autoOption);
        for (const map of mapOptions) {
          const option = document.createElement("option");
          option.value = map.mapId;
          option.textContent = map.name || map.mapId;
          option.selected = selectedArea.mapArea.drillToMapId === map.mapId;
          drillSelect.appendChild(option);
        }
        drillLabel.appendChild(drillSelect);
        panel.appendChild(drillLabel);
      } else if (this.editorInspectorTab === "Metadados") {
        const metadataLabel = document.createElement("label");
        metadataLabel.textContent = "Metadata JSON";
        const metadataArea = document.createElement("textarea");
        metadataArea.className = "sp-editor-inline-textarea";
        metadataArea.setAttribute("data-editor-area-metadata", "1");
        metadataArea.value = selectedArea.mapArea.metadata ? stringifyManifest(selectedArea.mapArea.metadata) : "";
        metadataLabel.appendChild(metadataArea);
        panel.appendChild(metadataLabel);
      } else {
        const modeLabel = document.createElement("label");
        modeLabel.textContent = "Modo do label";
        const modeSelect = document.createElement("select");
        modeSelect.className = "sp-editor-select";
        modeSelect.setAttribute("data-editor-label-mode", "1");
        for (const mode of ["", "Inside", "OutsideCallout"]) {
          const option = document.createElement("option");
          option.value = mode;
          option.textContent = mode || "Auto";
          option.selected = (selectedArea.labelOverride.mode || "") === mode;
          modeSelect.appendChild(option);
        }
        modeLabel.appendChild(modeSelect);

        const sideLabel = document.createElement("label");
        sideLabel.textContent = "Lado do callout";
        const sideSelect = document.createElement("select");
        sideSelect.className = "sp-editor-select";
        sideSelect.setAttribute("data-editor-label-side", "1");
        for (const side of ["", "right", "left", "top", "bottom"]) {
          const option = document.createElement("option");
          option.value = side;
          option.textContent = side || "Auto";
          option.selected = (selectedArea.labelOverride.calloutSide || "") === side;
          sideSelect.appendChild(option);
        }
        sideLabel.appendChild(sideSelect);

        const alignLabel = document.createElement("label");
        alignLabel.textContent = "Alinhamento horizontal";
        const alignSelect = document.createElement("select");
        alignSelect.className = "sp-editor-select";
        alignSelect.setAttribute("data-editor-label-align", "1");
        for (const align of ["", "Left", "Center", "Right"]) {
          const option = document.createElement("option");
          option.value = align;
          option.textContent = align === "" ? "Padrao do visual" : align === "Left" ? "Esquerda" : align === "Center" ? "Centro" : "Direita";
          option.selected = (selectedArea.labelOverride.textAlign || "") === align;
          alignSelect.appendChild(option);
        }
        alignLabel.appendChild(alignSelect);

        const offsetGrid = document.createElement("div");
        offsetGrid.className = "sp-editor-form-grid";
        const offsetXLabel = document.createElement("label");
        offsetXLabel.textContent = "Offset X";
        const offsetXInput = document.createElement("input");
        offsetXInput.className = "sp-editor-input";
        offsetXInput.setAttribute("data-editor-label-offset-x", "1");
        offsetXInput.value = selectedArea.labelOverride.calloutOffsetX === undefined ? "" : String(selectedArea.labelOverride.calloutOffsetX);
        offsetXLabel.appendChild(offsetXInput);
        const offsetYLabel = document.createElement("label");
        offsetYLabel.textContent = "Offset Y";
        const offsetYInput = document.createElement("input");
        offsetYInput.className = "sp-editor-input";
        offsetYInput.setAttribute("data-editor-label-offset-y", "1");
        offsetYInput.value = selectedArea.labelOverride.calloutOffsetY === undefined ? "" : String(selectedArea.labelOverride.calloutOffsetY);
        offsetYLabel.appendChild(offsetYInput);
        offsetGrid.append(offsetXLabel, offsetYLabel);

        const hiddenLabel = document.createElement("label");
        hiddenLabel.className = "sp-editor-checkbox";
        const hiddenInput = document.createElement("input");
        hiddenInput.type = "checkbox";
        hiddenInput.setAttribute("data-editor-label-hidden", "1");
        hiddenInput.checked = !!selectedArea.labelOverride.hidden;
        hiddenLabel.append(hiddenInput, document.createTextNode("Ocultar label/callout"));
        panel.append(modeLabel, sideLabel, alignLabel, offsetGrid, hiddenLabel);
      }
      inspector.appendChild(panel);
    }
    sidebar.appendChild(inspector);
    main.appendChild(sidebar);
    layout.appendChild(main);

    const footer = document.createElement("div");
    footer.className = "sp-editor-actions sp-editor-footer";
    const saveBackBtn = document.createElement("button");
    saveBackBtn.type = "button";
    saveBackBtn.textContent = "Salvar e voltar";
    saveBackBtn.addEventListener("click", () => actions.persistAndValidate(false, true));
    const saveCloseBtn = document.createElement("button");
    saveCloseBtn.type = "button";
    saveCloseBtn.textContent = "Salvar e fechar";
    saveCloseBtn.addEventListener("click", () => actions.persistAndValidate(true, false));
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "Fechar";
    closeBtn.addEventListener("click", () => this.setEditorOpen(false));
    footer.append(saveBackBtn, saveCloseBtn, closeBtn);
    layout.appendChild(footer);

    return layout;
  }

  private getMapRegistryValidationIssues(manifest: MapRegistryManifest): ValidationIssue[] {
    return validateMapRegistryManifestIssues(manifest);
  }

  private validateMapRegistryManifest(manifest: MapRegistryManifest): string[] {
    return this.getMapRegistryValidationIssues(manifest)
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.message);
  }

  private getEditorWorkingState(): {
    manifest: MapRegistryManifest;
    labelOverrides: LabelOverridesManifest;
    activeMap: MapRegistryMap;
  } {
    const manifest = cloneJsonObject(
      parseMapRegistryManifest(this.editorDraftManifestJson ?? this.settings.mapRegistry.manifestJson)
    );
    const labelOverrides = cloneJsonObject(
      parseLabelOverridesManifest(this.editorDraftLabelOverridesJson ?? this.settings.labelOverrides.overridesJson)
    );
    if (!manifest.maps || manifest.maps.length === 0) {
      manifest.maps = [
        {
          mapId: this.activeMap.mapId || "default",
          name: "Mapa principal",
          svgText: this.activeMap.svgText || this.settings.svgSettings.svgText,
          level: 0,
          drillPath: [],
          areas: {}
        }
      ];
    }
    const selectedMapId = this.editorSelectedMapId || this.activeMap.mapId || manifest.defaultMapId || manifest.maps[0].mapId;
    const activeMap =
      manifest.maps.find((map) => map.mapId === selectedMapId) ||
      manifest.maps.find((map) => map.mapId === manifest.defaultMapId) ||
      manifest.maps[0];
    activeMap.areas = activeMap.areas || {};
    manifest.defaultMapId = manifest.defaultMapId || activeMap.mapId;
    labelOverrides.maps = labelOverrides.maps || {};
    labelOverrides.maps[activeMap.mapId] = labelOverrides.maps[activeMap.mapId] || {};
    return { manifest, labelOverrides, activeMap };
  }

  private getEditorStatusText(activeMapId: string): string {
    const areaCount = this.zoomRoot
      ? this.zoomRoot.querySelectorAll("path[id], polygon[id], rect[id], circle[id], ellipse[id], g[id]").length
      : 0;
    return `Mapa ativo: ${activeMapId}. Areas SVG: ${areaCount}. Linhas de dados: ${this.dataMap.size}. Nivel atual: ${
      this.currentDrillPath.join(" > ") || "padrao"
    }.`;
  }

  private buildEditorAreaRows(activeMap: MapRegistryMap, labelOverrides: LabelOverridesManifest): EditorAreaRow[] {
    const regionEls = this.zoomRoot
      ? Array.from(this.zoomRoot.querySelectorAll<SVGElement>("path[id], polygon[id], rect[id], circle[id], ellipse[id], g[id]"))
      : [];
    const ids = new Set<string>();
    for (const el of regionEls) {
      const id = (el as any).id as string;
      if (id) ids.add(id);
    }
    for (const areaId of Object.keys(activeMap.areas || {})) ids.add(areaId);
    const mapLabelOverrides = labelOverrides.maps?.[activeMap.mapId] || {};
    return Array.from(ids)
      .sort((a, b) => a.localeCompare(b))
      .map((areaId) => ({
        areaId,
        row: this.getBoundRowForElementId(areaId) || null,
        mapArea: cloneJsonObject(activeMap.areas?.[areaId] || {}),
        labelOverride: cloneJsonObject(mapLabelOverrides[areaId] || {})
      }));
  }

  private buildEditorTabs(
    shell: HTMLElement,
    manifest: MapRegistryManifest,
    labelOverrides: LabelOverridesManifest,
    activeMap: MapRegistryMap,
    dv?: DataView
  ): HTMLElement {
    void dv;
    const rows = this.buildEditorAreaRows(activeMap, labelOverrides);
    const host = document.createElement("div");
    const nav = document.createElement("div");
    nav.className = "sp-editor-tabs";
    const content = document.createElement("div");
    content.className = "sp-editor-panels";
    const tabs: Array<{ key: EditorTabKey; panel: HTMLElement }> = [
      { key: "Mapas", panel: this.buildMapsTab(manifest, activeMap.mapId) },
      { key: "Areas", panel: this.buildAreasTab(rows) },
      { key: "Aliases", panel: this.buildAliasesTab(rows) },
      { key: "Metadados", panel: this.buildMetadataTab(rows) },
      { key: "Drill", panel: this.buildDrillTab(manifest) },
      { key: "Labels", panel: this.buildLabelsTab(rows) }
    ];
    if (this.settings.editor.showManifestEditor) {
      tabs.push({ key: "JSON", panel: this.buildJsonTab(manifest, labelOverrides) });
    }

    const showTab = (key: EditorTabKey) => {
      this.editorActiveTab = key;
      for (const item of tabs) {
        item.panel.style.display = item.key === key ? "block" : "none";
      }
      Array.from(nav.querySelectorAll<HTMLButtonElement>("button")).forEach((button) => {
        button.classList.toggle("is-active", button.getAttribute("data-tab") === key);
      });
    };

    for (const item of tabs) {
      item.panel.className = "sp-editor-panel";
      item.panel.style.display = "none";
      content.appendChild(item.panel);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.key;
      button.setAttribute("data-tab", item.key);
      button.addEventListener("click", () => showTab(item.key));
      nav.appendChild(button);
    }

    host.appendChild(nav);
    host.appendChild(content);
    showTab(tabs.some((item) => item.key === this.editorActiveTab) ? this.editorActiveTab : tabs[0].key);
    return host;
  }

  private buildMapsTab(manifest: MapRegistryManifest, activeMapId: string): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "sp-editor-table";
    panel.appendChild(this.buildPanelTitle("Mapas"));
    const defaultLabel = document.createElement("label");
    defaultLabel.textContent = "Mapa padrao";
    const defaultInput = document.createElement("input");
    defaultInput.value = manifest.defaultMapId || activeMapId;
    defaultInput.setAttribute("data-editor-default-map", "1");
    defaultLabel.appendChild(defaultInput);
    panel.appendChild(defaultLabel);

    const table = document.createElement("table");
    table.appendChild(this.createEditorHeader(["Ativo", "Map ID", "Nome", "SVG"]));
    const tbody = document.createElement("tbody");
    for (const map of manifest.maps) {
      const tr = document.createElement("tr");
      tr.setAttribute("data-map-row", map.mapId);
      const active = document.createElement("td");
      active.textContent = map.mapId === activeMapId ? "Sim" : "";
      const mapId = document.createElement("td");
      mapId.appendChild(this.createEditorInput("mapId", map.mapId));
      const name = document.createElement("td");
      name.appendChild(this.createEditorInput("name", map.name || ""));
      const svg = document.createElement("td");
      svg.textContent = map.svgText ? "Configurado" : "Vazio";
      tr.append(active, mapId, name, svg);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    panel.appendChild(table);
    return panel;
  }

  private buildAreasTab(rows: EditorAreaRow[]): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "sp-editor-table";
    panel.appendChild(this.buildPanelTitle("Areas"));
    const table = document.createElement("table");
    table.appendChild(this.createEditorHeader(["ID SVG", "Binding", "ID virtual", "Display name", "Dado", "Oculta"]));
    const tbody = document.createElement("tbody");
    for (const area of rows) {
      const tr = document.createElement("tr");
      tr.setAttribute("data-area-row", area.areaId);
      tr.append(
        this.createTextCell(area.areaId),
        this.createInputCell("bindKey", area.mapArea.bindKey || area.areaId),
        this.createInputCell("virtualId", area.mapArea.virtualId || ""),
        this.createInputCell("displayName", area.mapArea.displayName || ""),
        this.createTextCell(area.row?.rawKey || "sem correspondencia"),
        this.createCheckboxCell("hidden", !!area.mapArea.hidden)
      );
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    panel.appendChild(table);
    return panel;
  }

  private buildAliasesTab(rows: EditorAreaRow[]): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "sp-editor-table";
    panel.appendChild(this.buildPanelTitle("Aliases"));
    const table = document.createElement("table");
    table.appendChild(this.createEditorHeader(["ID SVG", "Aliases"]));
    const tbody = document.createElement("tbody");
    for (const area of rows) {
      const tr = document.createElement("tr");
      tr.setAttribute("data-alias-row", area.areaId);
      tr.append(
        this.createTextCell(area.areaId),
        this.createInputCell("aliases", (area.mapArea.aliases || []).join(", "))
      );
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    panel.appendChild(table);
    return panel;
  }

  private buildMetadataTab(rows: EditorAreaRow[]): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "sp-editor-table";
    panel.appendChild(this.buildPanelTitle("Metadados"));
    const table = document.createElement("table");
    table.appendChild(this.createEditorHeader(["ID SVG", "Metadata JSON"]));
    const tbody = document.createElement("tbody");
    for (const area of rows) {
      const tr = document.createElement("tr");
      tr.setAttribute("data-metadata-row", area.areaId);
      tr.append(this.createTextCell(area.areaId));
      const td = document.createElement("td");
      const textarea = document.createElement("textarea");
      textarea.className = "sp-editor-inline-textarea";
      textarea.setAttribute("data-field", "metadata");
      textarea.value = area.mapArea.metadata ? stringifyManifest(area.mapArea.metadata) : "";
      td.appendChild(textarea);
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    panel.appendChild(table);
    return panel;
  }

  private buildDrillTab(manifest: MapRegistryManifest): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "sp-editor-table";
    panel.appendChild(this.buildPanelTitle("Drill"));

    const resolution = this.lastDrillResolutionTrace;
    const summary = document.createElement("div");
    summary.className = "sp-editor-status";
    const currentPath = this.currentDrillPath.length > 0 ? this.currentDrillPath.join(" > ") : "(raiz)";
    summary.textContent = `Contexto atual: ${currentPath}. Mapa resolvido: ${resolution?.mapId || this.activeMap.mapId || "nenhum"} (${resolution?.reason || "none"}).`;
    panel.appendChild(summary);

    if (resolution?.warnings?.length) {
      const warnings = document.createElement("div");
      warnings.className = "sp-editor-status is-error";
      warnings.textContent = resolution.warnings.join(" | ");
      panel.appendChild(warnings);
    }

    const hint = document.createElement("p");
    hint.className = "sp-editor-area-item-meta";
    hint.textContent =
      "Fallback simplificado: edite nivel e drill path aqui. A associacao visual por area esta disponivel no modal quando o host permite dialogos.";
    panel.appendChild(hint);

    const table = document.createElement("table");
    table.appendChild(this.createEditorHeader(["Map ID", "Nivel", "Drill path"]));
    const tbody = document.createElement("tbody");
    for (const map of manifest.maps) {
      const tr = document.createElement("tr");
      tr.setAttribute("data-drill-row", map.mapId);
      tr.append(
        this.createTextCell(map.mapId),
        this.createInputCell("level", map.level === undefined ? "" : String(map.level)),
        this.createInputCell("drillPath", (map.drillPath || []).join(" > "))
      );
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    panel.appendChild(table);
    return panel;
  }

  private buildLabelsTab(rows: EditorAreaRow[]): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "sp-editor-table";
    panel.appendChild(this.buildPanelTitle("Labels"));
    const table = document.createElement("table");
    table.appendChild(this.createEditorHeader(["ID SVG", "Modo", "Lado", "Offset X", "Offset Y", "Oculta"]));
    const tbody = document.createElement("tbody");
    for (const area of rows) {
      const tr = document.createElement("tr");
      tr.setAttribute("data-label-row", area.areaId);
      tr.append(this.createTextCell(area.areaId));

      const modeTd = document.createElement("td");
      const modeSelect = document.createElement("select");
      modeSelect.setAttribute("data-field", "mode");
      for (const mode of ["", "Inside", "OutsideCallout"]) {
        const option = document.createElement("option");
        option.value = mode;
        option.textContent = mode || "Auto";
        option.selected = (area.labelOverride.mode || "") === mode;
        modeSelect.appendChild(option);
      }
      modeTd.appendChild(modeSelect);
      tr.appendChild(modeTd);

      const sideTd = document.createElement("td");
      const sideSelect = document.createElement("select");
      sideSelect.setAttribute("data-field", "calloutSide");
      for (const side of ["", "right", "left", "top", "bottom"]) {
        const option = document.createElement("option");
        option.value = side;
        option.textContent = side || "Auto";
        option.selected = (area.labelOverride.calloutSide || "") === side;
        sideSelect.appendChild(option);
      }
      sideTd.appendChild(sideSelect);
      tr.appendChild(sideTd);

      tr.append(
        this.createInputCell("calloutOffsetX", area.labelOverride.calloutOffsetX === undefined ? "" : String(area.labelOverride.calloutOffsetX)),
        this.createInputCell("calloutOffsetY", area.labelOverride.calloutOffsetY === undefined ? "" : String(area.labelOverride.calloutOffsetY)),
        this.createCheckboxCell("hidden", !!area.labelOverride.hidden)
      );
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    panel.appendChild(table);
    return panel;
  }

  private buildJsonTab(manifest: MapRegistryManifest, labelOverrides: LabelOverridesManifest): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "sp-editor-json";
    panel.appendChild(this.buildPanelTitle("JSON"));
    const manifestLabel = document.createElement("label");
    manifestLabel.textContent = "Manifesto";
    const manifestArea = document.createElement("textarea");
    manifestArea.className = "sp-editor-textarea";
    manifestArea.setAttribute("data-json-manifest", "1");
    manifestArea.value = stringifyManifest(manifest);
    manifestArea.readOnly = true;
    manifestLabel.appendChild(manifestArea);
    const overridesLabel = document.createElement("label");
    overridesLabel.textContent = "Label overrides";
    const overridesArea = document.createElement("textarea");
    overridesArea.className = "sp-editor-textarea";
    overridesArea.setAttribute("data-json-label-overrides", "1");
    overridesArea.value = stringifyManifest(labelOverrides);
    overridesArea.readOnly = true;
    overridesLabel.appendChild(overridesArea);
    panel.append(manifestLabel, overridesLabel);
    return panel;
  }

  private collectEditorState(
    shell: HTMLElement,
    baseManifest: MapRegistryManifest,
    baseLabelOverrides: LabelOverridesManifest,
    fallbackActiveMapId: string
  ): { manifest: MapRegistryManifest; labelOverrides: LabelOverridesManifest; activeMapId: string } {
    const manifestJsonArea = shell.querySelector<HTMLTextAreaElement>("[data-json-manifest='1']");
    const labelOverridesArea = shell.querySelector<HTMLTextAreaElement>("[data-json-label-overrides='1']");
    const manifest = manifestJsonArea ? parseMapRegistryManifest(manifestJsonArea.value) : cloneJsonObject(baseManifest);
    const labelOverrides = labelOverridesArea
      ? parseLabelOverridesManifest(labelOverridesArea.value)
      : cloneJsonObject(baseLabelOverrides);

    manifest.maps = [];
    shell.querySelectorAll<HTMLElement>("[data-map-row]").forEach((row) => {
      const originalId = row.getAttribute("data-map-row") || "";
      const existing = baseManifest.maps.find((map) => map.mapId === originalId);
      const mapId = this.readRowValue(row, "mapId") || originalId;
      if (!mapId) return;
      manifest.maps.push({
        mapId,
        name: this.readRowValue(row, "name") || mapId,
        svgText: existing?.svgText || (mapId === fallbackActiveMapId ? this.activeMap.svgText : this.settings.svgSettings.svgText),
        level: existing?.level,
        drillPath: existing?.drillPath || [],
        areas: cloneJsonObject(existing?.areas || {})
      });
    });
    manifest.defaultMapId = shell.querySelector<HTMLInputElement>("[data-editor-default-map='1']")?.value || manifest.maps[0]?.mapId;
    const activeMapId = this.editorSelectedMapId || manifest.defaultMapId || fallbackActiveMapId || manifest.maps[0]?.mapId || "default";
    const activeMap = manifest.maps.find((map) => map.mapId === activeMapId) || manifest.maps[0];
    if (!activeMap) {
      manifest.maps.push({ mapId: "default", name: "Mapa principal", svgText: this.settings.svgSettings.svgText, areas: {} });
    }
    const currentMap = manifest.maps.find((map) => map.mapId === activeMapId) || manifest.maps[0];
    currentMap.areas = currentMap.areas || {};

    shell.querySelectorAll<HTMLElement>("[data-area-row]").forEach((row) => {
      const areaId = row.getAttribute("data-area-row") || "";
      currentMap.areas![areaId] = currentMap.areas![areaId] || {};
      currentMap.areas![areaId].bindKey = this.readRowValue(row, "bindKey") || undefined;
      currentMap.areas![areaId].virtualId = this.readRowValue(row, "virtualId") || undefined;
      currentMap.areas![areaId].displayName = this.readRowValue(row, "displayName") || undefined;
      currentMap.areas![areaId].hidden = this.readRowCheckbox(row, "hidden");
    });

    shell.querySelectorAll<HTMLElement>("[data-alias-row]").forEach((row) => {
      const areaId = row.getAttribute("data-alias-row") || "";
      currentMap.areas![areaId] = currentMap.areas![areaId] || {};
      const aliases = (this.readRowValue(row, "aliases") || "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => !!value);
      currentMap.areas![areaId].aliases = aliases.length > 0 ? aliases : undefined;
    });

    shell.querySelectorAll<HTMLElement>("[data-metadata-row]").forEach((row) => {
      const areaId = row.getAttribute("data-metadata-row") || "";
      currentMap.areas![areaId] = currentMap.areas![areaId] || {};
      const raw = this.readRowValue(row, "metadata");
      currentMap.areas![areaId].metadata = raw ? safeParseJsonObject<Record<string, unknown>>(raw, {}) : undefined;
    });

    shell.querySelectorAll<HTMLElement>("[data-drill-row]").forEach((row) => {
      const mapId = row.getAttribute("data-drill-row") || "";
      const map = manifest.maps.find((item) => item.mapId === mapId);
      if (!map) return;
      const levelRaw = this.readRowValue(row, "level");
      map.level = levelRaw === "" ? undefined : Number(levelRaw);
      const drillPath = (this.readRowValue(row, "drillPath") || "")
        .split(">")
        .map((value) => value.trim())
        .filter((value) => !!value);
      map.drillPath = drillPath.length > 0 ? drillPath : [];
    });

    labelOverrides.maps = labelOverrides.maps || {};
    labelOverrides.maps[currentMap.mapId] = labelOverrides.maps[currentMap.mapId] || {};
    shell.querySelectorAll<HTMLElement>("[data-label-row]").forEach((row) => {
      const areaId = row.getAttribute("data-label-row") || "";
      labelOverrides.maps![currentMap.mapId][areaId] = {
        mode: this.readRowValue(row, "mode") || undefined,
        calloutSide: (this.readRowValue(row, "calloutSide") || undefined) as LabelOverride["calloutSide"],
        calloutOffsetX: this.parseOptionalNumber(this.readRowValue(row, "calloutOffsetX")),
        calloutOffsetY: this.parseOptionalNumber(this.readRowValue(row, "calloutOffsetY")),
        hidden: this.readRowCheckbox(row, "hidden")
      };
    });

    return { manifest, labelOverrides, activeMapId: currentMap.mapId };
  }

  private buildPanelTitle(text: string): HTMLElement {
    const title = document.createElement("h3");
    title.textContent = text;
    return title;
  }

  private createEditorHeader(labels: string[]): HTMLTableSectionElement {
    const thead = document.createElement("thead");
    const row = document.createElement("tr");
    for (const label of labels) {
      const th = document.createElement("th");
      th.textContent = label;
      row.appendChild(th);
    }
    thead.appendChild(row);
    return thead;
  }

  private createEditorInput(field: string, value: string): HTMLInputElement {
    const input = document.createElement("input");
    input.value = value;
    input.setAttribute("data-field", field);
    input.className = "sp-editor-input";
    return input;
  }

  private createTextCell(text: string): HTMLTableCellElement {
    const td = document.createElement("td");
    td.textContent = text;
    return td;
  }

  private createInputCell(field: string, value: string): HTMLTableCellElement {
    const td = document.createElement("td");
    td.appendChild(this.createEditorInput(field, value));
    return td;
  }

  private createCheckboxCell(field: string, checked: boolean): HTMLTableCellElement {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.setAttribute("data-field", field);
    td.appendChild(input);
    return td;
  }

  private readRowValue(row: HTMLElement, field: string): string {
    const element = row.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-field='${field}']`);
    return element?.value?.trim?.() ?? "";
  }

  private readRowCheckbox(row: HTMLElement, field: string): boolean {
    const element = row.querySelector<HTMLInputElement>(`input[type='checkbox'][data-field='${field}']`);
    return !!element?.checked;
  }

  private parseOptionalNumber(value: string): number | undefined {
    const parsed = Number(value);
    return value === "" || !Number.isFinite(parsed) ? undefined : parsed;
  }

  // ===== IVisual =====
  public update(options: VisualUpdateOptions) {
    const eventService = (this.host as any)?.eventService as IVisualEventService | undefined;
    eventService?.renderingStarted(options);
    this.lastUpdateOptions = options;

    let succeeded = false;
    try {
      const dv = options?.dataViews?.[0];
      this.formattingSettingsModel = dv
        ? this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, dv)
        : new VisualFormattingSettingsModel();
      this.settings = VisualSettings.parse(dv);
      this.labelOverridesManifest = parseLabelOverridesManifest(this.settings.labelOverrides.overridesJson);
      const previousActiveMapId = this.activeMap.mapId;
      const previousCategoryName = this.activeCategoryQueryName;
      const previousActiveMapLevel = Number(this.activeMap.map?.level);
      const hadRenderableSvg = !!(this.svgRoot && this.zoomRoot);
      this.activeMap = this.resolveActiveMapFromDrillPath(this.settings.svgSettings.svgText, dv);
      this.updateHostDrillState(dv);
      this.buildDataMap(dv);
      this.formattingSettingsModel.area.applyAreaFormattingVisibility(
        this.settings.area.colorMode,
        this.settings.area.matchedFill
      );
      this.applyHighContrastHostStyles();

      const svgText = (this.activeMap.svgText || "").trim();
      const hasSvg = svgText.length > 0;
      const activeMapChanged = previousActiveMapId !== this.activeMap.mapId || previousCategoryName !== this.activeCategoryQueryName;
      if (
        this.shouldBeginDrillFocusTransition(
          previousActiveMapId,
          previousCategoryName,
          previousActiveMapLevel,
          hasSvg,
          hadRenderableSvg
        )
      ) {
        this.beginDrillFocusTransition();
      } else if (activeMapChanged) {
        this.cancelPendingDrillFocus();
      }

      this.setUploadUIVisibility(hasSvg);
      this.setEditorButtonVisibility(hasSvg, options);

      const warningShow = !!this.settings?.warning?.show;
      this.warningForceShow = false;
      if (this.warningInitialized) {
        if (warningShow && !this.lastWarningShow) {
          this.warningForceShow = true;
        }
      } else {
        this.warningInitialized = true;
      }
      this.lastWarningShow = warningShow;

      if (!hasSvg) {
        if (this.canShowSvgPickerUI()) {
          this.clearSvg();
        } else {
          this.showNoSvgMessageOutsideDesktop();
        }
        this.setSanitizationWarning(null, null);
      } else {
        this.render(svgText, dv);
      }

      this.updateLegend(dv, hasSvg);
      if (this.svgRoot && this.zoomRoot) {
        this.computeFitTransform();
        this.scheduleFitToHost();
      }
      const helpShow = !!this.settings?.help?.show;
      let forceHelpShow = false;
      if (this.helpInitialized) {
        if (helpShow && !this.lastHelpShow) {
          forceHelpShow = true;
          this.helpDismissed = false;
        }
      } else {
        this.helpInitialized = true;
      }
      this.lastHelpShow = helpShow;
      this.updateHelpVisibility(hasSvg, forceHelpShow);
      this.setHelpPage(this.helpPageIndex);
      this.renderAdvancedEditor(options, dv);

      succeeded = true;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown error";
      eventService?.renderingFailed(options, reason);
      throw err;
    } finally {
      if (succeeded) {
        eventService?.renderingFinished(options);
      }
    }
  }

  public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
    const instances: VisualObjectInstance[] = [];

    if (options.objectName === "area") {
      instances.push({
        objectName: "area",
        selector: null as any,
        properties: {
          colorMode: this.settings.area.colorMode,
          unmatchedFill: { solid: { color: this.settings.area.unmatchedFill } },
          matchedFill: { solid: { color: this.settings.area.matchedFill } },
          gradientLowFill: { solid: { color: this.settings.area.gradientLowFill } },
          gradientMidFill: { solid: { color: this.settings.area.gradientMidFill } },
          gradientHighFill: { solid: { color: this.settings.area.gradientHighFill } }
        }
      } as any);
    }

    if (options.objectName === "svgSettings") {
      instances.push({
        objectName: "svgSettings",
        selector: null as any,
        properties: {
          svgText: this.settings.svgSettings.svgText,
          defaultFill: { solid: { color: this.settings.svgSettings.defaultFill } },
          labelShow: this.settings.svgSettings.labelShow,
          labelMin: this.settings.svgSettings.labelMin,
          labelMax: this.settings.svgSettings.labelMax,
          labelBold: this.settings.svgSettings.labelBold,
          labelOutlineFactor: this.settings.svgSettings.labelOutlineFactor
        }
      } as any);
    }

    if (options.objectName === "outline") {
      instances.push({
        objectName: "outline",
        selector: null as any,
        properties: {
          show: this.settings.outline.show,
          color: { solid: { color: this.settings.outline.color } },
          width: this.settings.outline.width
        }
      } as any);
    }

    if (options.objectName === "help") {
      instances.push({
        objectName: "help",
        selector: null as any,
        properties: {
          show: this.settings.help.show
        }
      } as any);
    }

    if (options.objectName === "ui") {
      instances.push({
        objectName: "ui",
        selector: null as any,
        properties: {
          language: this.settings.ui.language
        }
      } as any);
    }

    if (options.objectName === NATIVE_AREA_COLORS_OBJECT) {
      instances.push({
        objectName: NATIVE_AREA_COLORS_OBJECT,
        displayName: "Cor das areas",
        selector: { data: [{ roles: ["category"] }] } as powerbi.data.Selector,
        altConstantValueSelector: null as any,
        propertyInstanceKind: {
          [NATIVE_AREA_COLORS_PROPERTY]: powerbi.VisualEnumerationInstanceKinds.ConstantOrRule
        },
        properties: {
          [NATIVE_AREA_COLORS_PROPERTY]: {
            solid: { color: this.settings.area.matchedFill }
          }
        }
      } as any);
    }

    return instances;
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.formattingSettingsModel);
  }

  private getGradientStats(rows: Array<Pick<CatRow, "value">>): GradientStats {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const row of rows) {
      if (!Number.isFinite(row.value)) continue;
      min = Math.min(min, row.value as number);
      max = Math.max(max, row.value as number);
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { min, max };
  }

  private resolveGradientFillColor(value: number | null, matchedFill: string, stats: GradientStats): string {
    const area = this.settings.area;
    if (!Number.isFinite(value)) return matchedFill;
    if (!stats) return matchedFill;
    const { min, max } = stats;
    if (min === max) return area.gradientMidFill;

    const normalized = clamp(((value as number) - min) / (max - min), 0, 1);
    if (normalized <= 0.5) {
      return interpolateHexColor(area.gradientLowFill, area.gradientMidFill, normalized / 0.5);
    }
    return interpolateHexColor(area.gradientMidFill, area.gradientHighFill, (normalized - 0.5) / 0.5);
  }

  private resolveRowFillColor(
    row: Pick<CatRow, "value" | "themeColor" | "nativeFill" | "rawKey" | "legendRawKey" | "colorKey">,
    matchedFill: string,
    stats: GradientStats,
    nativeFallbackFill?: string | null
  ): string {
    const mode = this.settings.area.colorMode;
    if (this.settings.area.colorMode === "Theme") {
      return this.getPowerBIThemeColor(row, row.rawKey, row.themeColor || matchedFill);
    }
    if (mode === "Gradient") return this.resolveGradientFillColor(row.value, matchedFill, stats);
    return row.nativeFill || nativeFallbackFill || matchedFill;
  }

  // ===== data parse =====
  private buildDataMap(dv?: DataView) {
    this.dataMap.clear();
    this.highlightedKeys.clear();
    this.hasHighlights = false;
    const cat = dv?.categorical as DataViewCategorical | undefined;
    const catCols = cat?.categories ?? [];
    const categoryCols = this.getCategoryColumns(dv);
    const currentCategory =
      categoryCols.find((column) => this.getCategoryColumnName(column) === this.activeCategoryQueryName) ||
      categoryCols[categoryCols.length - 1] ||
      categoryCols[0] ||
      null;
    const regionCol = currentCategory || catCols[0];
    if (!regionCol) return;
    this.currentDrillPath = categoryCols
      .map((column) => this.getCategoryColumnName(column))
      .filter((name): name is string => !!name);
    this.activeCategoryQueryName = this.getCategoryColumnName(currentCategory);
    const legendCol = catCols.find((c) => c?.source?.roles?.legend);

    const values = cat?.values;
    const valueCols = values ? Array.from(values) : [];

    const measureCol = valueCols.find((vc) => vc?.source?.roles?.measure) || valueCols[0];
    const tooltipCols = valueCols.filter((vc) => vc?.source?.roles?.tooltips);
    const highlightVals = measureCol?.highlights;
    this.hasHighlights = Array.isArray(highlightVals);

    const metadataObjects = dv?.metadata?.objects as any;
    const staticMatchedOverride = tryGetFillColorFromObjects(metadataObjects, "area", "matchedFill");
    const staticNativeFill = tryGetFillColorFromObjects(metadataObjects, NATIVE_AREA_COLORS_OBJECT, NATIVE_AREA_COLORS_PROPERTY) || null;
    const hasMatchedFillOverride = typeof staticMatchedOverride === "string" && staticMatchedOverride.length > 0;
    const staticMatchedFill = hasMatchedFillOverride ? staticMatchedOverride : this.settings.area.matchedFill;
    const rows: CatRow[] = [];

    for (let i = 0; i < regionCol.values.length; i++) {
      const rawKey = String(regionCol.values[i] ?? "");
      const key = norm(rawKey);
      const legendRaw = legendCol ? String(legendCol.values[i] ?? "") : "";
      const legendRawKey = legendRaw.trim() || rawKey;
      const colorKey = legendRawKey || rawKey;
      const nativeObjects = regionCol.objects?.[i];

      const measureValRaw = measureCol ? (measureCol.values[i] as any) : null;
      const highlightVal = this.hasHighlights ? (highlightVals as any)?.[i] : undefined;
      const measureValNum =
        measureValRaw === null || measureValRaw === undefined || measureValRaw === ""
          ? null
          : Number(measureValRaw);

      const fields: ValueField[] = [];
      if (measureCol) fields.push({ label: measureCol.source.displayName, value: measureValRaw });
      for (const tc of tooltipCols) fields.push({ label: tc.source.displayName, value: tc.values[i] });

      let identity: ISelectionId = {} as any;
      try {
        const builder = (this.host as any)?.createSelectionIdBuilder?.();
        if (builder?.withCategory) {
          identity = builder.withCategory(regionCol as any, i).createSelectionId();
        }
      } catch {
        identity = {} as any;
      }

      const themeColor = this.getThemeColorForKey(colorKey);
      const nativeFill = tryGetFillColorFromObjects(nativeObjects, NATIVE_AREA_COLORS_OBJECT, NATIVE_AREA_COLORS_PROPERTY) || null;

      if (this.hasHighlights && highlightVal !== null && highlightVal !== undefined) {
        this.highlightedKeys.add(key);
      }

      rows.push({
        key,
        rawKey,
        legendRawKey,
        colorKey,
        value: Number.isFinite(measureValNum) ? measureValNum : null,
        fields,
        identity,
        idx: i,
        themeColor,
        nativeFill,
        fillColor: hasMatchedFillOverride ? staticMatchedFill : themeColor || staticMatchedFill
      });
    }

    const gradientStats = this.getGradientStats(rows);
    for (const row of rows) {
      row.fillColor = this.resolveRowFillColor(row, staticMatchedFill, gradientStats, staticNativeFill);
      this.dataMap.set(row.key, row);
    }
  }

  // ===== render =====
  private render(svgTextRaw: string, dv?: DataView) {
    const svgText = decodeSvgDataUri(svgTextRaw);
    const svgSig = `${hashString(svgText)}_${svgText.length}`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");

    const { svg: parsed, report } = sanitizeSvgDocument(doc);

    if (!parsed) {
      if (this.canShowSvgPickerUI()) {
        this.clearSvg();
        return;
      }
      this.showNoSvgMessageOutsideDesktop();
      this.setSanitizationWarning(null, null);
      return;
    }

    const pruneResult = this.pruneSvgToDrillDataScope(parsed);
    const renderSig = `${svgSig}_${this.getDrillSvgScopeSignature(pruneResult)}`;

    this.setSanitizationWarning(report, svgSig, this.warningForceShow);
    if (this.svgRoot && this.zoomRoot && this.lastRenderedSvgSignature === renderSig) {
      this.markDrillFocusDomInserted();
      this.applyRegionsStyleAndEvents();
      if (!this.syncSelectionFromHighlights()) {
        this.syncSelectionFromHost();
      }
      this.applySelectionVisualState();
      return;
    }

    this.clearSvg(this.pendingDrillFocus);
    this.setSanitizationWarning(report, svgSig, this.warningForceShow);

    const svgNode = document.importNode(parsed, true) as SVGSVGElement;
    const widthAttr = svgNode.getAttribute("width");
    const heightAttr = svgNode.getAttribute("height");

    svgNode.removeAttribute("width");
    svgNode.removeAttribute("height");
    svgNode.style.position = "absolute";
    svgNode.style.top = "0";
    svgNode.style.right = "0";
    svgNode.style.bottom = "0";
    svgNode.style.left = "0";
    svgNode.style.width = "100%";
    svgNode.style.height = "100%";
    svgNode.style.display = "block";
    svgNode.style.userSelect = "none";
    svgNode.setAttribute("preserveAspectRatio", "xMidYMid meet");

    if (!svgNode.getAttribute("viewBox")) {
      const w = widthAttr ? Number(String(widthAttr).replace(/[^\d.]/g, "")) : NaN;
      const h = heightAttr ? Number(String(heightAttr).replace(/[^\d.]/g, "")) : NaN;
      if (isFinite(w) && isFinite(h) && w > 0 && h > 0) {
        svgNode.setAttribute("viewBox", `0 0 ${w} ${h}`);
      }
    }

    const zoom = document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement;
    zoom.setAttribute("class", "sp-zoom-root");

    const children = Array.from(svgNode.childNodes);
    for (const ch of children) zoom.appendChild(ch);
    svgNode.appendChild(zoom);

    this.svgRoot = svgNode;
    this.zoomRoot = zoom;

    this.prepareSvgForDrillReveal(svgNode);
    this.svgHost.appendChild(svgNode);
    this.markDrillFocusDomInserted();

    svgNode.querySelectorAll("title").forEach((t) => t.remove());
    this.lastRenderedSvgSignature = renderSig;
    this.rebuildRegionCache();

    this.wireZoomPan();

    this.applyRegionsStyleAndEvents();
    if (!this.syncSelectionFromHighlights()) {
      this.syncSelectionFromHost();
    }
    this.applySelectionVisualState();
  }

  private wireContainerContextMenu() {
    this.container.addEventListener("contextmenu", (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (this.svgRoot && target && this.svgRoot.contains(target)) return;
      if (this.legendHost && target && this.legendHost.contains(target)) return;

      ev.preventDefault();
      this.hideTooltip();
      this.showContextMenuAt(null, ev.clientX, ev.clientY);
    });
  }

  private wireZoomPan() {
    if (!this.svgRoot) return;

    this.svgRoot.addEventListener(
      "wheel",
      (ev: WheelEvent) => {
        ev.preventDefault();
        this.hideTooltip();

        const pt = this.clientToSvgPoint(ev.clientX, ev.clientY);
        if (!pt) return;

        const delta = -ev.deltaY;
        const zoomFactor = Math.exp(delta * 0.0022);
        const newScale = clamp(this.scale * zoomFactor, 0.35, this.getMaxInteractiveZoomScale());

        const worldX = (pt.x - this.tx) / this.scale;
        const worldY = (pt.y - this.ty) / this.scale;

        this.scale = newScale;

        this.tx = pt.x - worldX * this.scale;
        this.ty = pt.y - worldY * this.scale;

        if (this.scale <= this.fitTransform.scale + 1e-6) {
          this.resetToFit();
          return;
        }

        this.applyZoomTransform();
      },
      { passive: false }
    );

    this.svgRoot.addEventListener("mousedown", (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      const target = ev.target as Element | null;
      if (this.isRegionTarget(target)) return;
      this.hideTooltip();

      this.isPanning = true;
      const pt = this.clientToSvgPoint(ev.clientX, ev.clientY);
      if (!pt) return;
      this.panStartPt = pt;
      this.panStartT = { x: this.tx, y: this.ty };
    });

    window.addEventListener("mousemove", (ev: MouseEvent) => {
      if (!this.isPanning || !this.panStartPt || !this.panStartT) return;
      const pt = this.clientToSvgPoint(ev.clientX, ev.clientY);
      if (!pt) return;

      const dx = pt.x - this.panStartPt.x;
      const dy = pt.y - this.panStartPt.y;

      this.tx = this.panStartT.x + dx;
      this.ty = this.panStartT.y + dy;

      this.applyZoomTransform();
    });

    window.addEventListener("mouseup", () => {
      this.isPanning = false;
      this.panStartPt = null;
      this.panStartT = null;
    });

    this.svgRoot.addEventListener("click", (ev: MouseEvent) => {
      if (ev.button !== 0) return;
      const target = ev.target as Element | null;
      if (this.isRegionTarget(target)) {
        this.delegateSvgRegionEvent(ev, "click");
        return;
      }
      if (this.selectionSource !== "self") return;
      this.clearSelection();
    });

    this.svgRoot.addEventListener("mouseover", (ev: MouseEvent) => {
      const target = this.getRegionEventElement(ev.target as Element | null);
      if (!target || target.contains(ev.relatedTarget as Node | null)) return;
      this.delegateSvgRegionEvent(ev, "mouseenter");
    });

    this.svgRoot.addEventListener("mousemove", (ev: MouseEvent) => this.delegateSvgRegionEvent(ev, "mousemove"));

    this.svgRoot.addEventListener("mouseout", (ev: MouseEvent) => {
      const target = this.getRegionEventElement(ev.target as Element | null);
      if (!target || target.contains(ev.relatedTarget as Node | null)) return;
      this.delegateSvgRegionEvent(ev, "mouseleave");
    });

    this.svgRoot.addEventListener("keydown", (ev: KeyboardEvent) => this.delegateSvgRegionEvent(ev, "keydown"));

    this.svgRoot.addEventListener("contextmenu", (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (this.isRegionTarget(target)) {
        this.delegateSvgRegionEvent(ev, "contextmenu");
        return;
      }
      ev.preventDefault();
      this.hideTooltip();
      this.showContextMenuAt(null, ev.clientX, ev.clientY);
    });
  }

  private cancelRegionStyleBatch(): void {
    this.regionStyleBatchToken++;
    if (this.regionStyleBatchId !== null) {
      cancelAnimationFrame(this.regionStyleBatchId);
      this.regionStyleBatchId = null;
    }
  }

  private scheduleRegionStyleBatch(): void {
    this.cancelRegionStyleBatch();
    const token = this.regionStyleBatchToken;
    this.regionStyleBatchId = requestAnimationFrame(() => {
      this.regionStyleBatchId = null;
      if (token !== this.regionStyleBatchToken || !this.zoomRoot) return;
      this.applyRegionsStyleAndEvents(true);
      this.markDrillFocusStylesApplied();
      this.applySelectionVisualState();
      if (this.pendingDrillFocus) this.scheduleFitToHost();
    });
  }

  private applyRegionsStyleAndEvents(forceSync = false) {
    if (!this.zoomRoot) return;
    if (!forceSync && this.isDenseMap()) {
      this.scheduleRegionStyleBatch();
      return;
    }

    const cfg = this.settings.svgSettings;
    const inHighContrast = this.isHighContrastMode();
    const hcPalette = inHighContrast ? this.getHighContrastPalette() : null;

    const regionEls = this.getRenderableRegionElements();
    this.refreshRenderScope();
    const visibleRegionEls = regionEls.filter((el) => {
      const id = ((el as any).id as string) || "";
      return !!id && !this.isAreaHidden(id) && !this.isHiddenByRenderScope(id);
    });
    const mapBBox = getCombinedRegionBBox(visibleRegionEls.length ? visibleRegionEls : regionEls);

    for (const el of regionEls) {
      const id = (el as any).id as string;
      if (!id) continue;
      el.setAttribute("data-sp-region", "1");

      el.querySelectorAll("title").forEach((t) => t.remove());
      (el as any).removeAttribute?.("title");

      const key = norm(id);
      const row = this.getBoundRowForElementId(id);
      const areaOverride = this.getAreaManifestOverride(id);

      if (areaOverride?.hidden) {
        this.setRegionHidden(el, true);
        el.removeAttribute("tabindex");
        el.removeAttribute("focusable");
        el.removeAttribute("role");
        (el as any).style.cursor = "default";
        (el as any).style.outline = "none";
        continue;
      }

      if (this.isHiddenByRenderScope(id) && !this.containsBoundRenderScopeRegion(el)) {
        this.setRegionHidden(el, true);
        el.removeAttribute("tabindex");
        el.removeAttribute("focusable");
        el.removeAttribute("role");
        (el as any).style.cursor = "default";
        (el as any).style.outline = "none";
        continue;
      }

      this.setRegionHidden(el, false);

      if (row) {
        const baseFill = inHighContrast && hcPalette ? hcPalette.foreground : row.fillColor || this.settings.area.matchedFill;
        this.setRegionFill(el, baseFill);
        el.setAttribute("tabindex", "0");
        el.setAttribute("focusable", "true");
        el.setAttribute("role", "button");
        const labelText = row.legendRawKey || row.rawKey || id;
        el.setAttribute("aria-label", `${labelText}${row.value !== null ? `: ${row.value}` : ""}`);
        el.removeAttribute("aria-hidden");
      } else {
        const baseFill = inHighContrast && hcPalette ? hcPalette.background : this.settings.area.unmatchedFill;
        this.setRegionFill(el, baseFill);
        el.removeAttribute("tabindex");
        el.removeAttribute("focusable");
        el.removeAttribute("role");
        el.setAttribute("aria-hidden", "true");
      }

      this.applyOutline(el);

      (el as any).style.cursor = row ? "pointer" : "default";
      (el as any).style.outline = "none";
    }

    if (cfg.labelShow) {
      const dense = this.isDenseMap();
      const denseMode = this.settings.svgSettings.labelDenseMode;
      for (const el of regionEls) {
        const id = (el as any).id as string;
        if (!id) continue;
        if (this.isAreaHidden(id) || this.isHiddenByRenderScope(id)) {
          removeLabel(el);
          removeCalloutLabel(el);
          continue;
        }
        const row = this.getBoundRowForElementId(id);
        const denseAllowsLabel =
          !dense ||
          denseMode === "All" ||
          (denseMode === "DataOnly" && !!row) ||
          (denseMode === "SelectedOnly" && !!row && this.selectedKeys.has(row.key));
        if (!row || denseMode === "Hidden" || !denseAllowsLabel) {
          removeLabel(el);
          removeCalloutLabel(el);
          continue;
        }
        const areaOverride = this.getAreaManifestOverride(id);
        const labelOverride = this.getLabelOverride(id);
        if (areaOverride?.hidden || labelOverride?.hidden) {
          removeLabel(el);
          removeCalloutLabel(el);
          continue;
        }

        const text = getRowLabelText(row, this.settings.labels.labelContent);
        if (!text) {
          removeLabel(el);
          removeCalloutLabel(el);
          continue;
        }

        const labelMode = labelOverride?.mode || areaOverride?.labelMode || this.settings.labels.labelMode;
        if (labelMode === "OutsideCallout") {
          removeLabel(el);
          upsertCalloutLabel(
            el,
            text,
            cfg,
            this.settings.labels,
            inHighContrast,
            hcPalette,
            mapBBox,
            labelOverride || areaOverride
          );
        } else {
          removeCalloutLabel(el);
          upsertLabel(el, text, row.fillColor || this.settings.area.matchedFill, cfg, dense);
        }
      }
      this.resolveCalloutCollisions();
      this.applyLabelZoomCompensation();
    } else {
      regionEls.forEach((el) => {
        removeLabel(el);
        removeCalloutLabel(el);
      });
    }

    this.markDrillFocusStylesApplied();
  }

  private resolveCalloutCollisions(): void {
    if (!this.zoomRoot) return;
    const callouts = Array.from(this.zoomRoot.querySelectorAll<SVGGElement>("g.sp-callout-label"));
    const regionEls = this.getRenderableRegionElements();
    const visibleRegionEls = regionEls.filter((el) => !this.isAreaHidden(((el as any).id as string) || ""));
    const mapBBox = getCombinedRegionBBox(visibleRegionEls.length ? visibleRegionEls : regionEls);
    this.layoutCalloutLanes(callouts, mapBBox);
  }

  private layoutCalloutLanes(callouts: SVGGElement[], mapBBox: GeometryBBox): void {
    if (!(mapBBox.width > 0) || !(mapBBox.height > 0)) return;
    const minGap = Math.max(0, Number(this.settings.labels.calloutMinGap) || 18);
    const distance = Math.max(8, Number(this.settings.labels.calloutDistance) || 36);
    const groups = new Map<CalloutSide, SVGGElement[]>();
    for (const callout of callouts) {
      const side = (callout.getAttribute("data-side") || "right") as CalloutSide;
      if (!groups.has(side)) groups.set(side, []);
      groups.get(side)?.push(callout);
    }

    for (const [side, group] of groups.entries()) {
      const vertical = side === "right" || side === "left";
      const maxWidth = Math.max(
        24,
        ...group.map((callout) => Number(callout.getAttribute("data-text-width")) || 24)
      );
      const maxHeight = Math.max(
        12,
        ...group.map((callout) => Number(callout.getAttribute("data-text-height")) || 12)
      );
      const fixedX =
        side === "right"
          ? mapBBox.x + mapBBox.width + distance + maxWidth / 2
          : side === "left"
            ? mapBBox.x - distance - maxWidth / 2
            : NaN;
      const fixedY =
        side === "bottom"
          ? mapBBox.y + mapBBox.height + distance + maxHeight / 2
          : side === "top"
            ? mapBBox.y - distance - maxHeight / 2
            : NaN;

      group.sort((a, b) => this.getCalloutDesiredLanePosition(a, vertical) - this.getCalloutDesiredLanePosition(b, vertical));
      const min = vertical ? mapBBox.y : mapBBox.x;
      const max = vertical ? mapBBox.y + mapBBox.height : mapBBox.x + mapBBox.width;
      const positions = this.distributeCalloutLanePositions(group, vertical, min, max, minGap);

      group.forEach((callout, index) => {
        const text = callout.querySelector("text");
        const path = callout.querySelector("path");
        if (!text || !path) return;
        const textWidth = Number(callout.getAttribute("data-text-width")) || 24;
        const textHeight = Number(callout.getAttribute("data-text-height")) || 12;
        const placement: CalloutPlacement = {
          anchorX: Number(callout.getAttribute("data-anchor-x")) || 0,
          anchorY: Number(callout.getAttribute("data-anchor-y")) || 0,
          textX: vertical ? fixedX : positions[index],
          textY: vertical ? positions[index] : fixedY,
          side,
          textWidth,
          textHeight
        };
        text.setAttribute("x", String(placement.textX));
        text.setAttribute("y", String(placement.textY));
        const textAlign = callout.getAttribute("data-text-align") || this.settings.labels.calloutTextAlign;
        text.setAttribute("text-anchor", resolveCalloutTextAnchor(side, textAlign));
        path.setAttribute("d", buildCalloutConnectorPath(placement, this.settings.labels, { textAlign } as LabelOverride));
      });
    }
  }

  private getCalloutDesiredLanePosition(callout: SVGGElement, vertical: boolean): number {
    const text = callout.querySelector("text");
    const attr = vertical ? "y" : "x";
    return Number(text?.getAttribute(attr)) || Number(callout.getAttribute(vertical ? "data-anchor-y" : "data-anchor-x")) || 0;
  }

  private distributeCalloutLanePositions(
    callouts: SVGGElement[],
    vertical: boolean,
    min: number,
    max: number,
    gap: number
  ): number[] {
    if (callouts.length === 0) return [];
    const desired = callouts.map((callout) => this.getCalloutDesiredLanePosition(callout, vertical));
    const positions: number[] = [];
    for (let i = 0; i < desired.length; i++) {
      const minAllowed = i === 0 ? min : positions[i - 1] + gap;
      positions[i] = Math.max(desired[i], minAllowed);
    }

    const overflow = positions[positions.length - 1] - max;
    if (overflow > 0) {
      positions[positions.length - 1] = max;
      for (let i = positions.length - 2; i >= 0; i--) {
        positions[i] = Math.min(positions[i], positions[i + 1] - gap);
      }
    }

    const underflow = min - positions[0];
    if (underflow > 0) {
      for (let i = 0; i < positions.length; i++) {
        positions[i] += underflow;
      }
    }
    return positions;
  }

  private setRegionFill(el: SVGElement, color: string) {
    const tag = el.tagName.toLowerCase();
    if (tag === "g") {
      const shapes = Array.from(el.querySelectorAll<SVGElement>("path,polygon,rect,circle,ellipse"));
      if (shapes.length) {
        shapes.forEach((s) => {
          s.setAttribute("fill", color);
          (s as any).style.fill = color;
        });
        return;
      }
    }
    el.setAttribute("fill", color);
    (el as any).style.fill = color;
  }

  private setRegionHidden(el: SVGElement, hidden: boolean) {
    (el as any).style.display = hidden ? "none" : "";
    (el as any).style.pointerEvents = hidden ? "none" : "";
    if (hidden) {
      removeLabel(el);
      removeCalloutLabel(el);
      el.setAttribute("aria-hidden", "true");
    }
  }

  private applyOutline(el: SVGElement) {
    const o = this.settings.outline;
    const inHighContrast = this.isHighContrastMode();
    const hcPalette = inHighContrast ? this.getHighContrastPalette() : null;
    if (!o.show) {
      if (inHighContrast && hcPalette) {
        el.setAttribute("stroke", hcPalette.foreground);
        el.setAttribute("stroke-width", "2");
        el.setAttribute("vector-effect", "non-scaling-stroke");
        (el as any).style.stroke = hcPalette.foreground;
        (el as any).style.strokeWidth = "2";
        (el as any).style.vectorEffect = "non-scaling-stroke";
        return;
      }
      el.removeAttribute("stroke");
      el.removeAttribute("stroke-width");
      el.removeAttribute("vector-effect");
      (el as any).style.stroke = "";
      (el as any).style.strokeWidth = "";
      (el as any).style.vectorEffect = "";
      return;
    }
    const strokeColor = inHighContrast && hcPalette ? hcPalette.foreground : o.color;
    const strokeWidth = inHighContrast ? Math.max(2, Number(o.width) || 1) : Number(o.width) || 1;
    el.setAttribute("stroke", strokeColor);
    el.setAttribute("stroke-width", String(strokeWidth));
    el.setAttribute("vector-effect", "non-scaling-stroke");
    (el as any).style.stroke = strokeColor;
    (el as any).style.strokeWidth = String(strokeWidth);
    (el as any).style.vectorEffect = "non-scaling-stroke";
  }

  private syncSelectionFromHost() {
    if (!this.selectionManager) return;

    if (typeof this.selectionManager.hasSelection === "function") {
      const hasSelection = this.selectionManager.hasSelection();
      if (!hasSelection) {
        this.setSelectionFromIds([], "none");
        return;
      }
    }

    if (typeof this.selectionManager.getSelectionIds === "function") {
      const ids = this.selectionManager.getSelectionIds();
      const src: SelectionSource = ids && ids.length > 0 ? "self" : "none";
      this.setSelectionFromIds(ids, src);
    }
  }

  private clearSelection() {
    if (this.selectionSource !== "self") return;
    if (!this.selectionManager?.clear) {
      this.setSelectionFromIds([], "none");
      return;
    }

    this.setSelectionFromIds([], "none");
    if (this.selectionManager.select) {
      this.selectionManager.select([] as ISelectionId[], false).catch(() => {
        return;
      });
    }
    this.selectionManager.clear().catch(() => {
      this.setSelectionFromIds([], "none");
    });
  }

  private animateZoomTransform(next: { scale: number; tx: number; ty: number }, durationMs?: number): void {
    const duration = Math.max(0, Number(durationMs) || 0);
    const reduceMotion = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (duration <= 0 || reduceMotion) {
      this.scale = next.scale;
      this.tx = next.tx;
      this.ty = next.ty;
      this.applyZoomTransform();
      return;
    }

    const start = { scale: this.scale, tx: this.tx, ty: this.ty };
    const startedAt = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = clamp((now - startedAt) / duration, 0, 1);
      const k = ease(t);
      this.scale = start.scale + (next.scale - start.scale) * k;
      this.tx = start.tx + (next.tx - start.tx) * k;
      this.ty = start.ty + (next.ty - start.ty) * k;
      this.applyZoomTransform();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private focusSelectedAreas(): void {
    if (!this.zoomRoot || !this.svgRoot || !this.settings.interaction.autoFocusSelectedArea) return;
    if (this.isPanning) return;
    if (this.selectionSource === "external" && !this.settings.interaction.focusExternalSelection) return;

    if (this.selectedKeys.size === 0) {
      this.animateZoomTransform(this.fitTransform, this.settings.interaction.focusAnimationMs);
      return;
    }

    const selectedEls = this.getSelectedRegionElementsForActiveMap();
    if (selectedEls.length === 0) return;
    this.focusElements(selectedEls);
  }

  private getActiveVisualFocusKeys(): Set<string> {
    if (this.selectedKeys.size > 0) return this.selectedKeys;
    if (this.suppressSelectionFocusForPotentialDrill && this.potentialDrillVisualKey) {
      return new Set<string>([this.potentialDrillVisualKey]);
    }
    return this.selectedKeys;
  }

  private applySelectionVisualState(resetFocusOnEmptySelection = false) {
    if (!this.zoomRoot) return;

    const cfg = this.settings.svgSettings;
    const visualFocusKeys = this.getActiveVisualFocusKeys();
    const hasFocus = visualFocusKeys.size > 0;
    const inHighContrast = this.isHighContrastMode();
    const hcPalette = inHighContrast ? this.getHighContrastPalette() : null;

    const regionEls = this.getRenderableRegionElements();
    this.refreshRenderScope();
    const drillDataState = this.getDrillDataRegionState();

    for (const el of regionEls) {
      const id = (el as any).id as string;
      if (!id) continue;
      if (this.isAreaHidden(id)) {
        this.setRegionHidden(el, true);
        continue;
      }

      if (this.isHiddenByRenderScope(id) && !this.containsBoundRenderScopeRegion(el)) {
        this.setRegionHidden(el, true);
        continue;
      }

      this.setRegionHidden(el, false);

      const key = norm(id);
      const row = this.getBoundRowForElementId(id);
      const isDrillUnbound = drillDataState.active && !row;
      if (!row) {
        if (isDrillUnbound) {
          if (this.settings.drillMaps.noDataBehavior === "Hide") {
            this.setRegionHidden(el, true);
          } else {
            (el as any).style.display = "";
            (el as any).style.pointerEvents = "none";
            (el as any).style.opacity = "0.12";
            (el as any).style.filter = "";
          }
        } else {
          (el as any).style.display = "";
          (el as any).style.pointerEvents = "";
          (el as any).style.opacity = "1";
        }
        continue;
      }

      const isSelected = hasFocus ? visualFocusKeys.has(row.key || key) : false;
      const labelOpacity = isSelected ? "1" : String(this.settings.interaction.labelUnselectedOpacity);
      if (inHighContrast && hcPalette) {
        const fill = hasFocus ? (isSelected ? hcPalette.foregroundSelected : hcPalette.background) : hcPalette.foreground;
        this.setRegionFill(el, fill);
        (el as any).style.opacity = "1";
        this.applyOutline(el);
        if (cfg.labelShow) {
          const lab = getLabel(el);
          if (lab) {
            (lab as any).style.display = "";
            (lab as any).style.opacity = hasFocus ? labelOpacity : "1";
          }
          const callout = getCalloutLabel(el);
          if (callout) {
            (callout as any).style.display = "";
            (callout as any).style.opacity = hasFocus ? labelOpacity : "1";
          }
        }
        continue;
      }

      if (!hasFocus) {
        (el as any).style.opacity = drillDataState.active ? "1" : "1";
        (el as any).style.pointerEvents = "";
        if (cfg.labelShow) {
          const lab = getLabel(el);
          if (lab) {
            (lab as any).style.display = "";
            (lab as any).style.opacity = "1";
          }
          const callout = getCalloutLabel(el);
          if (callout) {
            (callout as any).style.display = "";
            (callout as any).style.opacity = "1";
          }
        }
        continue;
      }

      (el as any).style.opacity = isSelected ? "1" : String(this.settings.interaction.unselectedOpacity);

      if (cfg.labelShow) {
        const lab = getLabel(el);
        if (lab) {
          (lab as any).style.display = "";
          (lab as any).style.opacity = isSelected ? "1" : String(this.settings.interaction.labelUnselectedOpacity);
        }
        const callout = getCalloutLabel(el);
        if (callout) {
          (callout as any).style.display = "";
          (callout as any).style.opacity = isSelected ? "1" : String(this.settings.interaction.labelUnselectedOpacity);
        }
      }
    }

    if (this.legendHost) {
      const selectedLegendGroups = new Set<string>();
      for (const key of visualFocusKeys) {
        const row = this.dataMap.get(key);
        if (!row) continue;
        selectedLegendGroups.add(this.getLegendGroupKeyForRow(row));
      }

      const legendItems = Array.from(this.legendHost.querySelectorAll<HTMLElement>("[data-sp-legend-group]"));
      for (const item of legendItems) {
        const groupKey = item.getAttribute("data-sp-legend-group") || "";
        const isSelected = hasFocus ? selectedLegendGroups.has(groupKey) : false;
        item.style.opacity = hasFocus ? (isSelected ? "1" : "0.35") : "1";
      }
    }

    if (this.pendingDrillFocus) {
      this.applyLabelZoomCompensation();
      return;
    }

    if (this.suppressSelectionFocusForPotentialDrill) {
      this.applyLabelZoomCompensation();
      return;
    }

    const selectedEls = this.getSelectedRegionElementsForActiveMap();
    if (selectedEls.length > 0) {
      this.focusElements(selectedEls);
    } else if (resetFocusOnEmptySelection && this.selectedKeys.size === 0) {
      this.resetFocusToCurrentScope();
    } else if (drillDataState.active && this.settings.drillMaps.focusDataAreas) {
      this.focusDrillDataAreas();
    }
    this.applyLabelZoomCompensation();
  }
}
