import fs from "node:fs";
import assert from "node:assert/strict";

const capabilities = JSON.parse(fs.readFileSync("capabilities.json", "utf8"));
const settingsTs = fs.readFileSync("src/settings.ts", "utf8");
const visualTs = fs.readFileSync("src/visual.ts", "utf8");
const dialogTs = fs.readFileSync("src/MapEditorDialog.ts", "utf8");
const visualLess = fs.readFileSync("style/visual.less", "utf8");

for (const objectName of ["interaction", "labels", "mapRegistry", "editor", "drillMaps", "labelOverrides", "performance"]) {
  assert(capabilities.objects?.[objectName], `capabilities.json deve expor o objeto ${objectName}.`);
}

assert.equal(
  capabilities.advancedEditModeSupport,
  2,
  "advancedEditModeSupport deve usar SupportedInFocus para o editor avançado."
);
assert(
  !capabilities.privileges?.some((p) => p?.name === "WebAccess"),
  "as novas fases não podem adicionar WebAccess."
);

assert(/class\s+InteractionSettings/.test(settingsTs), "settings.ts deve definir InteractionSettings.");
assert(/class\s+LabelsSettings/.test(settingsTs), "settings.ts deve definir LabelsSettings.");
assert(/class\s+MapRegistrySettings/.test(settingsTs), "settings.ts deve definir MapRegistrySettings.");
assert(/class\s+EditorSettings/.test(settingsTs), "settings.ts deve definir EditorSettings.");
assert(/class\s+DrillMapsSettings/.test(settingsTs), "settings.ts deve definir DrillMapsSettings.");
assert(/class\s+LabelOverridesSettings/.test(settingsTs), "settings.ts deve definir LabelOverridesSettings.");

assert(/labelMode/.test(settingsTs) && /OutsideCallout/.test(settingsTs), "deve existir modo OutsideCallout.");
assert(/calloutSideMode/.test(settingsTs), "deve existir modo de roteamento/alinhamento de callout.");
assert(/calloutAllowRight/.test(settingsTs), "deve existir combinação configurável de lados do callout.");
assert(/calloutRouteStyle/.test(settingsTs), "deve existir estilo de rota do conector do callout.");
assert(/calloutCurveSize/.test(settingsTs), "deve existir tamanho de curva do conector do callout.");
assert(/calloutTextAlign/.test(settingsTs), "deve existir alinhamento horizontal configurável para texto do callout.");
assert(/autoFocusSelectedArea/.test(settingsTs), "deve existir configuração de foco automático.");
assert(/unselectedOpacity/.test(settingsTs), "deve existir opacidade de áreas não selecionadas.");
assert(/labelUnselectedOpacity/.test(settingsTs), "deve existir opacidade de labels não selecionadas.");
assert(/manifestJson/.test(settingsTs), "deve existir manifesto JSON persistido no relatório.");

assert(/private\s+editorHost/.test(visualTs), "visual.ts deve ter host de editor avançado.");
assert(/isAdvancedEditMode/.test(visualTs), "visual.ts deve detectar Advanced Edit Mode.");
assert(/renderAdvancedEditor/.test(visualTs), "visual.ts deve renderizar editor avançado.");
assert(!/Editor avancado do mapa/.test(visualTs), "o editor novo não deve mais renderizar o título informativo no topo.");
assert(!/Gerencie os mapas do drilldown no painel esquerdo/.test(visualTs), "o editor novo não deve mais renderizar texto informativo no topo.");
assert(/persistMapRegistryManifest/.test(visualTs), "visual.ts deve persistir manifesto do map registry.");
assert(/persistLabelOverridesManifest/.test(visualTs), "visual.ts deve persistir overrides de labels.");
assert(/parseMapRegistryManifest/.test(visualTs), "visual.ts deve parsear manifesto versionado.");
assert(/Mapas/.test(visualTs) && /Areas/.test(visualTs) && /Aliases/.test(visualTs) && /Metadados/.test(visualTs) && /Drill/.test(visualTs) && /Labels/.test(visualTs), "o editor deve expor abas visuais principais.");
assert(/buildEditorTabs/.test(visualTs), "visual.ts deve montar abas visuais no editor.");
assert(/buildEditorMapBrowser/.test(visualTs), "visual.ts deve montar a tela de browser de mapas.");
assert(/buildEditorMapDetailView/.test(visualTs), "visual.ts deve montar a tela detalhada do mapa.");
assert(/createSanitizedEditorPreview/.test(visualTs), "visual.ts deve renderizar preview sanitizado no editor.");
assert(/setAttribute\("viewBox"/.test(visualTs) && /getCombinedRegionBBox\(regions\)/.test(visualTs), "o preview sanitizado deve ajustar o viewBox para enquadrar o mapa inteiro.");
assert(/seedDraftFromUploadedSvg/.test(visualTs), "visual.ts deve abrir o editor a partir do SVG carregado.");
assert(/buildMapsTab/.test(visualTs), "visual.ts deve montar a aba Mapas.");
assert(/buildAreasTab/.test(visualTs), "visual.ts deve montar a aba Areas.");
assert(/buildAliasesTab/.test(visualTs), "visual.ts deve montar a aba Aliases.");
assert(/buildMetadataTab/.test(visualTs), "visual.ts deve montar a aba Metadados.");
assert(/buildDrillTab/.test(visualTs), "visual.ts deve montar a aba Drill.");
assert(/buildLabelsTab/.test(visualTs), "visual.ts deve montar a aba Labels.");

assert(/focusSelectedAreas/.test(visualTs), "visual.ts deve focar áreas selecionadas.");
assert(/animateZoomTransform/.test(visualTs), "visual.ts deve animar foco/reset.");
assert(
  /style\.opacity\s*=\s*isSelected\s*\?\s*"1"\s*:\s*String\(this\.settings\.interaction\.labelUnselectedOpacity\)/.test(
    visualTs
  ),
  "labels devem ficar opacos, não ocultos, quando outra área é selecionada."
);

assert(/upsertCalloutLabel/.test(visualTs), "visual.ts deve criar callouts externos.");
assert(/removeCalloutLabel/.test(visualTs), "visual.ts deve remover callouts quando necessário.");
assert(/computeCalloutLayout/.test(visualTs), "visual.ts deve calcular layout de callouts.");
assert(/resolveCalloutSide/.test(visualTs), "visual.ts deve resolver o lado do callout por configuração.");
assert(/layoutCalloutLanes/.test(visualTs), "visual.ts deve alinhar callouts em lanes por lado.");
assert(/buildCalloutConnectorPath/.test(visualTs), "visual.ts deve criar conector com curva e trecho reto.");
assert(/setRegionHidden/.test(visualTs), "visual.ts deve expor helper para ocultar a geometria de regioes desativadas.");
assert(/const areaOverride = this\.getAreaManifestOverride\(id\);[\s\S]{0,400}if \(areaOverride\?\.hidden\)/.test(visualTs), "a renderizacao principal deve consultar hidden por area antes de desenhar a regiao.");
assert(/this\.setRegionHidden\(el,\s*true\)/.test(visualTs), "areas ocultas no editor devem ser removidas visualmente do mapa principal.");
assert(/this\.setRegionHidden\(el,\s*false\)/.test(visualTs), "areas visiveis devem restaurar a geometria quando reativadas.");
assert(/Q\s*\$\{/.test(visualTs) || /C\s*\$\{/.test(visualTs), "o conector deve usar curva SVG no path.");
assert(/L \$\{placement\.anchorX\} \$\{verticalEndY\}/.test(visualTs), "callout lateral deve alinhar primeiro no eixo vertical.");
assert(/Q \$\{placement\.anchorX\} \$\{cornerY\} \$\{horizontalStartX\} \$\{cornerY\}/.test(visualTs), "callout lateral deve arredondar o cotovelo antes do trecho reto.");
assert(/L \$\{horizontalEndX\} \$\{placement\.anchorY\}/.test(visualTs), "callout superior ou inferior deve alinhar primeiro no eixo horizontal.");
assert(/Q \$\{cornerX\} \$\{placement\.anchorY\} \$\{cornerX\} \$\{verticalStartY\}/.test(visualTs), "callout superior ou inferior deve arredondar o cotovelo antes do trecho reto.");
assert(/text-anchor/.test(visualTs) && /calloutTextAlign/.test(visualTs), "callout deve aplicar alinhamento configurável ao texto.");
assert(/createEditorButton/.test(visualTs), "visual.ts deve expor botão interno para abrir o editor.");
assert(/setEditorOpen/.test(visualTs), "visual.ts deve permitir abrir/fechar o editor pelo botão.");
assert(/overflow:\s*"hidden"/.test(visualTs), "o host do editor deve evitar scroll global do visual.");
assert(/openModalDialog/.test(visualTs), "visual.ts deve usar o modal oficial do Power BI quando suportado.");
assert(/allowModalDialog/.test(visualTs), "visual.ts deve respeitar a capability allowModalDialog do host.");
assert(/MapEditorDialog/.test(visualTs), "visual.ts deve integrar o dialogo do editor de mapas.");
assert(/allowMapUploads:\s*this\.canShowSvgPickerUI\(\)/.test(visualTs), "o dialogo deve receber a flag de upload permitido apenas no Desktop.");
assert(/const allow = this\.settings\.editor\.enabled && this\.settings\.editor\.showEditorButton;/.test(visualTs), "o botao Editor deve poder aparecer fora do Desktop quando ja existir mapa.");
assert(/dialogRegistry/.test(dialogTs), "MapEditorDialog.ts deve registrar o dialogo globalmente.");
assert(/class\s+MapEditorDialog\b/.test(dialogTs), "MapEditorDialog.ts deve exportar a classe do dialogo.");
assert(/createButton\(/.test(dialogTs) && /createIcon\(/.test(dialogTs), "MapEditorDialog.ts deve montar botoes compactos com icones inline.");
assert(/buildSvgEditorOverlay/.test(dialogTs), "MapEditorDialog.ts deve oferecer overlay interno para editar o SVG.");
assert(/createButton\("SVG", "svg"/.test(dialogTs), "a tela detalhada deve expor um botao SVG.");
assert(/buildMetadataOverlay/.test(dialogTs), "o editor deve ter uma superficie secundaria para metadata do mapa.");
assert(/const applyBtn = this\.createButton\("Apply", "metadata", \{ kind: "primary" \}\);/.test(dialogTs), "o modal de metadata deve usar uma acao de aplicar clara.");
assert(/applyBtn\.addEventListener\("click", \(\) => \{[\s\S]{0,240}this\.syncResult\(true\);/.test(dialogTs), "aplicar metadata deve marcar o resultado do dialogo como persistivel.");
assert(!/Metadata atualizado\. Use Save & Close para persistir no relatorio\./.test(dialogTs), "o editor nao deve mostrar mensagem transitória de metadata.");
assert(/const levelInput = shell\.querySelector<HTMLInputElement>\("\[data-editor-browser-map-level='1'\]"\);\s*if \(levelInput\)/.test(dialogTs), "level do metadata so deve ser sobrescrito quando o input existir no DOM atual.");
assert(/const drillPathInput = shell\.querySelector<HTMLInputElement>\("\[data-editor-browser-map-path='1'\]"\);\s*if \(drillPathInput\)/.test(dialogTs), "drillPath do metadata so deve ser sobrescrito quando o input existir no DOM atual.");
assert(/const defaultInput = shell\.querySelector<HTMLInputElement>\("\[data-editor-browser-default='1'\]"\);\s*if \(defaultInput\)/.test(dialogTs), "mapa padrao so deve ser reavaliado quando o checkbox de metadata existir no DOM atual.");
assert(/allowMapUploads/.test(dialogTs), "MapEditorDialog.ts deve suportar upload de mapas condicionado ao host.");
assert(/Nenhum mapa configurado/.test(dialogTs), "o browser deve suportar estado vazio para adicionar mapa.");
assert(/sp-editor-svg-overlay/.test(dialogTs) && /sp-editor-svg-modal/.test(dialogTs), "o editor de SVG deve usar overlay/modal interno.");
assert(/const saveCloseBtn = this\.createButton\("Save & Close", "edit", \{ kind: "primary" \}\);[\s\S]{0,220}this\.closeWithPersist\(shell\)/.test(dialogTs), "a tela 1 deve permitir salvar e fechar sem entrar na tela detalhada.");
assert(/closeWithPersist\(shell\)/.test(dialogTs), "o dialogo deve centralizar o fluxo de persistencia ao fechar.");
assert(!/Metadados/.test(dialogTs), "a tela simplificada nao deve expor a aba Metadados no dialog principal.");
assert(!/data-editor-area-virtual-id/.test(dialogTs), "a tela simplificada nao deve expor ID virtual no inspector principal.");
assert(!/data-editor-area-aliases/.test(dialogTs), "a tela simplificada nao deve expor aliases no inspector principal.");
assert(!/data-editor-label-mode/.test(dialogTs), "a tela simplificada nao deve expor configuracoes de label no inspector principal.");
assert(/grid-template-columns:\s*minmax\(260px,\s*320px\)\s*minmax\(0,\s*1fr\)/.test(visualLess), "o browser do editor deve manter duas colunas.");
assert(/grid-template-columns:\s*minmax\(0,\s*1\.8fr\)\s*minmax\(360px,\s*460px\)/.test(visualLess), "a tela detalhada deve manter preview e sidebar em colunas separadas.");
assert(/grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/.test(visualLess), "a sidebar detalhada deve deixar a lista ocupar o espaco restante e o inspector ajustar por conteudo.");
assert(/\.sp-editor-inspector\s*\{[\s\S]*padding:\s*12px 14px 18px;/.test(visualLess), "o inspector deve ter folga inferior para nao clipar a borda.");
assert(/\.sp-editor-inspector-panel\s*\{[\s\S]*padding-bottom:\s*12px;/.test(visualLess), "o painel interno do inspector deve manter padding inferior suficiente.");
assert(/\.sp-editor-svg-overlay/.test(visualLess) && /\.sp-editor-svg-modal/.test(visualLess), "visual.less deve estilizar o modal interno do SVG.");
assert(/\.sp-editor-btn.is-primary[\s\S]*background:\s*#0f8c79;/.test(visualLess), "o botao primario deve ter contraste suficiente e nao parecer desabilitado.");
assert(/\.sp-editor-btn.is-primary:hover/.test(visualLess), "o botao primario deve ter estado de hover ou foco explicito.");
assert(/\.sp-editor-btn:disabled/.test(visualLess), "o estado desabilitado deve ser explicito, e nao parecer o estado padrao.");
assert(/\.sp-editor-btn/.test(visualLess) && /\.sp-editor-icon/.test(visualLess), "visual.less deve estilizar botoes minimalistas com icones.");
assert(/\.sp-editor-codeframe/.test(visualLess) && /\.sp-editor-svg-gutter/.test(visualLess), "visual.less deve estilizar o editor SVG com gutter.");
assert(/doc\.body\.style\.overflow = "hidden"/.test(dialogTs), "o dialog deve desabilitar scroll global do iframe.");

assert(/resolveActiveMapFromDrillPath/.test(visualTs), "visual.ts deve resolver mapa ativo pelo drill path.");
assert(/currentDrillPath/.test(visualTs), "visual.ts deve rastrear drill path atual.");
assert(/labelOverrides/.test(visualTs), "visual.ts deve aplicar overrides de labels por manifesto.");
assert(/private getCategoryColumns\(dv\?: DataView\): DataViewCategoryColumn\[]/.test(visualTs), "visual.ts deve isolar as colunas categoricas do drill.");
assert(/private getSvgAreaIds\(svgText: string\): Set<string>/.test(visualTs), "visual.ts deve cachear IDs de areas do SVG para casar mapas com niveis.");
assert(/bestMatch && bestMatch\.score > 0 \? bestMatch\.map : null/.test(visualTs), "visual.ts deve preferir o mapa que melhor casa com os IDs da categoria ativa.");
assert(/this\.activeMap = this\.resolveActiveMapFromDrillPath\(this\.settings\.svgSettings\.svgText,\s*dv\);[\s\S]{0,360}this\.buildDataMap\(dv\);/s.test(visualTs), "o visual deve resolver o mapa ativo antes de montar o dataMap.");
assert(/categoryCols\.find\(\(column\) => this\.getCategoryColumnName\(column\) === this\.activeCategoryQueryName\)/.test(visualTs), "buildDataMap deve usar a categoria ativa resolvida para o nivel atual.");

assert(/labelScaleMode/.test(settingsTs) && /FixedScreenSize/.test(settingsTs), "settings.ts deve expor labels com tamanho compensado pelo zoom.");
assert(/labelMinScreenPx/.test(settingsTs), "settings.ts deve expor tamanho minimo de label em px de tela.");
assert(/labelMaxScreenPx/.test(settingsTs), "settings.ts deve expor tamanho maximo de label em px de tela.");
assert(/labelHideBelowAreaPx/.test(settingsTs), "settings.ts deve expor limiar de ocultacao de labels por tamanho da area na tela.");
assert(/public labelHideBelowAreaPx: number = 0;/.test(settingsTs), "labels pequenos nao devem ser ocultados por default.");
assert(/labelDenseMode/.test(settingsTs) && /DataOnly/.test(settingsTs), "settings.ts deve expor modo denso de labels com default DataOnly.");
assert(/class\s+PerformanceSettings/.test(settingsTs), "settings.ts deve definir PerformanceSettings.");
assert(/denseModeEnabled/.test(settingsTs), "settings.ts deve expor denseModeEnabled.");
assert(/denseAreaThreshold/.test(settingsTs), "settings.ts deve expor denseAreaThreshold.");
assert(/normalizeDrillFocus/.test(settingsTs), "settings.ts deve expor normalizacao de foco do drill.");
assert(/drillRenderScopeMode/.test(settingsTs) && /DrillDataOnly/.test(settingsTs), "settings.ts deve expor renderizacao apenas do escopo ativo do drill.");
assert(/drillMinFocusScale/.test(settingsTs), "settings.ts deve expor zoom minimo do drill.");
assert(/drillFocusPaddingPct/.test(settingsTs), "settings.ts deve expor padding especifico do foco do drill.");
assert(capabilities.objects?.svgSettings?.properties?.labelScaleMode, "capabilities.json deve expor svgSettings.labelScaleMode.");
assert(capabilities.objects?.svgSettings?.properties?.labelMinScreenPx, "capabilities.json deve expor svgSettings.labelMinScreenPx.");
assert(capabilities.objects?.svgSettings?.properties?.labelMaxScreenPx, "capabilities.json deve expor svgSettings.labelMaxScreenPx.");
assert(capabilities.objects?.svgSettings?.properties?.labelHideBelowAreaPx, "capabilities.json deve expor svgSettings.labelHideBelowAreaPx.");
assert(capabilities.objects?.svgSettings?.properties?.labelDenseMode, "capabilities.json deve expor svgSettings.labelDenseMode.");
assert(capabilities.objects?.drillMaps?.properties?.normalizeDrillFocus, "capabilities.json deve expor drillMaps.normalizeDrillFocus.");
assert(capabilities.objects?.drillMaps?.properties?.drillRenderScopeMode, "capabilities.json deve expor drillMaps.drillRenderScopeMode.");
assert(capabilities.objects?.drillMaps?.properties?.drillMinFocusScale, "capabilities.json deve expor drillMaps.drillMinFocusScale.");
assert(capabilities.objects?.drillMaps?.properties?.drillFocusPaddingPct, "capabilities.json deve expor drillMaps.drillFocusPaddingPct.");
assert(capabilities.objects?.drillMaps?.properties?.drillTargetAreaScreenPx, "capabilities.json deve expor drillMaps.drillTargetAreaScreenPx para normalizacao dinamica.");
assert(capabilities.objects?.drillMaps?.properties?.drillAreaScalePercentile, "capabilities.json deve expor drillMaps.drillAreaScalePercentile para escolher a area tipica.");
assert(capabilities.objects?.drillMaps?.properties?.drillMaxFocusScale, "capabilities.json deve expor drillMaps.drillMaxFocusScale para limitar zoom excessivo.");
assert(capabilities.objects?.drillMaps?.properties?.preFocusSourceOnDrill, "capabilities.json deve expor drillMaps.preFocusSourceOnDrill para testar/reverter pre-foco no mapa origem.");
assert(capabilities.objects?.performance?.properties?.denseModeEnabled, "capabilities.json deve expor performance.denseModeEnabled.");
assert(capabilities.objects?.performance?.properties?.denseAreaThreshold, "capabilities.json deve expor performance.denseAreaThreshold.");

assert(/regionElementsById:\s*Map<string,\s*SVGElement>/.test(visualTs), "visual.ts deve manter cache de elementos por area.");
assert(/regionBBoxesById:\s*Map<string,\s*GeometryBBox>/.test(visualTs), "visual.ts deve manter cache de bbox por area.");
assert(/lastRenderedSvgSignature/.test(visualTs), "visual.ts deve rastrear assinatura do SVG renderizado.");
assert(/pendingDrillFocus/.test(visualTs), "visual.ts deve rastrear foco pendente de drill.");
assert(/drillFocusSettleToken/.test(visualTs), "visual.ts deve cancelar/aplicar settle fit tardio do drill sem disputar updates novos.");
assert(/cancelPendingDrillFocus/.test(visualTs), "visual.ts deve cancelar foco pendente de drill quando houver selecao local.");
assert(/type\s+DrillFocusPhase\s*=\s*"idle"\s*\|\s*"mapResolved"\s*\|\s*"domInserted"\s*\|\s*"stylesApplied"\s*\|\s*"focusApplied"/.test(visualTs), "visual.ts deve modelar o foco de drill como state machine explicita.");
assert(/drillFocusPhase:\s*DrillFocusPhase/.test(visualTs), "visual.ts deve armazenar a fase atual da state machine de drill.");
assert(/beginDrillFocusTransition/.test(visualTs), "visual.ts deve iniciar transicao de foco de drill quando o mapa/nivel for resolvido.");
assert(/markDrillFocusDomInserted/.test(visualTs), "visual.ts deve marcar a fase DOM inserido antes de focar.");
assert(/markDrillFocusStylesApplied/.test(visualTs), "visual.ts deve marcar a fase estilos aplicados antes de focar.");
assert(/runDrillFocusStateMachine/.test(visualTs), "visual.ts deve executar o foco de drill pela state machine.");
assert(/completeDrillFocusTransition/.test(visualTs), "visual.ts deve finalizar explicitamente a transicao de foco de drill.");
assert(/rebuildRegionCache\(\)/.test(visualTs), "visual.ts deve reconstruir cache de regioes apos render estrutural.");
assert(/delegateSvgRegionEvent/.test(visualTs), "visual.ts deve usar event delegation para eventos de regioes.");
assert(/cancelRegionStyleBatch\(\)/.test(visualTs), "visual.ts deve cancelar fila pendente de estilo.");
assert(/scheduleRegionStyleBatch/.test(visualTs), "visual.ts deve aplicar estilos em lotes para mapas densos.");
assert(/getSelectedRegionElementsForActiveMap/.test(visualTs), "visual.ts deve validar se selecao existe no mapa ativo.");
assert(/getBoundRegionElementsForActiveMap/.test(visualTs), "visual.ts deve focar areas com dado no nivel atual.");
assert(/getSelectedRegionElementsForActiveMap\(\): SVGElement\[] \{[\s\S]{0,300}this\.isHiddenByRenderScope\(id\)/.test(visualTs), "foco de selecao deve ignorar areas ocultas pelo escopo normalizado.");
assert(/getBoundRegionElementsForActiveMap\(\): SVGElement\[] \{[\s\S]{0,300}this\.isHiddenByRenderScope\(id\)/.test(visualTs), "foco do drill deve ignorar areas ocultas por escopo/outlier.");
assert(/applySelectionVisualState\(resetFocusOnEmptySelection = false\)/.test(visualTs), "applySelectionVisualState deve aceitar reset explicito quando a selecao local e limpa.");
assert(/resetFocusToCurrentScope/.test(visualTs), "visual.ts deve resetar o foco para o escopo atual ao limpar selecao.");
assert(/resetFocusOnEmptySelection && this\.selectedKeys\.size === 0/.test(visualTs), "limpeza de selecao local deve acionar reset de zoom para o fit atual.");
assert(/renderScope:\s*RenderScopeState/.test(visualTs), "visual.ts deve manter estado interno de renderScope.");
assert(/computeRenderScope\(\)/.test(visualTs), "visual.ts deve calcular escopo renderizado do drill.");
assert(/spatialOutlierIds:\s*Set<string>/.test(visualTs), "renderScope deve rastrear geometrias espaciais isoladas do drill.");
assert(/getDrillSpatialOutlierIds/.test(visualTs), "visual.ts deve detectar outliers espaciais no escopo ativo do drill.");
assert(/state\.unbound\.length > 0 \|\| spatialOutlierIds\.size > 0/.test(visualTs), "renderScope deve ficar ativo quando houver outliers espaciais mesmo apos poda do SVG.");
assert(/pruneSvgToDrillDataScope/.test(visualTs), "visual.ts deve pre-processar SVG por escopo de drill antes de inserir no DOM.");
assert(/getDrillSvgScopeSignature/.test(visualTs), "visual.ts deve incluir escopo de drill na assinatura do SVG renderizado.");
const pruneCallIndex = visualTs.indexOf("const pruneResult = this.pruneSvgToDrillDataScope(parsed);");
const importNodeIndex = visualTs.indexOf("document.importNode(parsed, true)");
assert(pruneCallIndex >= 0 && importNodeIndex > pruneCallIndex, "render deve podar areas fora do drill antes de importar o SVG para o DOM.");
assert(/this\.lastRenderedSvgSignature === renderSig/.test(visualTs), "reuso estrutural do SVG deve considerar a assinatura com escopo filtrado.");
assert(/isHiddenByRenderScope/.test(visualTs), "visual.ts deve ocultar areas fora do escopo do drill.");
assert(/this\.renderScope\.spatialOutlierIds\.has\(id\)/.test(visualTs), "areas outliers do drill devem ser ocultadas pelo renderScope.");
assert(/containsBoundRenderScopeRegion/.test(visualTs), "visual.ts nao deve ocultar grupos ancestrais que contem areas com dado.");
assert(/el\.tagName\.toLowerCase\(\) === "g"[\s\S]{0,220}querySelector\("path\[id\], polygon\[id\], rect\[id\], circle\[id\], ellipse\[id\], g\[id\]"\)/.test(visualTs), "cache de regioes deve ignorar grupos estruturais com filhos identificados.");
assert(/focusNormalizedBBox/.test(visualTs), "visual.ts deve focar bbox normalizado.");
assert(/getRegionBBoxInAncestorSpace/.test(visualTs), "foco deve converter bbox local para o espaco do zoomRoot quando houver transforms.");
assert(/getCTM\(\)/.test(visualTs) && /\.inverse\(\)/.test(visualTs) && /\.multiply\(/.test(visualTs), "foco deve usar CTM/inverse/multiply para respeitar transformacoes do SVG.");
assert(/private getElementFocusBBox\(el: SVGElement\): GeometryBBox/.test(visualTs), "visual.ts deve ter helper de bbox de foco no sistema de coordenadas correto.");
assert(/focusNormalizedBBox\(elements: SVGElement\[],[\s\S]{0,240}this\.getCombinedFocusBBox\(elements\)/.test(visualTs), "focusNormalizedBBox deve usar bbox de foco transformado, nao apenas bbox local.");
assert(/calculateDynamicDrillScale\([\s\S]{0,1400}this\.getElementFocusBBox\(el\)/.test(visualTs), "escala dinamica do drill deve usar bbox transformado.");
assert(/correctDrillFocusScreenFit\([\s\S]{0,900}this\.getCombinedFocusBBox\(elements\)/.test(visualTs), "correcao final de foco deve recomputar escala usando bbox transformado.");
assert(/scheduleDrillFocusSettle/.test(visualTs), "visual.ts deve reaplicar foco de drill apos o layout final estabilizar.");
assert(/getFocusedElementsScreenBBox/.test(visualTs), "visual.ts deve medir o bbox final do foco em coordenadas reais de tela.");
assert(/correctDrillFocusScreenFit/.test(visualTs), "visual.ts deve corrigir o foco final do drill usando o bbox real em tela.");
assert(/scheduleFinalDrillFocusFit/.test(visualTs), "visual.ts deve agendar uma etapa final de fit apos DOM, estilos e layout estabilizarem.");
assert(/getBoundingClientRect\(\)/.test(visualTs), "fit final do drill deve usar getBoundingClientRect para validar o resultado renderizado.");
assert(/correctDrillFocusScreenFit\([\s\S]{0,2400}this\.scale\s*=\s*this\.scale\s*\*\s*scaleCorrection/.test(visualTs), "fit final deve reduzir escala quando o bbox real fica maior que o viewport util.");
assert(/correctDrillFocusScreenFit\([\s\S]{0,3000}this\.tx\s*\+=\s*dxPx\s*\/\s*viewScale/.test(visualTs), "fit final deve converter delta de tela para unidades SVG e corrigir X.");
assert(/correctDrillFocusScreenFit\([\s\S]{0,3100}this\.ty\s*\+=\s*dyPx\s*\/\s*viewScale/.test(visualTs), "fit final deve converter delta de tela para unidades SVG e corrigir Y.");
assert(/scheduleDrillFocusSettle\(\): void \{[\s\S]{0,900}getSelectedRegionElementsForActiveMap\(\)\.length > 0/.test(visualTs), "settle tardio do drill deve bloquear apenas selecao valida no mapa ativo.");
assert(!/scheduleDrillFocusSettle\(\): void \{[\s\S]{0,900}selectedKeys\.size > 0/.test(visualTs), "settle tardio do drill nao pode ser bloqueado por selecao antiga de outro nivel.");
assert(/setSelectionFromIds\(ids\?: ISelectionId\[] \| null, source\?: SelectionSource\)[\s\S]{0,1400}nextSource === "self" && this\.getSelectedRegionElementsForActiveMap\(\)\.length > 0/.test(visualTs), "selecao antiga do host so deve cancelar foco pendente quando existir no mapa ativo.");
assert(/applySelectionVisualState\(resetFocusOnEmptySelection = false\)[\s\S]{0,9000}if \(this\.pendingDrillFocus\) \{[\s\S]{0,220}return;/.test(visualTs), "applySelectionVisualState nao deve disputar foco enquanto a state machine de drill esta pendente.");
const scheduleFitBody = visualTs.slice(visualTs.indexOf("private scheduleFitToHost"), visualTs.indexOf("private getThemeColorForKey"));
assert(scheduleFitBody.indexOf("this.pendingDrillFocus") >= 0 && scheduleFitBody.indexOf("this.pendingDrillFocus") < scheduleFitBody.indexOf("const selectedEls"), "scheduleFitToHost deve priorizar a state machine de drill antes de selecao antiga.");
assert(/private focusElements\(elements: SVGElement\[]\): void \{[\s\S]{0,160}this\.focusNormalizedBBox\(elements,\s*false\)/.test(visualTs), "foco de selecao deve evitar normalizacao dinamica de drill em uma unica area.");
assert(/setTimeout\(\(\) => \{[\s\S]{0,500}this\.computeFitTransform\(\);[\s\S]{0,500}this\.focusDrillDataAreas\(true\)/.test(visualTs), "settle fit deve recalcular layout e reaplicar foco sem animacao apos o carregamento do nivel.");
assert(/runDrillFocusStateMachine\(\): void \{[\s\S]{0,1600}this\.focusDrillDataAreas\(true\);[\s\S]{0,280}this\.scheduleFinalDrillFocusFit\(token,\s*true\)/.test(visualTs), "state machine deve fazer foco inicial e depois agendar fit final em tela antes de completar o drill.");
assert(/scheduleDrillFocusSettle\(\): void \{[\s\S]{0,900}this\.focusDrillDataAreas\(true\);[\s\S]{0,260}this\.correctDrillFocusScreenFit/.test(visualTs), "settle tardio deve reaplicar foco e corrigir o bbox real em tela.");
assert(/bound\.length > 0 && \(Number\(this\.activeMap\.map\?\.level\) > 0 \|\| bound\.length < this\.regionIds\.length\)/.test(visualTs), "foco de drill deve normalizar bbox mesmo quando o DOM ja foi podado para conter apenas areas com dado.");
assert(/drillMinFocusScale/.test(visualTs), "focusNormalizedBBox deve respeitar zoom minimo do drill.");
assert(/calculateDynamicDrillScale/.test(visualTs), "focusNormalizedBBox deve usar escala dinamica baseada nas dimensoes das areas do drill.");
assert(/drillTargetAreaScreenPx/.test(visualTs), "escala dinamica deve usar tamanho alvo de area em pixels de tela.");
assert(/drillAreaScalePercentile/.test(visualTs), "escala dinamica deve usar percentil configuravel da area tipica.");
assert(/drillMaxFocusScale/.test(visualTs), "escala dinamica deve respeitar zoom maximo configuravel.");
assert(/const viewportX = vb && Number\.isFinite\(vb\.x\) \? vb\.x : 0;/.test(visualTs), "focusNormalizedBBox deve considerar origem X do viewBox para centralizacao correta.");
assert(/const viewportY = vb && Number\.isFinite\(vb\.y\) \? vb\.y : 0;/.test(visualTs), "focusNormalizedBBox deve considerar origem Y do viewBox para centralizacao correta.");
assert(/getMaxInteractiveZoomScale/.test(visualTs), "zoom manual deve ter limite maximo dinamico e maior que o foco normalizado.");
assert(/vector-effect", "non-scaling-stroke"/.test(visualTs), "contornos devem usar non-scaling-stroke.");
assert(/applyLabelZoomCompensation/.test(visualTs), "visual.ts deve recalcular labels conforme zoom.");
assert(/data-sp-base-font-size/.test(visualTs), "labels devem armazenar font-size base.");
assert(/data-sp-base-stroke-width/.test(visualTs), "labels devem armazenar stroke-width base.");
assert(!/focusDrillDataAreas\(\): void \{[\s\S]{0,180}this\.selectedKeys\.size > 0/.test(visualTs), "foco de drill nao pode ser bloqueado por selecao antiga de outro nivel.");
assert(!/const selectedEls = this\.getSelectedRegionElementsForActiveMap\(\);\s*if \(selectedEls\.length > 0\) \{\s*this\.focusElements\(selectedEls\);\s*\} else \{\s*this\.resetToFit\(\);\s*\}\s*this\.scheduleFitToHost\(\);/.test(visualTs), "update nao deve aplicar resetToFit imediato antes do foco pendente de drill.");
assert(/private drillLoadingHost!?: HTMLDivElement/.test(visualTs) || /private drillLoadingHost/.test(visualTs), "visual.ts deve manter host de loading discreto do drill.");
assert(/createDrillLoadingHost/.test(visualTs), "visual.ts deve criar loading discreto do drill.");
assert(/showDrillLoading/.test(visualTs), "visual.ts deve mostrar loading ao iniciar transicao de drill.");
assert(/hideDrillLoading/.test(visualTs), "visual.ts deve esconder loading ao concluir ou cancelar transicao de drill.");
assert(/shouldBeginDrillFocusTransition/.test(visualTs), "visual.ts deve validar que a troca e um drill real antes de mostrar loading.");
assert(/const hasSvg = svgText\.length > 0;[\s\S]{0,900}shouldBeginDrillFocusTransition/.test(visualTs), "update deve decidir iniciar loading de drill somente depois de confirmar que ha SVG renderizavel.");
assert(/clearSvg\(preserveDrillFocus = false\): void \{[\s\S]{0,900}this\.hideDrillLoading\(\)/.test(visualTs), "clearSvg sem preservacao deve sempre desligar loading e restaurar interacao.");
assert(/prepareSvgForDrillReveal/.test(visualTs), "visual.ts deve preparar o novo SVG invisivel durante drill ate o fit final.");
assert(/revealDrillSvgAfterFit/.test(visualTs), "visual.ts deve revelar o SVG novo somente depois do fit final.");
assert(/prefers-reduced-motion/.test(visualTs), "transicao de drill deve respeitar reducao de movimento.");
assert(/beginDrillFocusTransition\(\): void \{[\s\S]{0,700}this\.showDrillLoading\(\)/.test(visualTs), "loading deve iniciar junto com a transicao de drill.");
assert(/completeDrillFocusTransition\(\): void \{[\s\S]{0,700}this\.revealDrillSvgAfterFit\(\)/.test(visualTs), "SVG final deve ser revelado ao concluir o foco de drill.");
assert(/cancelPendingDrillFocus\(\): void \{[\s\S]{0,900}this\.hideDrillLoading\(\)/.test(visualTs), "loading deve ser cancelado se a transicao de drill for cancelada.");
assert(/this\.clearSvg\(this\.pendingDrillFocus\)/.test(visualTs), "render deve preservar o mapa antigo enquanto drill esta pendente.");
assert(/hideTooltip\(\)[\s\S]{0,260}showDrillLoading\(\)/.test(visualTs), "transicao de drill deve limpar tooltip atual antes de mostrar loading.");
assert(/armPotentialDrillClickTransition/.test(visualTs), "clique que pode iniciar drill deve armar transicao preventiva para reduzir flicker no nivel atual.");
assert(/suppressSelectionFocusForPotentialDrill/.test(visualTs), "foco local da selecao deve poder ser suprimido enquanto o drill do host ainda nao atualizou.");
assert(/potentialDrillVisualKey/.test(visualTs), "clique candidato a drill deve manter chave visual temporaria para apagar outras areas sem confirmar selecao do host.");
assert(/getActiveVisualFocusKeys/.test(visualTs), "applySelectionVisualState deve usar foco visual temporario separado da selecao real.");
assert(/const visualFocusKeys = this\.getActiveVisualFocusKeys\(\);[\s\S]{0,180}const hasFocus = visualFocusKeys\.size > 0;/.test(visualTs), "estado visual deve considerar foco temporario de drill para opacidade local.");
assert(/if \(this\.suppressSelectionFocusForPotentialDrill\) \{[\s\S]{0,180}return;[\s\S]{0,80}\}/.test(visualTs), "applySelectionVisualState nao deve focar selecao local durante clique candidato a drill.");
assert(/potentialDrillFocusSuppressionMs/.test(visualTs), "clique candidato a drill deve usar uma janela explicita de supressao de foco local.");
assert(/potentialDrillSelectionVisualDelayMs\s*=\s*(?:1[0-9]{2}|2[0-9]{2})/.test(visualTs), "selecao normal em clique candidato a drill deve ter delay curto, nao timeout longo perceptivel.");
assert(/preFocusSourceOnDrill/.test(settingsTs), "settings.ts deve expor toggle reversivel para pre-foco no mapa origem do drill.");
assert(/preFocusPotentialDrillSource/.test(visualTs), "visual.ts deve pre-focar a area origem enquanto o proximo nivel carrega.");
const preFocusMethodStart = visualTs.indexOf("private preFocusPotentialDrillSource");
const preFocusMethodEnd = visualTs.indexOf("private selectRow", preFocusMethodStart);
assert(preFocusMethodStart >= 0 && preFocusMethodEnd > preFocusMethodStart, "preFocusPotentialDrillSource deve ficar antes de selectRow.");
const preFocusMethodBody = visualTs.slice(preFocusMethodStart, preFocusMethodEnd);
assert(/this\.potentialDrillVisualKey = row\.key;[\s\S]{0,180}this\.applySelectionVisualState\(\);/.test(preFocusMethodBody), "pre-foco de drill deve aplicar opacidade local temporaria sem confirmar selecao real.");
assert(/this\.focusElements\(\[el\]\)/.test(preFocusMethodBody), "pre-foco de drill deve reutilizar foco normal de uma area.");
const preFocusSelectRowBody = visualTs.slice(visualTs.indexOf("private selectRow(row:"), visualTs.indexOf("private selectRows", visualTs.indexOf("private selectRow(row:")));
assert(/if \(deferPotentialDrillSelection\) \{[\s\S]{0,260}this\.armPotentialDrillClickTransition\(\);[\s\S]{0,260}this\.preFocusPotentialDrillSource\(row\);/.test(preFocusSelectRowBody), "clique candidato a drill deve iniciar pre-foco antes de aguardar o host trocar de nivel.");
const potentialDrillClickBody = visualTs.slice(
  visualTs.indexOf("private armPotentialDrillClickTransition"),
  visualTs.indexOf("private getRegionElementForRow", visualTs.indexOf("private armPotentialDrillClickTransition"))
);
assert(!/applySelectionVisualState\(/.test(potentialDrillClickBody), "timer de clique candidato a drill nao deve reaplicar foco local no nivel anterior.");
assert(/flushPotentialDrillSelection/.test(visualTs), "selecao candidata a drill deve poder ser aplicada cedo quando o host nao troca de nivel.");
const selectRowBody = visualTs.slice(
  visualTs.indexOf("private selectRow("),
  visualTs.indexOf("private selectRows(")
);
assert(/deferPotentialDrillSelection/.test(selectRowBody), "clique candidato a drill deve adiar estado visual local para evitar piscada de opacidade no nivel anterior.");
assert(!/if \(potentialDrillClick[\s\S]{0,1200}applyLocalSelection\(\);[\s\S]{0,260}selectionManager/.test(selectRowBody), "clique candidato a drill nao deve aplicar selecao local otimista antes do host confirmar o nivel.");
assert(/sp-drill-loading/.test(visualLess), "visual.less deve estilizar o loading discreto do drill.");
assert(/@keyframes\s+sp-drill-spinner/.test(visualLess), "visual.less deve animar spinner local sem recursos externos.");
assert(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(visualLess), "CSS deve respeitar reducao de movimento.");

console.log("Interaction, editor, drill and label override regression checks passed.");
