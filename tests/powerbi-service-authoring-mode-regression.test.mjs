import fs from "node:fs";
import assert from "node:assert/strict";

const visualTs = fs.readFileSync("src/visual.ts", "utf8");
const dialogTs = fs.readFileSync("src/MapEditorDialog.ts", "utf8");
const visualLess = fs.readFileSync("style/visual.less", "utf8");

const methodBody = (name, nextName) => {
  const start = visualTs.indexOf(`private ${name}`);
  assert(start >= 0, `visual.ts deve definir ${name}.`);
  const end = nextName ? visualTs.indexOf(`private ${nextName}`, start) : visualTs.indexOf("\n  private ", start + 1);
  assert(end > start, `Nao foi possivel extrair corpo de ${name}.`);
  return visualTs.slice(start, end);
};

assert(/private lastViewMode/.test(visualTs), "visual deve armazenar viewMode do host.");
assert(/private lastEditMode/.test(visualTs), "visual deve armazenar editMode do host.");
assert(/private lastIsInFocus/.test(visualTs), "visual deve armazenar isInFocus do host.");
assert(/private updateHostMode\(options: VisualUpdateOptions\)/.test(visualTs), "visual deve sincronizar modo do host no update.");
assert(/this\.updateHostMode\(options\);[\s\S]{0,240}this\.lastUpdateOptions = options;/.test(visualTs), "update deve chamar updateHostMode logo no inicio.");

const canExposeBody = methodBody("canExposeEditorUi", "canShowEditorButton");
assert(!/canShowSvgPickerUI/.test(canExposeBody), "canExposeEditorUi nao pode depender de Desktop/hostEnv.");
assert(/canShowAuthoringControls/.test(canExposeBody), "canExposeEditorUi deve usar regra de autoria por modo do relatorio.");

const persistSvgBody = methodBody("persistSvgText", "persistHelpShow");
assert(!/canShowSvgPickerUI/.test(persistSvgBody), "persistSvgText nao pode bloquear Power BI Service.");
assert(/canPersistAuthoringProperties/.test(persistSvgBody), "persistSvgText deve persistir apenas em modo de autoria.");

assert(/private canShowAuthoringControls\(options\?: VisualUpdateOptions\)/.test(visualTs), "visual deve ter helper canShowAuthoringControls.");
assert(/private canPersistAuthoringProperties\(options\?: VisualUpdateOptions\)/.test(visualTs), "visual deve ter helper canPersistAuthoringProperties.");
assert(/private renderNoMapState\(hasSvgConfigured: boolean, options\?: VisualUpdateOptions\)/.test(visualTs), "visual deve renderizar estado sem mapa explicito.");
assert(!/showNoSvgMessageOutsideDesktop/.test(visualTs), "estado sem mapa nao deve mencionar Desktop.");
assert(!/Power BI Desktop/.test(methodBody("renderNoMapState", "clearSvg")), "estado sem mapa nao deve orientar usar somente Desktop.");

assert(/syncAuthoringUiVisibility\(hasSvgConfigured: boolean, options\?: VisualUpdateOptions\)/.test(visualTs), "visibilidade de controles deve ser centralizada.");
const syncBody = methodBody("syncAuthoringUiVisibility", "renderNoMapState");
assert(/canShowAuthoringControls/.test(syncBody), "syncAuthoringUiVisibility deve usar modo de autoria.");
assert(/toolbarHost\.style\.display/.test(syncBody), "syncAuthoringUiVisibility deve controlar toolbar.");
assert(/editorButton\.style\.display/.test(syncBody), "syncAuthoringUiVisibility deve controlar botao editor.");
assert(/helpButton\.style\.display/.test(syncBody), "syncAuthoringUiVisibility deve controlar botao guia.");
assert(/uploadCta\.style\.display\s*=\s*"none"/.test(syncBody), "CTA antigo de upload deve ficar oculto para nao duplicar o estado vazio.");

assert(/allowMapUploads:\s*this\.canShowAuthoringControls\(this\.lastUpdateOptions\)/.test(visualTs), "dialogo deve permitir upload no Power BI Service em autoria.");
assert(!/allowMapUploads:\s*this\.canShowSvgPickerUI\(\)/.test(visualTs), "dialogo nao pode limitar upload ao Desktop.");
assert(/fileInput\.multiple\s*=\s*true/.test(visualTs), "upload inicial deve aceitar multiplos SVGs.");
assert(/addInput\.multiple\s*=\s*true/.test(visualTs), "adicao de mapas no editor inline deve aceitar multiplos SVGs.");
assert(/input\.multiple\s*=\s*multiple/.test(dialogTs) && /createHiddenFileInput\(".svg,image\/svg\+xml"[\s\S]{0,500},\s*true\)/.test(dialogTs), "adicao de mapas no dialog deve aceitar multiplos SVGs.");
assert(/Array\.from\([^)]*files/.test(visualTs) && /Array\.from\([^)]*files/.test(dialogTs), "handlers de upload devem processar todos os arquivos selecionados.");
const noMapBody = methodBody("renderNoMapState", "clearSvg");
assert(/sp-empty-state-action/.test(noMapBody), "estado vazio de autoria deve conter botao de adicionar mapa no mesmo card.");
assert(/this\.fileInput\.click\(\)/.test(noMapBody), "botao do estado vazio deve abrir seletor SVG.");

assert(/\.sp-empty-state\s*\{/.test(visualLess), "visual.less deve definir sp-empty-state.");
assert(/\.sp-empty-state-card\s*\{/.test(visualLess), "visual.less deve definir sp-empty-state-card.");
assert(/\.sp-empty-state-title\s*\{/.test(visualLess), "visual.less deve definir sp-empty-state-title.");
assert(/\.sp-empty-state-body\s*\{/.test(visualLess), "visual.less deve definir sp-empty-state-body.");
assert(/\.sp-empty-state-action\s*\{/.test(visualLess), "visual.less deve definir botao do estado vazio.");
assert(/\.sp-empty-state-card[\s\S]{0,260}pointer-events:\s*auto/.test(visualLess), "card vazio deve permitir clique no botao.");
assert(!/sp-empty-state[\s\S]{0,900}rgba\(255,\s*255,\s*255,\s*0\.85\)/.test(visualLess), "estado vazio nao pode usar texto branco/translucido.");

console.log("Power BI Service authoring mode regression checks passed.");
