// src/settings.ts
"use strict";

import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import DataView = powerbi.DataView;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function getPath(root: unknown, path: string[]): unknown {
  let cur: unknown = root;
  for (const p of path) {
    if (!isObj(cur) || !(p in cur)) return undefined;
    cur = (cur as Obj)[p];
  }
  return cur;
}

function getString(root: unknown, path: string[], def: string): string {
  const v = getPath(root, path);
  return typeof v === "string" ? v : def;
}

function getNumber(root: unknown, path: string[], def: number): number {
  const v = getPath(root, path);
  return typeof v === "number" && isFinite(v) ? v : def;
}

function getBool(root: unknown, path: string[], def: boolean): boolean {
  const v = getPath(root, path);
  return typeof v === "boolean" ? v : def;
}

function getFill(root: unknown, objectName: string, prop: string, def: string): string {
  const v1 = getPath(root, [objectName, prop, "solid", "color"]);
  if (typeof v1 === "string") return v1;

  const v2 = getPath(root, [objectName, prop]);
  if (typeof v2 === "string") return v2;

  return def;
}

export class AreaSettings {
  public unmatchedFill: string = "#D3D3D3";
  public matchedFill: string = "#4CAF50";
}

export class SvgSettings {
  public svgText: string = "";
  public defaultFill: string = "#D3D3D3";

  public labelShow: boolean = true;
  public labelMin: number = 9;     // px
  public labelMax: number = 26;    // px
  public labelBold: boolean = true;

  /** fator do contorno em relação ao tamanho da fonte (ex.: 0.12 = 12%) */
  public labelOutlineFactor: number = 0.12;
}

export class OutlineSettings {
  public show: boolean = false;
  public color: string = "#000000";
  public width: number = 1;
}

export class VisualSettings {
  public area: AreaSettings = new AreaSettings();
  public svgSettings: SvgSettings = new SvgSettings();
  public outline: OutlineSettings = new OutlineSettings();

  public static parse(dataView?: DataView): VisualSettings {
    const s = new VisualSettings();
    const objects = (dataView?.metadata?.objects as unknown) ?? undefined;

    // Area
    s.area.unmatchedFill = getFill(objects, "area", "unmatchedFill", s.area.unmatchedFill);
    s.area.matchedFill   = getFill(objects, "area", "matchedFill",   s.area.matchedFill);

    // SVG
    s.svgSettings.svgText = getString(objects, ["svgSettings", "svgText"], s.svgSettings.svgText);
    s.svgSettings.defaultFill = getFill(objects, "svgSettings", "defaultFill", s.svgSettings.defaultFill);

    s.svgSettings.labelShow = getBool(objects, ["svgSettings", "labelShow"], s.svgSettings.labelShow);
    s.svgSettings.labelMin  = getNumber(objects, ["svgSettings", "labelMin"], s.svgSettings.labelMin);
    s.svgSettings.labelMax  = getNumber(objects, ["svgSettings", "labelMax"], s.svgSettings.labelMax);
    s.svgSettings.labelBold = getBool(objects, ["svgSettings", "labelBold"], s.svgSettings.labelBold);
    s.svgSettings.labelOutlineFactor = getNumber(
      objects,
      ["svgSettings", "labelOutlineFactor"],
      s.svgSettings.labelOutlineFactor
    );

    // Outline
    s.outline.show  = getBool(objects, ["outline", "show"], s.outline.show);
    s.outline.color = getFill(objects, "outline", "color", s.outline.color);
    s.outline.width = getNumber(objects, ["outline", "width"], s.outline.width);

    return s;
  }
}

export class AreaFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "area";
  public displayName: string = "Area";

  public unmatchedFill = new formattingSettings.ColorPicker({
    name: "unmatchedFill",
    displayName: "Unmatched fill",
    value: { value: "#D3D3D3" }
  });

  public matchedFill = new formattingSettings.ColorPicker({
    name: "matchedFill",
    displayName: "Matched fill",
    value: { value: "#4CAF50" },
    instanceKind: powerbi.VisualEnumerationInstanceKinds.ConstantOrRule
  });

  public slices = [this.unmatchedFill, this.matchedFill];
}

export class SvgFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "svgSettings";
  public displayName: string = "SVG";

  public svgText = new formattingSettings.TextArea({
    name: "svgText",
    displayName: "SVG text",
    placeholder: "Paste SVG text or data URI",
    value: ""
  });

  public defaultFill = new formattingSettings.ColorPicker({
    name: "defaultFill",
    displayName: "Default fill",
    value: { value: "#D3D3D3" }
  });

  public labelShow = new formattingSettings.ToggleSwitch({
    name: "labelShow",
    displayName: "Show labels",
    value: true
  });

  public labelMin = new formattingSettings.NumUpDown({
    name: "labelMin",
    displayName: "Label min size (px)",
    value: 9
  });

  public labelMax = new formattingSettings.NumUpDown({
    name: "labelMax",
    displayName: "Label max size (px)",
    value: 26
  });

  public labelBold = new formattingSettings.ToggleSwitch({
    name: "labelBold",
    displayName: "Bold labels",
    value: true
  });

  public labelOutlineFactor = new formattingSettings.NumUpDown({
    name: "labelOutlineFactor",
    displayName: "Outline factor",
    value: 0.12
  });

  public slices = [
    this.svgText,
    this.defaultFill,
    this.labelShow,
    this.labelMin,
    this.labelMax,
    this.labelBold,
    this.labelOutlineFactor
  ];
}

export class OutlineFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "outline";
  public displayName: string = "Outline";

  public show = new formattingSettings.ToggleSwitch({
    name: "show",
    displayName: "Show",
    value: false
  });

  public color = new formattingSettings.ColorPicker({
    name: "color",
    displayName: "Color",
    value: { value: "#000000" }
  });

  public width = new formattingSettings.NumUpDown({
    name: "width",
    displayName: "Width (px)",
    value: 1
  });

  public slices = [this.show, this.color, this.width];
}

export class VisualFormattingSettingsModel extends formattingSettings.Model {
  public area = new AreaFormattingCard();
  public svgSettings = new SvgFormattingCard();
  public outline = new OutlineFormattingCard();

  public cards = [this.area, this.svgSettings, this.outline];
}
