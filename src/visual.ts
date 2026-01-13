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

import VisualObjectInstance = powerbi.VisualObjectInstance;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;

import powerbiVisualsApi from "powerbi-visuals-api";
import VisualEnumerationInstanceKinds = powerbiVisualsApi.VisualEnumerationInstanceKinds;

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

type ValueField = { label: string; value: any };
type SelectionSource = "none" | "self" | "external";
type CatRow = {
  key: string;
  rawKey: string;
  value: number | null;
  fields: ValueField[];
  identity: ISelectionId;
  idx: number;
  matchedColor: string; // já com formatação condicional aplicada (se houver)
};

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
function upsertLabel(el: SVGElement, text: string, fillColorForContrast: string, cfg: SvgSettings) {
  const bbox = (el as any).getBBox ? (el as any).getBBox() : { x: 0, y: 0, width: 0, height: 0 };
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;

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
  const rawSize = 0.5 * (bbox?.height ?? 20);
  const fontSize = Math.max(min, Math.min(rawSize, max));

  t.setAttribute("x", String(cx));
  t.setAttribute("y", String(cy));
  t.setAttribute("font-size", String(fontSize));
  t.setAttribute("font-weight", cfg.labelBold ? "700" : "400");

  const c = bestTextColor(fillColorForContrast);
  t.setAttribute("fill", c.text);
  const factor = Math.max(0, Number(cfg.labelOutlineFactor) || 0.12);
  t.setAttribute("stroke", c.outline);
  t.setAttribute("stroke-width", String(Math.max(0, Math.round(fontSize * factor))));
  t.setAttribute("paint-order", "stroke");
  t.textContent = text;

  (t as any).style.display = "";
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

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function getFillColorFromObjects(objects: any, objectName: string, prop: string, fallback: string): string {
  try {
    const v = objects?.[objectName]?.[prop];
    if (!v) return fallback;
    if (typeof v === "string") return v;
    if (v?.solid?.color) return v.solid.color;
    if (v?.color) return v.color;
    return fallback;
  } catch {
    return fallback;
  }
}

export class Visual implements IVisual {
  private host: any;
  private container: HTMLElement;

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

  // tooltip
  private tooltipEl!: HTMLDivElement;
  private tooltipVisible = false;

  // upload controls
  private uploadCta!: HTMLDivElement;
  private fileInput!: HTMLInputElement;
  private uploadBtn!: HTMLButtonElement;

  // legend
  private contentHost!: HTMLDivElement;
  private svgHost!: HTMLDivElement;
  private legendHost!: HTMLDivElement;

  // host env
  private hostEnv: number | undefined;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host as any;
    this.container = options.element;

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

  // --- regra: permitir upload SOMENTE no Power BI Desktop ---
  private canShowSvgPickerUI(): boolean {
    const env = this.hostEnv ?? (this.host as any)?.hostEnv;
    if (env === undefined || env === null) return true; // dev/preview

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
      this.uploadBtn.style.opacity = "1";
      this.uploadBtn.style.transform = "translateY(-1px)";
    });
    this.uploadBtn.addEventListener("mouseleave", () => {
      this.uploadBtn.style.opacity = "0.2";
      this.uploadBtn.style.transform = "translateY(0)";
    });
    this.uploadBtn.addEventListener("click", () => {
      if (!this.canShowSvgPickerUI()) return;
      this.fileInput.click();
    });

    this.container.appendChild(this.uploadBtn);
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

    for (const row of this.dataMap.values()) {
      const item = document.createElement("div");
      item.setAttribute("data-sp-legend-key", row.key);
      Object.assign(item.style, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        minWidth: "0",
        cursor: "pointer",
        userSelect: "none"
      } as CSSStyleDeclaration);

      const swatch = document.createElement("span");
      Object.assign(swatch.style, {
        width: "10px",
        height: "10px",
        borderRadius: "2px",
        flex: "0 0 auto",
        background: row.matchedColor || this.settings.area.matchedFill
      } as CSSStyleDeclaration);

      const label = document.createElement("span");
      label.textContent = row.rawKey;
      Object.assign(label.style, {
        fontSize: `${fontSize}px`,
        color: labelColor,
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
        this.selectRow(row, multi);
      });

      item.addEventListener("contextmenu", (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
        const x = ev.clientX;
        const y = ev.clientY;
        if (this.selectedKeys.has(row.key)) {
          this.showContextMenuAt(row.identity as any, x, y);
          return;
        }
        this.selectRow(row, false, () => this.showContextMenuAt(row.identity as any, x, y));
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
    if (this.svgRoot) {
      this.svgRoot.remove();
      this.svgRoot = null;
      this.zoomRoot = null;
    }
    if (this.svgHost) {
      this.svgHost.querySelectorAll("svg").forEach((el) => el.remove());
    }
    this.container.querySelectorAll(".sp-no-svg-msg").forEach((e) => e.remove());
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

      const svgText = (this.settings.svgSettings.svgText || "").trim();
      const hasSvg = svgText.length > 0;

      this.setUploadUIVisibility(hasSvg);

      if (!hasSvg) {
        if (this.canShowSvgPickerUI()) {
          this.clearSvg();
        } else {
          this.showNoSvgMessageOutsideDesktop();
        }
      } else {
        this.render(svgText, dv);
      }

      this.updateLegend(dv, hasSvg);

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
          unmatchedFill: { solid: { color: this.settings.area.unmatchedFill } },
          matchedFill: { solid: { color: this.settings.area.matchedFill } }
        },
        propertyInstanceKind: {
          matchedFill: VisualEnumerationInstanceKinds.ConstantOrRule
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

    return instances;
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.formattingSettingsModel);
  }

  // ===== data parse =====
  private buildDataMap(dv?: DataView) {
    this.dataMap.clear();
    this.highlightedKeys.clear();
    this.hasHighlights = false;
    const cat = dv?.categorical as DataViewCategorical | undefined;
    const catCol = cat?.categories?.[0];
    if (!catCol) return;

    const values = cat?.values;
    const valueCols = values ? Array.from(values) : [];

    const measureCol = valueCols.find((vc) => vc?.source?.roles?.measure) || valueCols[0];
    const tooltipCols = valueCols.filter((vc) => vc?.source?.roles?.tooltips);
    const highlightVals = measureCol?.highlights;
    this.hasHighlights = Array.isArray(highlightVals);

    for (let i = 0; i < catCol.values.length; i++) {
      const rawKey = String(catCol.values[i] ?? "");
      const key = norm(rawKey);

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
          identity = builder.withCategory(catCol as any, i).createSelectionId();
        }
      } catch {
        identity = {} as any;
      }

      const objForRow = (catCol.objects && (catCol.objects as any[])[i]) ? (catCol.objects as any[])[i] : null;
      const matchedColor = getFillColorFromObjects(objForRow, "area", "matchedFill", this.settings.area.matchedFill);

      if (this.hasHighlights && highlightVal !== null && highlightVal !== undefined) {
        this.highlightedKeys.add(key);
      }

      this.dataMap.set(key, {
        key,
        rawKey,
        value: isFinite(measureValNum as any) ? (measureValNum as number) : null,
        fields,
        identity,
        idx: i,
        matchedColor
      });
    }
  }

  // ===== render =====
  private render(svgTextRaw: string, dv?: DataView) {
    this.buildDataMap(dv);

    const svgText = decodeSvgDataUri(svgTextRaw);

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");

    const parsed = doc.querySelector<SVGSVGElement>("svg");

    if (!parsed) {
      if (this.canShowSvgPickerUI()) {
        this.clearSvg();
        return;
      }
      this.showNoSvgMessageOutsideDesktop();
      return;
    }

    this.clearSvg();

    const svgNode = document.importNode(parsed, true) as SVGSVGElement;

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
      const wAttr = svgNode.getAttribute("width");
      const hAttr = svgNode.getAttribute("height");
      const w = wAttr ? Number(String(wAttr).replace(/[^\d.]/g, "")) : NaN;
      const h = hAttr ? Number(String(hAttr).replace(/[^\d.]/g, "")) : NaN;
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

    this.computeFitTransform();
    this.resetToFit();

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

      if (row) this.setRegionFill(el, row.matchedColor || this.settings.area.matchedFill);
      else this.setRegionFill(el, this.settings.area.unmatchedFill);

      this.applyOutline(el);

      (el as any).style.cursor = row ? "pointer" : "default";

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
        upsertLabel(el, text, row.matchedColor || this.settings.area.matchedFill, cfg);
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
    if (!o.show) {
      el.removeAttribute("stroke");
      el.removeAttribute("stroke-width");
      (el as any).style.stroke = "";
      (el as any).style.strokeWidth = "";
      return;
    }
    el.setAttribute("stroke", o.color);
    el.setAttribute("stroke-width", String(o.width));
    (el as any).style.stroke = o.color;
    (el as any).style.strokeWidth = String(o.width);
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
      const legendItems = Array.from(this.legendHost.querySelectorAll<HTMLElement>("[data-sp-legend-key]"));
      for (const item of legendItems) {
        const key = item.getAttribute("data-sp-legend-key") || "";
        const isSelected = hasFocus ? this.selectedKeys.has(key) : false;
        item.style.opacity = hasFocus ? (isSelected ? "1" : "0.35") : "1";
      }
    }
  }
}
