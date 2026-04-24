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

function normalizeAreaColorMode(mode: string | undefined | null): string {
  return mode === "Gradient" ? "Gradient" : "Solid";
}

export class AreaSettings {
  public colorMode: string = "Solid";
  public unmatchedFill: string = "#D3D3D3";
  public matchedFill: string = "#4CAF50";
  public gradientLowFill: string = "#FFF4B8";
  public gradientMidFill: string = "#B9DCFF";
  public gradientHighFill: string = "#1F5AA6";
}

export class SvgSettings {
  public svgText: string = "";
  public defaultFill: string = "#D3D3D3";
  public alwaysShowWarning: boolean = false;

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

export class LegendSettings {
  public show: boolean = false;
  public position: string = "Bottom";
  public title: string = "";
  public labelColor: string = "#111111";
  public fontSize: number = 12;
}

export class HelpSettings {
  public show: boolean = false;
}

export class WarningSettings {
  public show: boolean = true;
}

export class UiSettings {
  public language: string = "auto";
}

export class VisualSettings {
  public area: AreaSettings = new AreaSettings();
  public svgSettings: SvgSettings = new SvgSettings();
  public outline: OutlineSettings = new OutlineSettings();
  public legend: LegendSettings = new LegendSettings();
  public help: HelpSettings = new HelpSettings();
  public warning: WarningSettings = new WarningSettings();
  public ui: UiSettings = new UiSettings();

  public static parse(dataView?: DataView): VisualSettings {
    const s = new VisualSettings();
    const objects = (dataView?.metadata?.objects as unknown) ?? undefined;

    // Area
    s.area.colorMode = normalizeAreaColorMode(getString(objects, ["area", "colorMode"], s.area.colorMode));
    s.area.unmatchedFill = getFill(objects, "area", "unmatchedFill", s.area.unmatchedFill);
    s.area.matchedFill   = getFill(objects, "area", "matchedFill",   s.area.matchedFill);
    s.area.gradientLowFill = getFill(objects, "area", "gradientLowFill", s.area.gradientLowFill);
    s.area.gradientMidFill = getFill(objects, "area", "gradientMidFill", s.area.gradientMidFill);
    s.area.gradientHighFill = getFill(objects, "area", "gradientHighFill", s.area.gradientHighFill);

    // SVG
    s.svgSettings.svgText = getString(objects, ["svgSettings", "svgText"], s.svgSettings.svgText);
    s.svgSettings.defaultFill = getFill(objects, "svgSettings", "defaultFill", s.svgSettings.defaultFill);
    s.svgSettings.alwaysShowWarning = getBool(
      objects,
      ["svgSettings", "alwaysShowWarning"],
      s.svgSettings.alwaysShowWarning
    );

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

    // Legend
    s.legend.show = getBool(objects, ["legend", "show"], s.legend.show);
    s.legend.position = getString(objects, ["legend", "position"], s.legend.position);
    s.legend.title = getString(objects, ["legend", "title"], s.legend.title);
    s.legend.labelColor = getFill(objects, "legend", "labelColor", s.legend.labelColor);
    s.legend.fontSize = getNumber(objects, ["legend", "fontSize"], s.legend.fontSize);

    // Help
    s.help.show = getBool(objects, ["help", "show"], s.help.show);

    // Warning
    s.warning.show = getBool(objects, ["warning", "show"], s.warning.show);

    // UI
    s.ui.language = getString(objects, ["ui", "language"], s.ui.language);

    return s;
  }
}

class ObjectBoundColorPicker extends formattingSettings.ColorPicker {
  constructor(
    object: ConstructorParameters<typeof formattingSettings.ColorPicker>[0] & { objectNameOverride: string }
  ) {
    super(object);
    Object.assign(this, object);
  }

  public objectNameOverride!: string;

  public getFormattingComponent(
    objectName: string,
    localizationManager?: powerbi.extensibility.ILocalizationManager
  ): powerbi.visuals.SimpleComponentBase<powerbi.ThemeColorData> {
    void localizationManager;
    return super.getFormattingComponent(this.objectNameOverride || objectName);
  }

  public getRevertToDefaultDescriptor(objectName: string): powerbi.visuals.FormattingDescriptor[] {
    return super.getRevertToDefaultDescriptor(this.objectNameOverride || objectName);
  }

  public setPropertiesValues(dataViewObjects: powerbi.DataViewObjects, objectName: string): void {
    super.setPropertiesValues(dataViewObjects, this.objectNameOverride || objectName);
  }
}

export class AreaFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "area";
  public displayName: string = "Cores das areas";

  public colorMode = new formattingSettings.ItemDropdown({
    name: "colorMode",
    displayName: "Modo de cor",
    items: [
      { value: "Solid", displayName: "Cor simples" },
      { value: "Gradient", displayName: "Gradiente" }
    ],
    value: { value: "Solid", displayName: "Cor simples" }
  });

  public unmatchedFill = new formattingSettings.ColorPicker({
    name: "unmatchedFill",
    displayName: "Cor sem correspondencia",
    value: { value: "#D3D3D3" }
  });

  public matchedFill = new ObjectBoundColorPicker({
    name: "fill",
    displayName: "Cor das areas",
    value: { value: "#4CAF50" },
    objectNameOverride: "nativeAreaColors",
    selector: { data: [{ roles: ["category"] }] } as powerbi.data.Selector,
    altConstantSelector: null as any,
    instanceKind: powerbi.VisualEnumerationInstanceKinds.ConstantOrRule
  });

  public gradientLowFill = new formattingSettings.ColorPicker({
    name: "gradientLowFill",
    displayName: "Valor baixo",
    value: { value: "#FFF4B8" }
  });

  public gradientMidFill = new formattingSettings.ColorPicker({
    name: "gradientMidFill",
    displayName: "Valor medio",
    value: { value: "#B9DCFF" }
  });

  public gradientHighFill = new formattingSettings.ColorPicker({
    name: "gradientHighFill",
    displayName: "Valor alto",
    value: { value: "#1F5AA6" }
  });

  public slices = [
    this.colorMode,
    this.unmatchedFill,
    this.matchedFill,
    this.gradientLowFill,
    this.gradientMidFill,
    this.gradientHighFill
  ];

  public applyAreaFormattingVisibility(colorMode: string, nativeFallbackFill: string) {
    const mode = normalizeAreaColorMode(colorMode);
    const currentSimpleFill = this.matchedFill.value?.value || nativeFallbackFill;
    this.colorMode.visible = true;
    this.unmatchedFill.visible = true;
    this.matchedFill.visible = mode === "Solid";
    this.gradientLowFill.visible = mode === "Gradient";
    this.gradientMidFill.visible = mode === "Gradient";
    this.gradientHighFill.visible = mode === "Gradient";
    this.matchedFill.value = { value: currentSimpleFill };
    this.colorMode.value =
      mode === "Gradient"
        ? { value: "Gradient", displayName: "Gradiente" }
        : { value: "Solid", displayName: "Cor simples" };
  }
}

export class SvgFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "svgSettings";
  public displayName: string = "SVG e rotulos";

  public svgText = new formattingSettings.TextArea({
    name: "svgText",
    displayName: "Conteudo SVG (texto/data URI)",
    description: "Cole o SVG em texto ou data URI (ex.: data:image/svg+xml;utf8,...)",
    placeholder: "Cole o texto do SVG ou uma data URI",
    value: ""
  });

  public defaultFill = new formattingSettings.ColorPicker({
    name: "defaultFill",
    displayName: "Cor padrao (legado)",
    value: { value: "#D3D3D3" }
  });

  public alwaysShowWarning = new formattingSettings.ToggleSwitch({
    name: "alwaysShowWarning",
    displayName: "Sempre mostrar aviso de sanitizacao",
    value: false
  });

  public labelShow = new formattingSettings.ToggleSwitch({
    name: "labelShow",
    displayName: "Mostrar rotulos (valor)",
    value: true
  });

  public labelMin = new formattingSettings.NumUpDown({
    name: "labelMin",
    displayName: "Tamanho minimo (px)",
    value: 9
  });

  public labelMax = new formattingSettings.NumUpDown({
    name: "labelMax",
    displayName: "Tamanho maximo (px)",
    value: 26
  });

  public labelBold = new formattingSettings.ToggleSwitch({
    name: "labelBold",
    displayName: "Negrito",
    value: true
  });

  public labelOutlineFactor = new formattingSettings.NumUpDown({
    name: "labelOutlineFactor",
    displayName: "Contorno (% do tamanho)",
    value: 0.12
  });

  public slices = [
    this.svgText,
    this.defaultFill,
    this.alwaysShowWarning,
    this.labelShow,
    this.labelMin,
    this.labelMax,
    this.labelBold,
    this.labelOutlineFactor
  ];
}

export class OutlineFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "outline";
  public displayName: string = "Contorno";

  public show = new formattingSettings.ToggleSwitch({
    name: "show",
    displayName: "Mostrar",
    value: false
  });

  public color = new formattingSettings.ColorPicker({
    name: "color",
    displayName: "Cor",
    value: { value: "#000000" }
  });

  public width = new formattingSettings.NumUpDown({
    name: "width",
    displayName: "Espessura (px)",
    value: 1
  });

  public slices = [this.show, this.color, this.width];
}

export class LegendFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "legend";
  public displayName: string = "Legenda";

  public show = new formattingSettings.ToggleSwitch({
    name: "show",
    displayName: "Mostrar",
    value: false
  });

  public position = new formattingSettings.ItemDropdown({
    name: "position",
    displayName: "Posicao",
    items: [
      { value: "Top", displayName: "Superior" },
      { value: "Bottom", displayName: "Inferior" },
      { value: "Left", displayName: "Esquerda" },
      { value: "Right", displayName: "Direita" }
    ],
    value: { value: "Bottom", displayName: "Inferior" }
  });

  public title = new formattingSettings.TextInput({
    name: "title",
    displayName: "Titulo",
    placeholder: "Legenda",
    value: ""
  });

  public labelColor = new formattingSettings.ColorPicker({
    name: "labelColor",
    displayName: "Cor do texto",
    value: { value: "#111111" }
  });

  public fontSize = new formattingSettings.NumUpDown({
    name: "fontSize",
    displayName: "Tamanho do texto (px)",
    value: 12
  });

  public slices = [this.show, this.position, this.title, this.labelColor, this.fontSize];
}

export class HelpFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "help";
  public displayName: string = "Ajuda";

  public show = new formattingSettings.ToggleSwitch({
    name: "show",
    displayName: "Mostrar dicas",
    value: false
  });

  public slices = [this.show];
}

export class WarningFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "warning";
  public displayName: string = "Avisos";

  public show = new formattingSettings.ToggleSwitch({
    name: "show",
    displayName: "Mostrar avisos de sanitizacao",
    value: true
  });

  public slices = [this.show];
}

export class UiFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "ui";
  public displayName: string = "Interface";

  public language = new formattingSettings.ItemDropdown({
    name: "language",
    displayName: "Idioma",
    items: [
      { value: "auto", displayName: "Auto (sistema)" },
      { value: "pt", displayName: "Português" },
      { value: "en", displayName: "English" }
    ],
    value: { value: "auto", displayName: "Auto (sistema)" }
  });

  public slices = [this.language];
}

export class VisualFormattingSettingsModel extends formattingSettings.Model {
  public area = new AreaFormattingCard();
  public svgSettings = new SvgFormattingCard();
  public outline = new OutlineFormattingCard();
  public legend = new LegendFormattingCard();
  public help = new HelpFormattingCard();
  public warning = new WarningFormattingCard();
  public ui = new UiFormattingCard();

  public cards = [this.area, this.svgSettings, this.outline, this.legend, this.help, this.warning, this.ui];
}
