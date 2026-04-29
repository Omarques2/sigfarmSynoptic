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
  if (mode === "Gradient") return "Gradient";
  if (mode === "Solid") return "Solid";
  if (mode === "Theme" || mode === "ThemeOrMatched" || mode === "ThemePalette" || mode === "PowerBITheme") {
    return "Theme";
  }
  return "Theme";
}

function normalizeLabelMode(mode: string | undefined | null): string {
  return mode === "OutsideCallout" ? "OutsideCallout" : "Inside";
}

function normalizeLabelContent(mode: string | undefined | null): string {
  return mode === "Category" || mode === "CategoryAndValue" ? mode : "Value";
}

function normalizeCalloutSideMode(mode: string | undefined | null): string {
  const allowed = new Set([
    "Right",
    "Left",
    "Top",
    "Bottom",
    "HorizontalNearest",
    "VerticalNearest",
    "Nearest",
    "CustomSides"
  ]);
  return mode && allowed.has(mode) ? mode : "Right";
}

function normalizeCalloutRouteStyle(mode: string | undefined | null): string {
  return mode === "Straight" ? "Straight" : "Curved";
}

function normalizeCalloutTextAlign(mode: string | undefined | null): string {
  return mode === "Center" || mode === "Right" ? mode : "Left";
}

function normalizeDrillNoDataBehavior(mode: string | undefined | null): string {
  return mode === "Hide" ? "Hide" : "Fade";
}

function normalizeDrillRenderScopeMode(mode: string | undefined | null): string {
  return mode === "AllMapAreas" ? "AllMapAreas" : "DrillDataOnly";
}

function normalizeLabelScaleMode(mode: string | undefined | null): string {
  return mode === "ScaleWithMap" ? "ScaleWithMap" : "FixedScreenSize";
}

function normalizeLabelDenseMode(mode: string | undefined | null): string {
  const allowed = new Set(["All", "DataOnly", "SelectedOnly", "Hidden"]);
  return mode && allowed.has(mode) ? mode : "DataOnly";
}

export class AreaSettings {
  public colorMode: string = "Theme";
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
  public labelScaleMode: string = "FixedScreenSize";
  public labelMinScreenPx: number = 8;
  public labelMaxScreenPx: number = 22;
  public labelHideBelowAreaPx: number = 0;
  public labelDenseMode: string = "DataOnly";
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

export class InteractionSettings {
  public autoFocusSelectedArea: boolean = true;
  public focusExternalSelection: boolean = false;
  public focusPadding: number = 12;
  public focusAnimationMs: number = 260;
  public unselectedOpacity: number = 0.18;
  public labelUnselectedOpacity: number = 0.35;
}

export class LabelsSettings {
  public labelMode: string = "Inside";
  public labelContent: string = "Value";
  public calloutTextAlign: string = "Left";
  public calloutDistance: number = 36;
  public calloutLineColor: string = "#333333";
  public calloutTextColor: string = "#222222";
  public calloutLineWidth: number = 1;
  public calloutMinGap: number = 18;
  public calloutSideMode: string = "Right";
  public calloutRouteStyle: string = "Curved";
  public calloutCurveSize: number = 22;
  public calloutAllowRight: boolean = true;
  public calloutAllowLeft: boolean = true;
  public calloutAllowTop: boolean = false;
  public calloutAllowBottom: boolean = false;
}

export class MapRegistrySettings {
  public manifestJson: string = "";
}

export class EditorSettings {
  public enabled: boolean = true;
  public showEditorButton: boolean = true;
  public showManifestEditor: boolean = true;
}

export class DrillMapsSettings {
  public enabled: boolean = true;
  public fallbackToDefaultMap: boolean = true;
  public noDataBehavior: string = "Fade";
  public focusDataAreas: boolean = true;
  public preFocusSourceOnDrill: boolean = true;
  public normalizeDrillFocus: boolean = true;
  public drillRenderScopeMode: string = "DrillDataOnly";
  public drillMinFocusScale: number = 2.5;
  public drillFocusPaddingPct: number = 10;
  public drillTargetAreaScreenPx: number = 28;
  public drillAreaScalePercentile: number = 35;
  public drillMaxFocusScale: number = 24;
}

export class LabelOverridesSettings {
  public overridesJson: string = "";
}

export class PerformanceSettings {
  public denseModeEnabled: boolean = true;
  public denseAreaThreshold: number = 1000;
}

export class VisualSettings {
  public area: AreaSettings = new AreaSettings();
  public svgSettings: SvgSettings = new SvgSettings();
  public outline: OutlineSettings = new OutlineSettings();
  public legend: LegendSettings = new LegendSettings();
  public help: HelpSettings = new HelpSettings();
  public warning: WarningSettings = new WarningSettings();
  public ui: UiSettings = new UiSettings();
  public interaction: InteractionSettings = new InteractionSettings();
  public labels: LabelsSettings = new LabelsSettings();
  public mapRegistry: MapRegistrySettings = new MapRegistrySettings();
  public editor: EditorSettings = new EditorSettings();
  public drillMaps: DrillMapsSettings = new DrillMapsSettings();
  public labelOverrides: LabelOverridesSettings = new LabelOverridesSettings();
  public performance: PerformanceSettings = new PerformanceSettings();

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
    s.svgSettings.labelScaleMode = normalizeLabelScaleMode(
      getString(objects, ["svgSettings", "labelScaleMode"], s.svgSettings.labelScaleMode)
    );
    s.svgSettings.labelMinScreenPx = getNumber(
      objects,
      ["svgSettings", "labelMinScreenPx"],
      s.svgSettings.labelMinScreenPx
    );
    s.svgSettings.labelMaxScreenPx = getNumber(
      objects,
      ["svgSettings", "labelMaxScreenPx"],
      s.svgSettings.labelMaxScreenPx
    );
    s.svgSettings.labelHideBelowAreaPx = getNumber(
      objects,
      ["svgSettings", "labelHideBelowAreaPx"],
      s.svgSettings.labelHideBelowAreaPx
    );
    s.svgSettings.labelDenseMode = normalizeLabelDenseMode(
      getString(objects, ["svgSettings", "labelDenseMode"], s.svgSettings.labelDenseMode)
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

    // Interaction
    s.interaction.autoFocusSelectedArea = getBool(
      objects,
      ["interaction", "autoFocusSelectedArea"],
      s.interaction.autoFocusSelectedArea
    );
    s.interaction.focusExternalSelection = getBool(
      objects,
      ["interaction", "focusExternalSelection"],
      s.interaction.focusExternalSelection
    );
    s.interaction.focusPadding = getNumber(objects, ["interaction", "focusPadding"], s.interaction.focusPadding);
    s.interaction.focusAnimationMs = getNumber(
      objects,
      ["interaction", "focusAnimationMs"],
      s.interaction.focusAnimationMs
    );
    s.interaction.unselectedOpacity = getNumber(
      objects,
      ["interaction", "unselectedOpacity"],
      s.interaction.unselectedOpacity
    );
    s.interaction.labelUnselectedOpacity = getNumber(
      objects,
      ["interaction", "labelUnselectedOpacity"],
      s.interaction.labelUnselectedOpacity
    );

    // Labels
    s.labels.labelMode = normalizeLabelMode(getString(objects, ["labels", "labelMode"], s.labels.labelMode));
    s.labels.labelContent = normalizeLabelContent(
      getString(objects, ["labels", "labelContent"], s.labels.labelContent)
    );
    s.labels.calloutTextAlign = normalizeCalloutTextAlign(
      getString(objects, ["labels", "calloutTextAlign"], s.labels.calloutTextAlign)
    );
    s.labels.calloutDistance = getNumber(objects, ["labels", "calloutDistance"], s.labels.calloutDistance);
    s.labels.calloutLineColor = getFill(objects, "labels", "calloutLineColor", s.labels.calloutLineColor);
    s.labels.calloutTextColor = getFill(objects, "labels", "calloutTextColor", s.labels.calloutTextColor);
    s.labels.calloutLineWidth = getNumber(objects, ["labels", "calloutLineWidth"], s.labels.calloutLineWidth);
    s.labels.calloutMinGap = getNumber(objects, ["labels", "calloutMinGap"], s.labels.calloutMinGap);
    s.labels.calloutSideMode = normalizeCalloutSideMode(
      getString(objects, ["labels", "calloutSideMode"], s.labels.calloutSideMode)
    );
    s.labels.calloutRouteStyle = normalizeCalloutRouteStyle(
      getString(objects, ["labels", "calloutRouteStyle"], s.labels.calloutRouteStyle)
    );
    s.labels.calloutCurveSize = getNumber(objects, ["labels", "calloutCurveSize"], s.labels.calloutCurveSize);
    s.labels.calloutAllowRight = getBool(objects, ["labels", "calloutAllowRight"], s.labels.calloutAllowRight);
    s.labels.calloutAllowLeft = getBool(objects, ["labels", "calloutAllowLeft"], s.labels.calloutAllowLeft);
    s.labels.calloutAllowTop = getBool(objects, ["labels", "calloutAllowTop"], s.labels.calloutAllowTop);
    s.labels.calloutAllowBottom = getBool(objects, ["labels", "calloutAllowBottom"], s.labels.calloutAllowBottom);

    // Map registry/editor/drill/label overrides
    s.mapRegistry.manifestJson = getString(objects, ["mapRegistry", "manifestJson"], s.mapRegistry.manifestJson);
    s.editor.enabled = getBool(objects, ["editor", "enabled"], s.editor.enabled);
    s.editor.showEditorButton = getBool(objects, ["editor", "showEditorButton"], s.editor.showEditorButton);
    s.editor.showManifestEditor = getBool(objects, ["editor", "showManifestEditor"], s.editor.showManifestEditor);
    s.drillMaps.enabled = getBool(objects, ["drillMaps", "enabled"], s.drillMaps.enabled);
    s.drillMaps.fallbackToDefaultMap = getBool(
      objects,
      ["drillMaps", "fallbackToDefaultMap"],
      s.drillMaps.fallbackToDefaultMap
    );
    s.drillMaps.noDataBehavior = normalizeDrillNoDataBehavior(
      getString(objects, ["drillMaps", "noDataBehavior"], s.drillMaps.noDataBehavior)
    );
    s.drillMaps.focusDataAreas = getBool(
      objects,
      ["drillMaps", "focusDataAreas"],
      s.drillMaps.focusDataAreas
    );
    s.drillMaps.preFocusSourceOnDrill = getBool(
      objects,
      ["drillMaps", "preFocusSourceOnDrill"],
      s.drillMaps.preFocusSourceOnDrill
    );
    s.drillMaps.normalizeDrillFocus = getBool(
      objects,
      ["drillMaps", "normalizeDrillFocus"],
      s.drillMaps.normalizeDrillFocus
    );
    s.drillMaps.drillRenderScopeMode = normalizeDrillRenderScopeMode(
      getString(objects, ["drillMaps", "drillRenderScopeMode"], s.drillMaps.drillRenderScopeMode)
    );
    s.drillMaps.drillMinFocusScale = getNumber(
      objects,
      ["drillMaps", "drillMinFocusScale"],
      s.drillMaps.drillMinFocusScale
    );
    s.drillMaps.drillFocusPaddingPct = getNumber(
      objects,
      ["drillMaps", "drillFocusPaddingPct"],
      s.drillMaps.drillFocusPaddingPct
    );
    s.drillMaps.drillTargetAreaScreenPx = getNumber(
      objects,
      ["drillMaps", "drillTargetAreaScreenPx"],
      s.drillMaps.drillTargetAreaScreenPx
    );
    s.drillMaps.drillAreaScalePercentile = getNumber(
      objects,
      ["drillMaps", "drillAreaScalePercentile"],
      s.drillMaps.drillAreaScalePercentile
    );
    s.drillMaps.drillMaxFocusScale = getNumber(
      objects,
      ["drillMaps", "drillMaxFocusScale"],
      s.drillMaps.drillMaxFocusScale
    );
    s.labelOverrides.overridesJson = getString(
      objects,
      ["labelOverrides", "overridesJson"],
      s.labelOverrides.overridesJson
    );
    s.performance.denseModeEnabled = getBool(
      objects,
      ["performance", "denseModeEnabled"],
      s.performance.denseModeEnabled
    );
    s.performance.denseAreaThreshold = getNumber(
      objects,
      ["performance", "denseAreaThreshold"],
      s.performance.denseAreaThreshold
    );

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
      { value: "Theme", displayName: "Tema do Power BI" },
      { value: "Solid", displayName: "Cor simples" },
      { value: "Gradient", displayName: "Gradiente" }
    ],
    value: { value: "Theme", displayName: "Tema do Power BI" }
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
        : mode === "Solid"
          ? { value: "Solid", displayName: "Cor simples" }
          : { value: "Theme", displayName: "Tema do Power BI" };
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

  public labelScaleMode = new formattingSettings.ItemDropdown({
    name: "labelScaleMode",
    displayName: "Escala do rotulo",
    items: [
      { value: "FixedScreenSize", displayName: "Tamanho fixo na tela" },
      { value: "ScaleWithMap", displayName: "Escalar com o mapa" }
    ],
    value: { value: "FixedScreenSize", displayName: "Tamanho fixo na tela" }
  });

  public labelMinScreenPx = new formattingSettings.NumUpDown({
    name: "labelMinScreenPx",
    displayName: "Minimo na tela (px)",
    value: 8
  });

  public labelMaxScreenPx = new formattingSettings.NumUpDown({
    name: "labelMaxScreenPx",
    displayName: "Maximo na tela (px)",
    value: 22
  });

  public labelHideBelowAreaPx = new formattingSettings.NumUpDown({
    name: "labelHideBelowAreaPx",
    displayName: "Ocultar se area menor que (px)",
    value: 0
  });

  public labelDenseMode = new formattingSettings.ItemDropdown({
    name: "labelDenseMode",
    displayName: "Rotulos em mapas densos",
    items: [
      { value: "DataOnly", displayName: "Somente com dados" },
      { value: "SelectedOnly", displayName: "Somente selecionadas" },
      { value: "Hidden", displayName: "Ocultar" },
      { value: "All", displayName: "Todos" }
    ],
    value: { value: "DataOnly", displayName: "Somente com dados" }
  });

  public slices = [
    this.svgText,
    this.defaultFill,
    this.labelShow,
    this.labelMin,
    this.labelMax,
    this.labelBold,
    this.labelOutlineFactor,
    this.labelScaleMode,
    this.labelMinScreenPx,
    this.labelMaxScreenPx,
    this.labelHideBelowAreaPx,
    this.labelDenseMode
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

export class InteractionFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "interaction";
  public displayName: string = "Interacao";

  public autoFocusSelectedArea = new formattingSettings.ToggleSwitch({
    name: "autoFocusSelectedArea",
    displayName: "Focar area selecionada",
    value: true
  });

  public focusExternalSelection = new formattingSettings.ToggleSwitch({
    name: "focusExternalSelection",
    displayName: "Focar selecao externa",
    value: false
  });

  public focusPadding = new formattingSettings.NumUpDown({
    name: "focusPadding",
    displayName: "Padding do foco (%)",
    value: 12
  });

  public focusAnimationMs = new formattingSettings.NumUpDown({
    name: "focusAnimationMs",
    displayName: "Animacao do foco (ms)",
    value: 260
  });

  public unselectedOpacity = new formattingSettings.NumUpDown({
    name: "unselectedOpacity",
    displayName: "Opacidade das areas nao selecionadas",
    value: 0.18
  });

  public labelUnselectedOpacity = new formattingSettings.NumUpDown({
    name: "labelUnselectedOpacity",
    displayName: "Opacidade dos rotulos nao selecionados",
    value: 0.35
  });

  public slices = [
    this.autoFocusSelectedArea,
    this.focusExternalSelection,
    this.focusPadding,
    this.focusAnimationMs,
    this.unselectedOpacity,
    this.labelUnselectedOpacity
  ];
}

export class LabelsFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "labels";
  public displayName: string = "Rotulos avancados";

  public labelMode = new formattingSettings.ItemDropdown({
    name: "labelMode",
    displayName: "Modo dos rotulos",
    items: [
      { value: "Inside", displayName: "Interno" },
      { value: "OutsideCallout", displayName: "Callout externo" }
    ],
    value: { value: "Inside", displayName: "Interno" }
  });

  public labelContent = new formattingSettings.ItemDropdown({
    name: "labelContent",
    displayName: "Conteudo",
    items: [
      { value: "Value", displayName: "Valor" },
      { value: "Category", displayName: "Categoria" },
      { value: "CategoryAndValue", displayName: "Categoria e valor" }
    ],
    value: { value: "Value", displayName: "Valor" }
  });

  public calloutTextAlign = new formattingSettings.ItemDropdown({
    name: "calloutTextAlign",
    displayName: "Alinhamento horizontal",
    items: [
      { value: "Left", displayName: "Esquerda" },
      { value: "Center", displayName: "Centro" },
      { value: "Right", displayName: "Direita" }
    ],
    value: { value: "Left", displayName: "Esquerda" }
  });

  public calloutDistance = new formattingSettings.NumUpDown({
    name: "calloutDistance",
    displayName: "Distancia do callout",
    value: 36
  });

  public calloutLineColor = new formattingSettings.ColorPicker({
    name: "calloutLineColor",
    displayName: "Cor da linha",
    value: { value: "#333333" }
  });

  public calloutTextColor = new formattingSettings.ColorPicker({
    name: "calloutTextColor",
    displayName: "Cor do texto",
    value: { value: "#222222" }
  });

  public calloutLineWidth = new formattingSettings.NumUpDown({
    name: "calloutLineWidth",
    displayName: "Espessura da linha",
    value: 1
  });

  public calloutMinGap = new formattingSettings.NumUpDown({
    name: "calloutMinGap",
    displayName: "Espaco minimo entre callouts",
    value: 18
  });

  public calloutSideMode = new formattingSettings.ItemDropdown({
    name: "calloutSideMode",
    displayName: "Alinhamento dos callouts",
    items: [
      { value: "Right", displayName: "Direita" },
      { value: "Left", displayName: "Esquerda" },
      { value: "Top", displayName: "Superior" },
      { value: "Bottom", displayName: "Inferior" },
      { value: "HorizontalNearest", displayName: "Direita ou esquerda" },
      { value: "VerticalNearest", displayName: "Superior ou inferior" },
      { value: "Nearest", displayName: "Lado mais proximo" },
      { value: "CustomSides", displayName: "Usar lados permitidos" }
    ],
    value: { value: "Right", displayName: "Direita" }
  });

  public calloutRouteStyle = new formattingSettings.ItemDropdown({
    name: "calloutRouteStyle",
    displayName: "Estilo do conector",
    items: [
      { value: "Curved", displayName: "Curva + reta" },
      { value: "Straight", displayName: "Reto" }
    ],
    value: { value: "Curved", displayName: "Curva + reta" }
  });

  public calloutCurveSize = new formattingSettings.NumUpDown({
    name: "calloutCurveSize",
    displayName: "Tamanho da curva",
    value: 22
  });

  public calloutAllowRight = new formattingSettings.ToggleSwitch({
    name: "calloutAllowRight",
    displayName: "Permitir direita",
    value: true
  });

  public calloutAllowLeft = new formattingSettings.ToggleSwitch({
    name: "calloutAllowLeft",
    displayName: "Permitir esquerda",
    value: true
  });

  public calloutAllowTop = new formattingSettings.ToggleSwitch({
    name: "calloutAllowTop",
    displayName: "Permitir superior",
    value: false
  });

  public calloutAllowBottom = new formattingSettings.ToggleSwitch({
    name: "calloutAllowBottom",
    displayName: "Permitir inferior",
    value: false
  });

  public slices = [
    this.labelMode,
    this.labelContent,
    this.calloutTextAlign,
    this.calloutDistance,
    this.calloutLineColor,
    this.calloutTextColor,
    this.calloutLineWidth,
    this.calloutMinGap,
    this.calloutSideMode,
    this.calloutRouteStyle,
    this.calloutCurveSize,
    this.calloutAllowRight,
    this.calloutAllowLeft,
    this.calloutAllowTop,
    this.calloutAllowBottom
  ];
}

export class MapRegistryFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "mapRegistry";
  public displayName: string = "Registro de mapas";

  public manifestJson = new formattingSettings.TextArea({
    name: "manifestJson",
    displayName: "Manifesto JSON",
    description: "Manifesto versionado com mapas, aliases, bindings, metadados, drill paths e overrides.",
    placeholder: "{\"schemaVersion\":1,\"maps\":[]}",
    value: ""
  });

  public slices = [this.manifestJson];
}

export class EditorFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "editor";
  public displayName: string = "Editor avancado";

  public enabled = new formattingSettings.ToggleSwitch({
    name: "enabled",
    displayName: "Habilitar editor",
    value: true
  });

  public showEditorButton = new formattingSettings.ToggleSwitch({
    name: "showEditorButton",
    displayName: "Mostrar botao Editor",
    value: true
  });

  public showManifestEditor = new formattingSettings.ToggleSwitch({
    name: "showManifestEditor",
    displayName: "Mostrar manifesto",
    value: true
  });

  public slices = [this.enabled, this.showEditorButton, this.showManifestEditor];
}

export class DrillMapsFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "drillMaps";
  public displayName: string = "Drill de mapas";

  public enabled = new formattingSettings.ToggleSwitch({
    name: "enabled",
    displayName: "Habilitar mapas por drill",
    value: true
  });

  public fallbackToDefaultMap = new formattingSettings.ToggleSwitch({
    name: "fallbackToDefaultMap",
    displayName: "Usar mapa padrao como fallback",
    value: true
  });

  public noDataBehavior = new formattingSettings.ItemDropdown({
    name: "noDataBehavior",
    displayName: "Areas sem dado no drill",
    items: [
      { value: "Fade", displayName: "Desvanecer" },
      { value: "Hide", displayName: "Ocultar" }
    ],
    value: { value: "Fade", displayName: "Desvanecer" }
  });

  public focusDataAreas = new formattingSettings.ToggleSwitch({
    name: "focusDataAreas",
    displayName: "Focar areas com dado",
    value: true
  });

  public preFocusSourceOnDrill = new formattingSettings.ToggleSwitch({
    name: "preFocusSourceOnDrill",
    displayName: "Pre-focar antes do drill",
    value: true
  });

  public normalizeDrillFocus = new formattingSettings.ToggleSwitch({
    name: "normalizeDrillFocus",
    displayName: "Normalizar foco do drill",
    value: true
  });

  public drillRenderScopeMode = new formattingSettings.ItemDropdown({
    name: "drillRenderScopeMode",
    displayName: "Escopo renderizado no drill",
    items: [
      { value: "DrillDataOnly", displayName: "Somente areas com dado" },
      { value: "AllMapAreas", displayName: "Mapa completo" }
    ],
    value: { value: "DrillDataOnly", displayName: "Somente areas com dado" }
  });

  public drillMinFocusScale = new formattingSettings.NumUpDown({
    name: "drillMinFocusScale",
    displayName: "Zoom minimo do drill",
    value: 2.5
  });

  public drillFocusPaddingPct = new formattingSettings.NumUpDown({
    name: "drillFocusPaddingPct",
    displayName: "Padding do drill (%)",
    value: 10
  });

  public drillTargetAreaScreenPx = new formattingSettings.NumUpDown({
    name: "drillTargetAreaScreenPx",
    displayName: "Tamanho alvo da area (px)",
    value: 28
  });

  public drillAreaScalePercentile = new formattingSettings.NumUpDown({
    name: "drillAreaScalePercentile",
    displayName: "Percentil da area alvo",
    value: 35
  });

  public drillMaxFocusScale = new formattingSettings.NumUpDown({
    name: "drillMaxFocusScale",
    displayName: "Zoom maximo do drill",
    value: 24
  });

  public slices = [
    this.enabled,
    this.fallbackToDefaultMap,
    this.noDataBehavior,
    this.focusDataAreas,
    this.preFocusSourceOnDrill,
    this.normalizeDrillFocus,
    this.drillRenderScopeMode,
    this.drillMinFocusScale,
    this.drillFocusPaddingPct,
    this.drillTargetAreaScreenPx,
    this.drillAreaScalePercentile,
    this.drillMaxFocusScale
  ];
}

export class LabelOverridesFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "labelOverrides";
  public displayName: string = "Overrides de rotulos";

  public overridesJson = new formattingSettings.TextArea({
    name: "overridesJson",
    displayName: "Overrides JSON",
    description: "Overrides manuais de anchors e callouts por mapa/area.",
    placeholder: "{\"schemaVersion\":1,\"maps\":{}}",
    value: ""
  });

  public slices = [this.overridesJson];
}

export class PerformanceFormattingCard extends formattingSettings.SimpleCard {
  public name: string = "performance";
  public displayName: string = "Performance";

  public denseModeEnabled = new formattingSettings.ToggleSwitch({
    name: "denseModeEnabled",
    displayName: "Modo denso automatico",
    value: true
  });

  public denseAreaThreshold = new formattingSettings.NumUpDown({
    name: "denseAreaThreshold",
    displayName: "Limite de areas para modo denso",
    value: 1000
  });

  public slices = [this.denseModeEnabled, this.denseAreaThreshold];
}

export class VisualFormattingSettingsModel extends formattingSettings.Model {
  public area = new AreaFormattingCard();
  public svgSettings = new SvgFormattingCard();
  public outline = new OutlineFormattingCard();
  public legend = new LegendFormattingCard();
  public help = new HelpFormattingCard();
  public warning = new WarningFormattingCard();
  public ui = new UiFormattingCard();
  public interaction = new InteractionFormattingCard();
  public labels = new LabelsFormattingCard();
  public mapRegistry = new MapRegistryFormattingCard();
  public editor = new EditorFormattingCard();
  public drillMaps = new DrillMapsFormattingCard();
  public labelOverrides = new LabelOverridesFormattingCard();
  public performance = new PerformanceFormattingCard();

  public cards = [
    this.area,
    this.svgSettings,
    this.labels,
    this.interaction,
    this.outline,
    this.legend,
    this.mapRegistry,
    this.editor,
    this.drillMaps,
    this.labelOverrides,
    this.performance,
    this.help,
    this.ui
  ];
}
