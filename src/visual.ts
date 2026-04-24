// src/visual.ts
"use strict";

import "./../style/visual.less";

import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;

import DataView = powerbi.DataView;
import DataViewCategorical = powerbi.DataViewCategorical;

import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.extensibility.ISelectionId;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;

import VisualObjectInstance = powerbi.VisualObjectInstance;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;


import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualSettings, SvgSettings, VisualFormattingSettingsModel } from "./settings";

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

function regionContainsPoint(el: SVGElement, x: number, y: number): boolean {
  const geometries = getRegionGeometryElements(el);
  for (const geometry of geometries) {
    try {
      const svgGeometry = geometry as unknown as SVGGeometryElement;
      if (typeof svgGeometry.isPointInFill === "function" && svgGeometry.isPointInFill({ x, y })) {
        return true;
      }
    } catch {
      // fallback below
    }

    const bbox = getGeometryBBox(geometry);
    if (x >= bbox.x && x <= bbox.x + bbox.width && y >= bbox.y && y <= bbox.y + bbox.height) {
      return true;
    }
  }
  return false;
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

function findLabelPlacement(el: SVGElement, labelWidth: number, labelHeight: number): LabelPlacement {
  const bbox = getRegionBBox(el);
  const fallback = {
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

function upsertLabel(el: SVGElement, text: string, fillColorForContrast: string, cfg: SvgSettings) {
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
  t.setAttribute("paint-order", "stroke");
  (t as any).style.display = "";

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
  t.setAttribute("stroke-width", String(Math.max(0, Math.round(fontSize * factor))));
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

function sumRecord(record: Record<string, number>): number {
  return Object.values(record).reduce((acc, v) => acc + v, 0);
}

function formatRecord(record: Record<string, number>, limit: number = 4): string {
  const entries = Object.entries(record).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "";
  const shown = entries.slice(0, limit).map(([key, count]) => `${key} x${count}`);
  const remaining = entries.length - shown.length;
  return remaining > 0 ? `${shown.join(", ")}, +${remaining}` : shown.join(", ");
}

function buildSanitizationSummary(report: SanitizationReport, lang: UiLanguage): string | null {
  const parts: string[] = [];
  const tagCount = sumRecord(report.removedTags);
  const attrCount = sumRecord(report.removedAttrs);

  if (lang === "pt") {
    if (tagCount > 0) parts.push(`tags (${formatRecord(report.removedTags)})`);
    if (attrCount > 0) parts.push(`atributos (${formatRecord(report.removedAttrs)})`);
    if (report.removedStyleParts > 0) parts.push(`estilos inseguros (${report.removedStyleParts})`);
  } else {
    if (tagCount > 0) parts.push(`tags (${formatRecord(report.removedTags)})`);
    if (attrCount > 0) parts.push(`attributes (${formatRecord(report.removedAttrs)})`);
    if (report.removedStyleParts > 0) parts.push(`unsafe styles (${report.removedStyleParts})`);
  }

  if (parts.length === 0) return null;
  return lang === "pt" ? `Itens removidos: ${parts.join("; ")}.` : `Items removed: ${parts.join("; ")}.`;
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


export class Visual implements IVisual {
  private host: any;
  private container: HTMLElement;
  private storageService: ILocalVisualStorageService | null = null;

  private svgRoot: SVGSVGElement | null = null;
  private zoomRoot: SVGGElement | null = null;

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
  private legendHost!: HTMLDivElement;

  // host env
  private hostEnv: number | undefined;

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
    this.legendHost = this.createLegendUI();

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

  private isRegionTarget(target: Element | null): boolean {
    if (!target || !(target as any).closest) return false;
    return !!target.closest("[data-sp-region='1']");
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
    if (source) {
      this.selectionSource = source;
    }
    this.selectedKeys.clear();

    if (!ids || ids.length === 0) {
      if (this.selectionSource === "self") {
        this.selectionSource = "none";
      }
      this.applySelectionVisualState();
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

    this.applySelectionVisualState();
  }

  private syncSelectionFromHighlights(): boolean {
    if (!this.hasHighlights) return false;
    this.selectionSource = "external";
    this.selectedKeys.clear();
    for (const key of this.highlightedKeys) this.selectedKeys.add(key);
    return true;
  }

  private selectRow(row: CatRow, multiSelect: boolean, after?: () => void) {
    this.selectionSource = "self";
    const applyLocalSelection = () => {
      if (multiSelect) {
        if (this.selectedKeys.has(row.key)) this.selectedKeys.delete(row.key);
        else this.selectedKeys.add(row.key);
      } else {
        this.selectedKeys.clear();
        this.selectedKeys.add(row.key);
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

  private createUploadUI() {
    this.uploadCta = document.createElement("div");
    this.uploadCta.className = "sp-upload-cta";
    Object.assign(this.uploadCta.style, {
      position: "absolute",
      top: "14px",
      left: "14px",
      right: "14px",
      display: "none",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: "10px",
      padding: "10px 12px",
      borderRadius: "10px",
      border: "1px dashed rgba(255,255,255,0.25)",
      background: "rgba(0,0,0,0.18)",
      color: "#fff",
      backdropFilter: "blur(2px)",
      zIndex: "20",
      userSelect: "none"
    } as CSSStyleDeclaration);

    const ctaText = document.createElement("div");
    const ctaTitle = document.createElement("div");
    ctaTitle.style.fontWeight = "700";
    ctaTitle.textContent = "SVG nao configurado";

    const ctaSubtitle = document.createElement("div");
    Object.assign(ctaSubtitle.style, {
      opacity: ".9",
      fontSize: "12px"
    } as CSSStyleDeclaration);
    ctaSubtitle.textContent = 'Clique em "Trocar SVG" para selecionar um arquivo .svg';

    ctaText.appendChild(ctaTitle);
    ctaText.appendChild(ctaSubtitle);
    this.uploadCta.appendChild(ctaText);
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

      this.fileInput.value = "";
    });
    this.container.appendChild(this.fileInput);

    this.uploadBtn = document.createElement("button");
    this.uploadBtn.type = "button";
    this.uploadBtn.textContent = "Trocar SVG";
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
    this.svgWarningTitle.textContent = "Aviso: SVG sanitizado";

    this.svgWarningCloseBtn = document.createElement("button");
    this.svgWarningCloseBtn.type = "button";
    this.svgWarningCloseBtn.textContent = "×";
    this.svgWarningCloseBtn.setAttribute("aria-label", "Fechar aviso");
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
    if (!this.svgWarning) return;
    if (!this.canShowSvgPickerUI()) {
      this.svgWarning.style.display = "none";
      this.svgWarningBody.textContent = "";
      return;
    }
    const svgChanged = !!svgSig && this.lastSvgSig !== svgSig;
    this.currentSvgSig = svgSig;
    if (svgSig) {
      this.lastSvgSig = svgSig;
      this.writeStoredValue(UI_STORAGE_KEYS.lastSvgSig, svgSig);
    }
    const warningLang = resolveLanguage(this.settings?.ui?.language);
    const summary = report ? buildSanitizationSummary(report, warningLang) : null;
    if (this.svgWarningTitle) {
      this.svgWarningTitle.textContent = warningLang === "pt" ? "Aviso: SVG sanitizado" : "Warning: SVG sanitized";
    }
    if (this.svgWarningCloseBtn) {
      this.svgWarningCloseBtn.setAttribute(
        "aria-label",
        warningLang === "pt" ? "Fechar aviso" : "Close warning"
      );
    }
    this.lastSanitizationReport = summary ? report : null;
    this.lastSanitizationSig = summary ? svgSig : null;
    const alwaysShow = !!this.settings?.svgSettings?.alwaysShowWarning;
    let warningEnabled = !!this.settings?.warning?.show;
    const shouldResetOnSvgChange = !!summary && svgChanged;
    if (shouldResetOnSvgChange && !warningEnabled) {
      this.persistWarningShow(true);
      warningEnabled = true;
      if (this.settings?.warning) {
        this.settings.warning.show = true;
      }
    }
    const dismissedForThisSvg = !!svgSig && this.warningDismissedSig === svgSig && !svgChanged;
    const allowByToggle = warningEnabled || forceShow || shouldResetOnSvgChange;
    if (!summary || !allowByToggle || (!alwaysShow && dismissedForThisSvg && !forceShow && !shouldResetOnSvgChange)) {
      this.svgWarning.style.display = "none";
      this.svgWarningBody.textContent = "";
      return;
    }
    this.svgWarningBody.textContent = summary;
    this.svgWarning.style.display = "block";
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
          title: "Tip 3: Sanitization warnings",
          bullets: [
            "If unsafe content is removed, a warning appears.",
            "The visual shows a sanitized version of the SVG.",
            "The warning appears in the bottom-left corner.",
            "Use this to review and fix the source file.",
            "When you change the SVG, the warning reappears if needed."
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
        title: "Dica 3: Avisos de sanitizacao",
        bullets: [
          "Quando algo inseguro e removido, um aviso aparece.",
          "O visual mostra uma versao sanitizada do SVG.",
          "O aviso aparece no canto inferior esquerdo.",
          "Use isso para revisar e corrigir o arquivo original.",
          "Ao trocar o SVG, o aviso volta se houver limpeza."
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

  private updateLegend(dv?: DataView, hasSvg?: boolean) {
    const legend = this.settings.legend;
    if (this.settings.area.colorMode === "Gradient") {
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
      return;
    }

    if (!legend?.show || !dv || !hasSvg || this.dataMap.size === 0) {
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
      const legendKey = legendGroupKey(row.legendRawKey);
      if (!legendRowsByKey.has(legendKey)) legendRowsByKey.set(legendKey, []);
      legendRowsByKey.get(legendKey)?.push(row);
      if (!uniqueLegendRows.has(legendKey)) {
        uniqueLegendRows.set(legendKey, row);
      }
    }

    for (const row of uniqueLegendRows.values()) {
      const legendKey = legendGroupKey(row.legendRawKey);
      const rowsForLegend = legendRowsByKey.get(legendKey) || [row];
      const contextRow = rowsForLegend[0] || row;

      const item = document.createElement("div");
      item.setAttribute("data-sp-legend-group", legendKey);
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.setAttribute("aria-label", `Legenda: ${row.legendRawKey}`);
      Object.assign(item.style, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        minWidth: "0",
        cursor: "pointer",
        userSelect: "none"
      } as CSSStyleDeclaration);

      const swatchColor = inHighContrast && hcPalette ? hcPalette.foreground : row.fillColor || this.settings.area.matchedFill;
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
      label.textContent = row.legendRawKey;
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
    this.uploadBtn.style.display = allow ? "block" : "none";
    this.uploadCta.style.display = !hasSvgConfigured && allow ? "flex" : "none";
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

  private clearSvg() {
    if (this.fitRafId !== null) {
      cancelAnimationFrame(this.fitRafId);
      this.fitRafId = null;
    }
    if (this.svgRoot) {
      this.svgRoot.remove();
      this.svgRoot = null;
      this.zoomRoot = null;
    }
    if (this.svgHost) {
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
  }

  private resetToFit() {
    this.scale = this.fitTransform.scale;
    this.tx = this.fitTransform.tx;
    this.ty = this.fitTransform.ty;
    this.applyZoomTransform();
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

    const tx = padX + (fitW - bbox.width * scale) / 2 - bbox.x * scale;
    const ty = padY + (fitH - bbox.height * scale) / 2 - bbox.y * scale;
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
      this.resetToFit();
    });
  }

  private getThemeColorForKey(key: string): string | null {
    try {
      const palette = (this.host as any)?.colorPalette;
      if (!palette?.getColor) return null;
      const color = palette.getColor(key);
      const value = (color as any)?.value;
      return typeof value === "string" ? value : null;
    } catch {
      return null;
    }
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

  // ===== IVisual =====
  public update(options: VisualUpdateOptions) {
    const eventService = (this.host as any)?.eventService as IVisualEventService | undefined;
    eventService?.renderingStarted(options);

    let succeeded = false;
    try {
      const dv = options?.dataViews?.[0];
      this.formattingSettingsModel = dv
        ? this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, dv)
        : new VisualFormattingSettingsModel();
      this.settings = VisualSettings.parse(dv);
      this.buildDataMap(dv);
      this.formattingSettingsModel.area.applyAreaFormattingVisibility(
        this.settings.area.colorMode,
        this.settings.area.matchedFill
      );
      this.applyHighContrastHostStyles();

      const svgText = (this.settings.svgSettings.svgText || "").trim();
      const hasSvg = svgText.length > 0;

      this.setUploadUIVisibility(hasSvg);

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
        this.resetToFit();
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
          alwaysShowWarning: this.settings.svgSettings.alwaysShowWarning,
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

    if (options.objectName === "warning") {
      instances.push({
        objectName: "warning",
        selector: null as any,
        properties: {
          show: this.settings.warning.show
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
    row: Pick<CatRow, "value" | "themeColor" | "nativeFill">,
    matchedFill: string,
    stats: GradientStats,
    nativeFallbackFill?: string | null
  ): string {
    const mode = this.settings.area.colorMode === "Gradient" ? "Gradient" : "Solid";
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
    const regionCol = catCols.find((c) => c?.source?.roles?.category) || catCols[0];
    if (!regionCol) return;
    const colorByCol = catCols.find((c) => c?.source?.roles?.colorBy);
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
      const colorKeyRaw = colorByCol ? String(colorByCol.values[i] ?? "") : rawKey;
      const colorKey = colorKeyRaw || rawKey;
      const legendRaw = legendCol ? String(legendCol.values[i] ?? "") : rawKey;
      const legendRawKey = legendRaw || rawKey;
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

    this.clearSvg();
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

    this.svgHost.appendChild(svgNode);

    svgNode.querySelectorAll("title").forEach((t) => t.remove());

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
        const newScale = clamp(this.scale * zoomFactor, 0.35, 12);

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
      if (this.isRegionTarget(target)) return;
      if (this.selectionSource !== "self") return;
      this.clearSelection();
    });

    this.svgRoot.addEventListener("contextmenu", (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (this.isRegionTarget(target)) return;
      ev.preventDefault();
      this.hideTooltip();
      this.showContextMenuAt(null, ev.clientX, ev.clientY);
    });
  }

  private applyRegionsStyleAndEvents() {
    if (!this.zoomRoot) return;

    const cfg = this.settings.svgSettings;
    const inHighContrast = this.isHighContrastMode();
    const hcPalette = inHighContrast ? this.getHighContrastPalette() : null;

    const regionEls = Array.from(
      this.zoomRoot.querySelectorAll<SVGElement>("path[id], polygon[id], rect[id], circle[id], ellipse[id], g[id]")
    );

    for (const el of regionEls) {
      const id = (el as any).id as string;
      if (!id) continue;
      el.setAttribute("data-sp-region", "1");

      el.querySelectorAll("title").forEach((t) => t.remove());
      (el as any).removeAttribute?.("title");

      const key = norm(id);
      const row = this.dataMap.get(key);

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

      el.addEventListener("mouseenter", (ev: MouseEvent) => {
        if (!row) return;
        (el as any).style.filter = "brightness(0.88)";
        this.showTooltip(row, ev);
      });

      el.addEventListener("mousemove", (ev: MouseEvent) => {
        if (!row) return;
        this.positionTooltip(ev.clientX, ev.clientY);
      });

      el.addEventListener("mouseleave", () => {
        if (!row) return;
        (el as any).style.filter = "";
        this.hideTooltip();
      });

      el.addEventListener("contextmenu", (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
        this.hideTooltip();

        const x = ev.clientX;
        const y = ev.clientY;

        if (!row) {
          this.showContextMenuAt(null, x, y);
          return;
        }

        if (this.selectedKeys.has(row.key)) {
          this.showContextMenuAt(row.identity as any, x, y);
          return;
        }

        this.selectRow(row, false, () => this.showContextMenuAt(row.identity as any, x, y));
      });
      el.addEventListener("click", (ev: MouseEvent) => {
        if (ev.button !== 0) return;
        if (!row) return;

        const multi = ev.ctrlKey || ev.metaKey;
        this.selectRow(row, multi);
      });

      el.addEventListener("keydown", (ev: KeyboardEvent) => {
        if (!row) return;
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          const multi = ev.ctrlKey || ev.metaKey;
          this.selectRow(row, multi);
          return;
        }
        if (ev.key === "ContextMenu" || (ev.shiftKey && ev.key === "F10")) {
          ev.preventDefault();
          const rect = el.getBoundingClientRect();
          const x = Math.round(rect.left + rect.width / 2);
          const y = Math.round(rect.top + rect.height / 2);
          this.showContextMenuAt(row.identity as any, x, y);
        }
      });
    }

    if (cfg.labelShow) {
      for (const el of regionEls) {
        const id = (el as any).id as string;
        if (!id) continue;
        const row = this.dataMap.get(norm(id));
        if (!row) continue;

        const val = row.value;
        if (val === null || val === undefined || !isFinite(val as any)) {
          removeLabel(el);
          continue;
        }

        const text = Number.isFinite(val) ? Math.round(val).toString() : String(val);
        upsertLabel(el, text, row.fillColor || this.settings.area.matchedFill, cfg);
      }
    } else {
      regionEls.forEach(removeLabel);
    }
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

  private applyOutline(el: SVGElement) {
    const o = this.settings.outline;
    const inHighContrast = this.isHighContrastMode();
    const hcPalette = inHighContrast ? this.getHighContrastPalette() : null;
    if (!o.show) {
      if (inHighContrast && hcPalette) {
        el.setAttribute("stroke", hcPalette.foreground);
        el.setAttribute("stroke-width", "2");
        (el as any).style.stroke = hcPalette.foreground;
        (el as any).style.strokeWidth = "2";
        return;
      }
      el.removeAttribute("stroke");
      el.removeAttribute("stroke-width");
      (el as any).style.stroke = "";
      (el as any).style.strokeWidth = "";
      return;
    }
    const strokeColor = inHighContrast && hcPalette ? hcPalette.foreground : o.color;
    const strokeWidth = inHighContrast ? Math.max(2, Number(o.width) || 1) : Number(o.width) || 1;
    el.setAttribute("stroke", strokeColor);
    el.setAttribute("stroke-width", String(strokeWidth));
    (el as any).style.stroke = strokeColor;
    (el as any).style.strokeWidth = String(strokeWidth);
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

  private applySelectionVisualState() {
    if (!this.zoomRoot) return;

    const cfg = this.settings.svgSettings;
    const hasFocus = this.selectedKeys.size > 0;
    const inHighContrast = this.isHighContrastMode();
    const hcPalette = inHighContrast ? this.getHighContrastPalette() : null;

    const regionEls = Array.from(
      this.zoomRoot.querySelectorAll<SVGElement>("path[id], polygon[id], rect[id], circle[id], ellipse[id], g[id]")
    );

    for (const el of regionEls) {
      const id = (el as any).id as string;
      if (!id) continue;

      const key = norm(id);
      const row = this.dataMap.get(key);
      if (!row) continue;

      const isSelected = hasFocus ? this.selectedKeys.has(key) : false;
      if (inHighContrast && hcPalette) {
        const fill = hasFocus ? (isSelected ? hcPalette.foregroundSelected : hcPalette.background) : hcPalette.foreground;
        this.setRegionFill(el, fill);
        (el as any).style.opacity = "1";
        this.applyOutline(el);
        if (cfg.labelShow) {
          const lab = getLabel(el);
          if (lab) (lab as any).style.display = hasFocus ? (isSelected ? "" : "none") : "";
        }
        continue;
      }

      if (!hasFocus) {
        (el as any).style.opacity = "1";
        if (cfg.labelShow) {
          const lab = getLabel(el);
          if (lab) (lab as any).style.display = "";
        }
        continue;
      }

      (el as any).style.opacity = isSelected ? "1" : "0.18";

      if (cfg.labelShow) {
        const lab = getLabel(el);
        if (lab) (lab as any).style.display = isSelected ? "" : "none";
      }
    }

    if (this.legendHost) {
      const selectedLegendGroups = new Set<string>();
      for (const key of this.selectedKeys) {
        const row = this.dataMap.get(key);
        if (!row) continue;
        selectedLegendGroups.add(legendGroupKey(row.legendRawKey));
      }

      const legendItems = Array.from(this.legendHost.querySelectorAll<HTMLElement>("[data-sp-legend-group]"));
      for (const item of legendItems) {
        const groupKey = item.getAttribute("data-sp-legend-group") || "";
        const isSelected = hasFocus ? selectedLegendGroups.has(groupKey) : false;
        item.style.opacity = hasFocus ? (isSelected ? "1" : "0.35") : "1";
      }
    }
  }
}
