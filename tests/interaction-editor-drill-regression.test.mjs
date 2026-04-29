import fs from "node:fs";
import assert from "node:assert/strict";

const capabilities = JSON.parse(fs.readFileSync("capabilities.json", "utf8"));
const settingsTs = fs.readFileSync("src/settings.ts", "utf8");
const visualTs = fs.readFileSync("src/visual.ts", "utf8");
const dialogTs = fs.readFileSync("src/MapEditorDialog.ts", "utf8");
const resolverTs = fs.readFileSync("src/drillMapResolver.ts", "utf8");
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
assert(/canExposeEditorUi/.test(visualTs), "visual deve centralizar regra de exposicao do editor.");
assert(/canShowEditorButton/.test(visualTs), "visual deve centralizar regra de visibilidade do botao Editor.");
const canExposeEditorStart = visualTs.indexOf("private canExposeEditorUi");
const canExposeEditorEnd = visualTs.indexOf("private canShowEditorButton", canExposeEditorStart);
const canExposeEditorBody = visualTs.slice(canExposeEditorStart, canExposeEditorEnd);
assert(/canShowSvgPickerUI\(\)/.test(canExposeEditorBody), "botao Editor deve continuar bloqueado fora do Desktop.");
assert(!/isAdvancedEditMode/.test(canExposeEditorBody), "botao Editor deve aparecer no Desktop normal; Advanced Edit nao deve ser exigido para o botao.");
assert(/setEditorButtonVisibility\(hasSvgConfigured: boolean,\s*options\?: VisualUpdateOptions/.test(visualTs), "visibilidade do botao Editor deve receber options.");
assert(/tabIndex\s*=\s*show \? 0 : -1/.test(visualTs), "botao Editor oculto nao deve ser focavel.");
assert(/aria-hidden/.test(visualTs), "botao Editor deve atualizar aria-hidden.");
assert(!/right:\s*"110px"/.test(visualTs), "botao Editor nao deve ficar no canto superior direito.");
assert(!/opacity:\s*"0\.55"/.test(visualTs), "botao Editor nao deve ser translucido.");
assert(/\.sp-toolbar[\s\S]*left:\s*8px/.test(visualLess) || /\.sp-editor-open[\s\S]*left:\s*8px/.test(visualLess), "toolbar do editor deve ficar no canto superior esquerdo.");
assert(/\.sp-editor-open/.test(visualLess), "botao Editor deve ter classe CSS dedicada.");
assert(/dialogRegistry/.test(dialogTs), "MapEditorDialog.ts deve registrar o dialogo globalmente.");
assert(/class\s+MapEditorDialog\b/.test(dialogTs), "MapEditorDialog.ts deve exportar a classe do dialogo.");
assert(/createButton\(/.test(dialogTs) && /createIcon\(/.test(dialogTs), "MapEditorDialog.ts deve montar botoes compactos com icones inline.");
assert(/buildSvgEditorOverlay/.test(dialogTs), "MapEditorDialog.ts deve oferecer overlay interno para editar o SVG.");
assert(/createButton\("SVG", "svg"/.test(dialogTs), "a tela detalhada deve expor um botao SVG.");
const detailViewStart = dialogTs.indexOf("private buildDetailView");
const detailViewEnd = dialogTs.indexOf("const main = document.createElement", detailViewStart);
const detailHeader = dialogTs.slice(detailViewStart, detailViewEnd);
assert(/createButton\("SVG", "svg"/.test(detailHeader), "Tela de edicao deve criar botao SVG no header.");
assert(/headerActions\.append\(svgBtn\)/.test(detailHeader) || /headerActions\.append\([^)]*svgBtn/.test(detailHeader), "Botao SVG deve estar no header da tela de edicao.");
assert(!/createButton\("Drill Path"/.test(detailHeader), "Tela de edicao nao deve manter Drill Path no header.");
assert(!/previewToolbar\.appendChild\(svgBtn\)/.test(dialogTs), "Botao SVG nao deve ficar dentro da toolbar do preview.");
assert(!/this\.createButton\("Metadata"/.test(dialogTs), "Tela de mapa nao deve expor botao Metadata.");
assert(!/openMetadataEditor\(shell\)/.test(dialogTs), "Botao Metadata nao deve ser aberto por nenhuma acao do header.");
assert(!/textContent\s*=\s*"Drill To"/.test(dialogTs), "Inspector de area nao deve exibir aba/campo Drill To.");
assert(!/data-editor-area-drill-map/.test(dialogTs), "Tela de edicao de area nao deve controlar drillToMapId; isso fica no Drill Path.");
assert(!/area\.drillToMapId\s*=\s*drillToMapId\s*\|\|\s*undefined/.test(dialogTs), "applyAreaInputs nao pode limpar drillToMapId ao salvar area sem aba Drill To.");
assert(!/this\.createButton\("Export"/.test(dialogTs), "Editor nao deve expor botao Export.");
assert(!/exportActiveMapSvg/.test(dialogTs), "Logica de export deve ser removida.");
assert(!/downloadTextFile/.test(dialogTs), "Fallback por download deve ser removido.");
assert(!/showSaveFilePicker/.test(dialogTs), "Editor nao deve usar File System Access API.");
assert(!/ExportContent/.test(JSON.stringify(capabilities)), "Visual nao deve declarar privilege ExportContent.");
assert(!/tryCopyText\(stringifyManifest\(this\.manifest\)\)/.test(dialogTs), "Editor nao deve copiar manifesto por fluxo de Export.");
assert(/scrollAreaListToAreaId/.test(dialogTs), "Clique no mapa deve ajustar areaListScrollTop para a area selecionada.");
assert(/this\.areaSearch\s*=\s*""/.test(dialogTs), "Clique no mapa deve limpar busca para garantir que area selecionada apareca na lista.");
assert(/data-editor-area-list/.test(dialogTs), "Lista de areas deve ter seletor de teste.");
assert(/data-editor-area-id/.test(dialogTs), "Rows de area devem expor data-editor-area-id.");
assert(/this\.createButton\("Editar"/.test(dialogTs) || /this\.createButton\("Edit"/.test(dialogTs), "Tela inicial deve manter botao Editar.");
assert(/openDrillPathEditor\(shell,\s*"preview"\)/.test(dialogTs), "Botao Drill Path deve abrir preview.");
assert(/openDrillPathEditor\(shell,\s*"config"\)/.test(dialogTs), "Atalho Config. Drill deve abrir configuracao do Drill Path.");
assert(!/const configBtn[\s\S]{0,600}viewMode\s*=\s*"detail"/.test(dialogTs), "Botao de Configuracao do Drill nao deve abrir tela de edicao do mapa.");
assert(/findEditorAreaKeyBySvgId/.test(dialogTs), "Clique no mapa deve resolver id do SVG para chave logica da area.");
assert(/data-editor-svg-area/.test(dialogTs), "Areas do SVG no editor devem ser marcadas para clique interativo.");
assert(/pointerdown[\s\S]{0,160}stopPropagation/.test(dialogTs), "Areas interativas devem impedir conflito com pan do viewport.");
assert(/onSelectArea\?\.\(logicalAreaId\)/.test(dialogTs), "Clique no mapa deve selecionar a area logica, nao apenas o id bruto do SVG.");
assert(/const levelInput = shell\.querySelector<HTMLInputElement>\("\[data-editor-browser-map-level='1'\]"\);\s*if \(levelInput\)/.test(dialogTs), "level do metadata so deve ser sobrescrito quando o input existir no DOM atual.");
assert(/const drillPathInput = shell\.querySelector<HTMLInputElement>\("\[data-editor-browser-map-path='1'\]"\);\s*if \(drillPathInput\)/.test(dialogTs), "drillPath do metadata so deve ser sobrescrito quando o input existir no DOM atual.");
assert(/const defaultInput = shell\.querySelector<HTMLInputElement>\("\[data-editor-browser-default='1'\]"\);\s*if \(defaultInput\)/.test(dialogTs), "mapa padrao so deve ser reavaliado quando o checkbox de metadata existir no DOM atual.");
assert(/allowMapUploads/.test(dialogTs), "MapEditorDialog.ts deve suportar upload de mapas condicionado ao host.");
assert(/addMapMenuOpen/.test(dialogTs), "Botao Add deve controlar menu suspenso.");
assert(/buildAddMapMenu/.test(dialogTs), "Editor deve renderizar menu suspenso do Add.");
assert(/Colar texto SVG/.test(dialogTs), "Menu Add deve permitir colar SVG manualmente.");
assert(/Importar arquivo SVG/.test(dialogTs), "Menu Add deve manter importacao local existente.");
assert(/svgCreateEditorOpen/.test(dialogTs), "Editor deve ter modal de criacao de mapa por SVG colado.");
assert(/buildSvgCreateOverlay/.test(dialogTs), "Editor deve ter overlay para criar mapa a partir de texto SVG.");
assert(/createMapFromSvgText/.test(dialogTs), "Criacao de mapas por arquivo e texto deve usar helper unico.");
assert(/sanitizeSvgMarkup\(rawSvgText\)/.test(dialogTs), "Novo mapa criado por texto/arquivo deve sanitizar SVG antes de salvar.");
assert(/this\.manifest\.maps\.push/.test(dialogTs), "Salvar SVG colado deve adicionar mapa ao manifesto.");
assert(/this\.selectedMapId\s*=\s*mapId/.test(dialogTs), "Mapa criado por SVG deve ser selecionado imediatamente.");
assert(/Nenhum mapa configurado/.test(dialogTs), "o browser deve suportar estado vazio para adicionar mapa.");
assert(/sp-editor-svg-overlay/.test(dialogTs) && /sp-editor-svg-modal/.test(dialogTs), "o editor de SVG deve usar overlay/modal interno.");
assert(/classList\.add\("is-create"\)/.test(dialogTs) || /sp-editor-svg-modal\.is-create/.test(visualLess), "Tela de Add SVG deve ter layout proprio.");
assert(/closeFloatingMenus/.test(dialogTs), "Editor deve ter helper para fechar menus flutuantes.");
assert(/data-editor-map-menu-trigger/.test(dialogTs), "Trigger do menu de mapa deve ser marcado para clique-fora.");
assert(/data-editor-add-menu-trigger/.test(dialogTs), "Trigger do menu Add deve ser marcado para clique-fora.");
assert(/closest\("\.sp-editor-map-action-menu"\)/.test(dialogTs), "Clique-fora deve preservar clique dentro do menu de mapa.");
assert(/closest\("\.sp-editor-add-map-menu"\)/.test(dialogTs), "Clique-fora deve preservar clique dentro do menu Add.");
assert(/is-open-up/.test(dialogTs), "Menus devem aplicar classe is-open-up quando nao houver espaco para baixo.");
assert(/const saveCloseBtn = this\.createButton\("Save & Close", "edit", \{ kind: "primary" \}\);[\s\S]{0,220}this\.closeWithPersist\(shell\)/.test(dialogTs), "a tela 1 deve permitir salvar e fechar sem entrar na tela detalhada.");
assert(/closeWithPersist\(shell\)/.test(dialogTs), "o dialogo deve centralizar o fluxo de persistencia ao fechar.");
assert(!/Metadados/.test(dialogTs), "a tela simplificada nao deve expor a aba Metadados no dialog principal.");
assert(!/data-editor-area-virtual-id/.test(dialogTs), "a tela simplificada nao deve expor ID virtual no inspector principal.");
assert(!/data-editor-area-aliases/.test(dialogTs), "a tela simplificada nao deve expor aliases no inspector principal.");
assert(!/data-editor-label-mode/.test(dialogTs), "a tela simplificada nao deve expor configuracoes de label no inspector principal.");
assert(/grid-template-columns:\s*minmax\(260px,\s*320px\)\s*minmax\(0,\s*1fr\)/.test(visualLess), "o browser do editor deve manter duas colunas.");
assert(/grid-template-columns:\s*minmax\(0,\s*1\.8fr\)\s*minmax\(360px,\s*460px\)/.test(visualLess), "a tela detalhada deve manter preview e sidebar em colunas separadas.");
assert(/grid-template-rows:\s*auto minmax\(0,\s*1fr\) minmax/.test(visualLess), "a sidebar detalhada deve reservar linha minima para inspector.");
assert(/\.sp-editor-inspector\s*\{[\s\S]*padding:\s*12px 14px 18px;/.test(visualLess), "o inspector deve ter folga inferior para nao clipar a borda.");
assert(/box-sizing:\s*border-box/.test(visualLess), "Paineis do editor devem usar box-sizing border-box para evitar corte de bordas.");
assert(!/sp-editor-detail-main[\s\S]{0,220}height:\s*100%/.test(visualLess), "detail-main nao deve usar height 100% que causa overflow com footer.");
assert(/sp-editor-inspector[\s\S]*margin-bottom:\s*2px/.test(visualLess), "Inspector deve ter respiro inferior para nao cortar borda.");
assert(/\.sp-editor-inspector-panel\s*\{[\s\S]*padding-bottom:\s*12px;/.test(visualLess), "o painel interno do inspector deve manter padding inferior suficiente.");
assert(/\.sp-editor-svg-overlay/.test(visualLess) && /\.sp-editor-svg-modal/.test(visualLess), "visual.less deve estilizar o modal interno do SVG.");
assert(/sp-editor-svg-modal[\s\S]*grid-template-rows:\s*auto auto minmax\(0,\s*1fr\) auto/.test(visualLess), "Editor SVG deve ter area de codigo flexivel e nao modal cortado.");
assert(/sp-editor-map-action-menu\.is-open-up/.test(visualLess), "CSS deve abrir menu de mapa para cima.");
assert(/sp-editor-add-map-menu\.is-open-up/.test(visualLess), "CSS deve abrir menu Add para cima.");
assert(/bottom:\s*calc\(100% \+ 8px\)/.test(visualLess), "Menu aberto para cima deve usar bottom calc.");
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
assert(/resolveDrillMap\(/.test(visualTs), "visual.ts deve delegar a resolucao de mapa para a funcao pura resolveDrillMap.");
assert(/currentDrillValuePath/.test(resolverTs), "DrillMapContext deve suportar caminho de valores para resolver mapas no drillUp.");
assert(/getCurrentDrillValuePath/.test(visualTs), "visual.ts deve extrair caminho de valores selecionados a partir das categorias do DataView.");
assert(/getSingleCategoryValue/.test(visualTs), "visual.ts deve detectar valor unico em categorias ancestrais do drill.");
assert(/currentDrillValuePath:\s*currentValuePath/.test(visualTs), "visual.ts deve passar currentDrillValuePath para resolveDrillMap.");
assert(/valuePathMatches/.test(resolverTs), "resolveDrillMap deve tentar drillPath por valores antes do drillPath legado por nomes de campos.");
assert(/categoryMatchScores/.test(resolverTs), "resolveDrillMap deve usar scores de IDs para desempatar mapas no mesmo level.");
assert(!/if \(levelMatches\.length > 0\) \{[\s\S]{0,220}return finish\(\s*levelMatches\[0\],\s*"level"/.test(resolverTs), "resolveDrillMap nao deve escolher levelMatches[0] sem tentar desempate por dados.");
assert(/pendingDrillSource/.test(visualTs), "visual.ts deve rastrear override pendente de area para o proximo nivel.");
assert(/findAreaDefinitionForRuntime/.test(visualTs), "visual.ts deve resolver area runtime por chave, id, virtualId, bindKey, displayName e aliases.");
assert(/getAreaManifestKeyForRuntime/.test(visualTs), "visual.ts deve conseguir recuperar a chave real do manifesto para area clicada.");
assert(/area\.id/.test(visualTs), "getBoundRowForElementId deve considerar id da area.");
assert(/area\.bindKey/.test(visualTs), "getBoundRowForElementId deve considerar bindKey da area.");
assert(/area\.aliases/.test(visualTs), "runtime deve considerar aliases da area.");
assert(!/sourceLevel:\s*Number\.isFinite\(this\.activeMap\.map\?\.level\)/.test(visualTs), "capturePendingDrillSource nao deve usar map.level como sourceLevel.");
assert(/sourceLevel:\s*this\.getCurrentDataDrillLevel\(\)/.test(visualTs), "pendingDrillSource deve capturar o nivel real do DataView.");
assert(/warnDrillRouteDiagnostic/.test(visualTs), "visual.ts deve ter diagnostico controlado para falha de rota de drill.");
assert(/drillContext:\s*\{[\s\S]{0,700}candidateMaps/.test(visualTs), "visual.ts deve enviar contexto real de drill para o modal.");
assert(/validateMapRegistryManifestIssues/.test(visualTs), "visual.ts deve usar validador com severidade para o manifesto.");
assert(/export function resolveDrillMap/.test(resolverTs), "drillMapResolver.ts deve exportar a funcao pura de resolucao.");
assert(/finish\(overrideMap,\s*"areaOverride"\)/.test(resolverTs), "resolveDrillMap deve suportar prioridade de override por area.");
assert(/advancedExactlyOneLevel/.test(resolverTs), "pendingDrillSource deve valer somente para o proximo nivel descendente imediato.");
assert(!/return context\.currentLevel > pending\.sourceLevel \|\| pathChanged/.test(resolverTs), "pendingDrillSource nao deve usar pathChanged como condicao positiva.");
assert(/finish\(\s*exactPathMatches\[0\],\s*"drillPath"/.test(resolverTs), "resolveDrillMap deve suportar prioridade por drillPath exato.");
assert(/best\.score > 0/.test(resolverTs), "resolveDrillMap deve desempatar mapas do mesmo level por score antes de usar ordem do manifesto.");
assert(/finish\(autoMatch\.map,\s*"automatch"\)/.test(resolverTs), "resolveDrillMap deve manter automatch como fallback antes do default.");
assert(/export type ValidationIssue/.test(resolverTs), "drillMapResolver.ts deve expor ValidationIssue com severidade.");
assert(/type\s+DrillPathScreen\s*=\s*"preview"\s*\|\s*"config"/.test(dialogTs), "Drill Path deve modelar Preview e Configuracao como telas separadas.");
assert(/private drillPathScreen:\s*DrillPathScreen/.test(dialogTs), "MapEditorDialog.ts deve armazenar a tela atual do Drill Path.");
assert(/buildDrillPathPage/.test(dialogTs), "Drill Path deve ser pagina interna do editor.");
assert(/buildDrillPathPageHeader/.test(dialogTs), "Drill Path deve ter header de pagina interna.");
assert(/buildDrillSummary/.test(dialogTs), "Drill Path deve ter resumo compartilhado entre telas.");
assert(/buildDrillPreviewScreen/.test(dialogTs), "Drill Path deve ter tela de preview separada.");
assert(/buildDrillConfigScreen/.test(dialogTs), "Drill Path deve ter tela de configuracao separada.");
assert(/buildDrillPreviewCard/.test(dialogTs), "Drill Path deve renderizar o card de preview por funcao dedicada.");
assert(/buildDrillConfigListCard/.test(dialogTs), "Drill Path deve renderizar a lista de configuracao por funcao dedicada.");
assert(/setDrillPathScreen/.test(dialogTs), "Drill Path deve alternar telas por estado, nao por scroll.");
assert(/updateDrillMappingFromSelect/.test(dialogTs), "Drill Path deve centralizar a atualizacao do select.");
assert(/__auto__/.test(dialogTs), "Select do Drill Path deve usar valor explicito para automatico.");
assert(/__none__/.test(dialogTs), "Select do Drill Path deve usar valor explicito para sem proximo nivel.");
assert(/drillMode/.test(dialogTs) && /drillMode/.test(resolverTs), "Drill Path deve persistir drillMode no manifesto e resolver.");
assert(/getCachedSvgModel\(activeMap\.svgText\)/.test(dialogTs), "Preview de geometria deve usar o SVG real do mapa ativo.");
assert(/svgAreaId\?: string/.test(dialogTs), "DrillPathPreviewMapping deve carregar o ID efetivo da area no SVG.");
assert(/getEffectiveSvgAreaId/.test(dialogTs), "Preview de geometria deve resolver id efetivo por virtualId/id/areaId.");
assert(/findSvgAreaElement/.test(dialogTs), "Preview de geometria deve localizar area por svgAreaId, id, virtualId e aliases.");
assert(/measureSvgElementBBoxInDom/.test(dialogTs), "Preview de geometria deve medir bbox com SVG temporariamente anexado ao DOM.");
assert(/getPreviewAreaBBox/.test(dialogTs), "Preview de geometria deve ter fallback robusto de bbox.");
assert(/createDrillGeometryEmpty/.test(dialogTs), "Preview de geometria deve ter fallback visual claro para erro.");
assert(/applyDrillGeometryHighlight/.test(dialogTs), "Preview de geometria deve centralizar destaque visual da area.");
assert(/sp-editor-svg-measure-sandbox/.test(dialogTs) || /sp-editor-svg-measure-sandbox/.test(visualLess), "Preview deve ter sandbox de medição SVG.");
assert(/getTransformedSvgBBox/.test(dialogTs), "Preview de geometria deve medir bbox transformado via getCTM.");
assert(/getCombinedTransformedSvgBBox/.test(dialogTs), "Preview de geometria deve combinar bboxes transformados.");
assert(/transformSvgPoint/.test(dialogTs), "Preview de geometria deve transformar pontos do bbox por matriz CTM.");
assert(/getCTM/.test(dialogTs), "Preview de geometria deve considerar transforms de ancestrais como <g transform>.");
assert(/measureSvgElementBBoxInDom\(svg,\s*selected\)/.test(dialogTs), "Preview deve medir bbox com SVG anexado ao DOM.");
assert(/Math\.max\(4,\s*Math\.max\(bbox\.width,\s*bbox\.height/.test(dialogTs), "Preview de geometria deve ter padding minimo para municipios pequenos.");
assert(
  !/const bbox = getRegionBBox\(target\);\s*if \(bbox\.width > 0 && bbox\.height > 0\) return bbox;[\s\S]{0,240}const raw = \(target as any\)\.getBBox/.test(dialogTs),
  "measureSvgElementBBoxInDom nao deve medir apenas bbox local; precisa tentar bbox transformado antes."
);
assert(/getCombinedPreviewTransformedBBox/.test(dialogTs), "createPreview deve calcular bbox transformado para SVGs com <g transform>.");
assert(/getPreviewElementTransformedBBox/.test(dialogTs), "createPreview deve considerar getCTM dos elementos.");
assert(/transformPreviewSvgPoint/.test(dialogTs), "Preview deve transformar pontos do bbox pelo CTM.");
assert(/parseSvgViewBox/.test(dialogTs), "Preview deve ter fallback para viewBox original.");
assert(!/const fitBBox = getCombinedRegionBBox\(liveRegions\);[\s\S]{0,240}cloned\.setAttribute\("viewBox"/.test(dialogTs), "createPreview nao deve aplicar viewBox usando apenas bbox local.");
assert(/fitBtn\.addEventListener\("click", \(\) => \{[\s\S]{0,160}scheduleFit\(\)/.test(dialogTs), "Botao Fit do preview deve recalcular o viewBox transform-aware.");
assert(/getRegionBBox\(selected/.test(dialogTs), "Preview de geometria deve enquadrar a area real selecionada.");
assert(/getRegionGeometryElements\(selected\)\.forEach/.test(dialogTs), "Preview de geometria deve aplicar destaque nas geometrias reais da area selecionada.");
assert(/current instanceof SVGElement/.test(dialogTs), "Preview de geometria deve garantir ancestrais visiveis da area selecionada.");
assert(
  !/find\(\(el\) => norm\(\(el as any\)\.id\) === norm\(mapping\.areaId\)\)/.test(dialogTs),
  "Preview nao deve procurar geometria apenas por mapping.areaId; deve usar svgAreaId/id/virtualId/aliases."
);
assert(!/sp-editor-overlay-modal sp-editor-drill-path-modal/.test(dialogTs), "Drill Path nao deve criar modal interna dentro da dialog oficial do Power BI.");
assert(!/private buildDrillPathOverlay/.test(dialogTs), "Drill Path deve ser pagina interna, nao overlay.");
assert(!/private applyDrillPathOverlay/.test(dialogTs), "Drill Path deve persistir alteracoes diretamente no estado, nao por varredura de overlay.");
assert(!/Auto Path Preview/.test(dialogTs), "Drill Path nao deve expor o preview tecnico antigo.");
assert(!/score\s+\$\{/.test(dialogTs), "Drill Path nao deve renderizar scores tecnicos.");
assert(/Preview do Mapeamento/.test(dialogTs), "Drill Path deve mostrar preview visual de mapeamento.");
assert(/sp-editor-drill-summary/.test(dialogTs), "Drill Path deve ter resumo visual do contexto atual.");
assert(/sp-editor-drill-flow/.test(dialogTs), "Drill Path deve ter fluxo visual de mapeamento.");
assert(/Configurar Proximo Nivel/.test(dialogTs), "Drill Path deve ter tela de configuracao por area.");
assert(/sp-editor-drill-config-table/.test(dialogTs), "Drill Path deve renderizar tabela de configuracao.");
assert(/Detalhes da Area/.test(dialogTs), "Drill Path deve renderizar painel de detalhes da area.");
assert(/data-drill-config-row/.test(dialogTs), "Drill Path deve renderizar linhas configuraveis por area.");
assert(/Voltar ao Preview/.test(dialogTs), "Drill Path deve ter acao para voltar ao preview.");
assert(/sp-editor-drill-geometry-preview/.test(dialogTs), "Drill Path deve ter preview de geometria da area.");
assert(!/Mapeamento em lote/.test(dialogTs), "Tela de configuracao do Drill Path nao deve mostrar Mapeamento em lote.");
assert(!/\["all",\s*"Todos"\]/.test(dialogTs), "Tela de configuracao nao deve manter filtro Todos.");
assert(!/\["manual",\s*"Manuais"\]/.test(dialogTs), "Tela de configuracao nao deve manter filtro Manuais.");
assert(!/\["automatic",\s*"Automaticos"\]/.test(dialogTs), "Tela de configuracao nao deve manter filtro Automaticos.");
assert(!/\["none",\s*"Sem proximo nivel"\]/.test(dialogTs), "Tela de configuracao nao deve manter filtro Sem proximo nivel.");
assert(/normalizeDrillSearchText/.test(dialogTs), "Busca da configuracao deve normalizar acentos, underscores e espacos.");
assert(/data-drill-search/.test(dialogTs), "Linhas da configuracao devem expor texto normalizado para busca.");
assert(/sp-editor-drill-config-empty/.test(dialogTs), "Busca deve mostrar estado vazio quando nenhuma area for encontrada.");
assert(/data-drill-config-search/.test(dialogTs), "Busca da configuracao do Drill Path deve ter seletor proprio.");
assert(/is-search-hidden/.test(dialogTs), "Busca da configuracao deve ocultar linhas filtradas com classe propria.");
assert(/classList\.toggle\("is-search-hidden"/.test(dialogTs), "applySearch deve alternar classe is-search-hidden.");
assert(!/row\.hidden\s*=\s*!visible/.test(dialogTs), "Busca nao deve depender de row.hidden.");
assert(/sp-editor-drill-config-row\.is-search-hidden/.test(visualLess), "CSS deve ocultar linhas filtradas.");
assert(/display:\s*none\s*!important/.test(visualLess), "Classe is-search-hidden deve vencer display grid.");
{
  const rowSearchBlock = dialogTs.match(/const setRowSearchText = \(\) => \{[\s\S]*?row\.setAttribute\("data-drill-search"[\s\S]*?\};/);
  assert(rowSearchBlock, "buildDrillConfigRow deve montar indice de busca por linha.");
  assert(!rowSearchBlock[0].includes("mapping.kind"), "Indice de busca nao deve incluir mapping.kind; AL nao pode bater em manual.");
  assert(!rowSearchBlock[0].includes("getDrillStatusLabel"), "Indice de busca nao deve incluir label de status.");
}
assert(/activeArea\?\.bindKey/.test(dialogTs), "Indice de busca deve considerar bindKey da area.");
assert(/activeArea\?\.displayName/.test(dialogTs), "Indice de busca deve considerar displayName da area.");
assert(/activeArea\?\.aliases/.test(dialogTs), "Indice de busca deve considerar aliases da area.");
assert(!/addField\("Proximo mapa"/.test(dialogTs), "Detalhes da Area nao deve mostrar Proximo mapa.");
assert(!/textContent = "Status"/.test(dialogTs), "Detalhes da Area nao deve mostrar Status.");
assert(!/Relacao de drilldown/.test(dialogTs), "Detalhes da Area nao deve mostrar Relacao de drilldown.");
assert(/Preview da geometria/.test(dialogTs), "Detalhes da Area deve manter preview da geometria.");
assert(/Mapa de origem/.test(dialogTs), "Detalhes da Area deve manter mapa de origem.");
assert(/buildDrillPathGraphModel/.test(dialogTs), "Preview deve ser baseado em grafo global.");
assert(/getDefaultPreviewRootMap/.test(dialogTs), "Preview global deve iniciar pelo defaultMapId.");
assert(!/buildDrillPathPreviewModel\(activeMap/.test(dialogTs), "Preview nao deve ser local ao activeMap.");
assert(/sp-editor-drill-branch-node/.test(dialogTs), "Preview deve renderizar nodes compactos de branch.");
assert(/sp-editor-drill-branch-dot/.test(dialogTs), "Preview deve usar dots circulares.");
assert(/sp-editor-drill-edge-trunk/.test(dialogTs) || /sp-editor-drill-edge-trunk/.test(visualLess), "Preview deve ter troncos para grupos de filhos.");
assert(/getDrillBranchColor/.test(dialogTs), "Preview deve ter cor estável por branch.");
assert(/assignDrillBranchColors/.test(dialogTs), "Preview deve atribuir cores por branch principal e propagar aos descendentes.");
assert(/applyDrillEdgeColor/.test(dialogTs), "Preview deve aplicar cor dinamica diretamente no SVG path.");
assert(/getDrillEdgeColor/.test(dialogTs), "Preview deve centralizar resolucao de cor de edges.");
assert(/getDrillNodeBranchColor/.test(dialogTs), "Preview deve centralizar resolucao de cor de nodes.");
assert(/getDrillBranchGroupColor/.test(dialogTs), "Preview deve detectar grupo que pode usar cor unica.");
assert(/style\.stroke/.test(dialogTs), "Cor de edge deve ser aplicada via style.stroke para nao ser sobrescrita pelo CSS.");
assert(/hexToRgba/.test(dialogTs), "Preview deve gerar halo dinamico por cor do branch.");
assert(/renderDrillGraphLevelMarkers/.test(dialogTs), "Preview deve renderizar marcadores dinamicos de nivel.");
assert(/buildDrillLayoutTree/.test(dialogTs), "Preview deve construir arvore de layout para respeitar hierarquia pai-filho.");
assert(/measureDrillLayoutTree/.test(dialogTs), "Preview deve medir subarvores para reservar espaco vertical.");
assert(/assignDrillLayoutPositions/.test(dialogTs), "Preview deve posicionar nodes por blocos de subarvore.");
assert(/branchOutX/.test(dialogTs), "Layout do preview deve separar ponto de saida do branch.");
assert(/branchOutY/.test(dialogTs), "Layout do preview deve alinhar saida do branch ao sublabel.");
assert(/estimateDrillTextWidth/.test(dialogTs), "Preview deve estimar largura do label para iniciar conexoes apos nome do mapa.");
assert(/measureDrillTextWidth/.test(dialogTs), "Preview deve medir texto para posicionar saida do branch apos nome do mapa.");
assert(/DRILL_BRANCH_EXIT_MAX_WIDTH/.test(dialogTs), "Preview deve limitar largura usada no branchOutX.");
assert(/branchOutX\s*=\s*labelX\s*\+/.test(dialogTs), "branchOutX deve ser calculado a partir do label renderizado.");
assert(/branchOutY\s*=\s*node\.labelSubtitleY/.test(dialogTs), "branchOutY deve alinhar com sublabel.");
assert(/hydrateDrillLayoutAnchors/.test(dialogTs), "Preview deve hidratar anchors de dot, entrada e saida.");
assert(/buildOrthogonalConnectorPath/.test(dialogTs), "Preview deve usar conectores ortogonais.");
assert(/buildRoundedOrthogonalPath/.test(dialogTs), "Preview deve usar helper de cotovelo ortogonal arredondado.");
assert(/buildRoundedSpineEntryPath/.test(dialogTs), "Preview deve arredondar entrada parent->spine.");
assert(/buildRoundedSpineOutletPath/.test(dialogTs), "Preview deve controlar saidas da spine para filhos.");
assert(/renderOrthogonalBranchGroup/.test(dialogTs), "Preview deve agrupar filhos com trunk/spine ortogonal.");
assert(/buildRoundedForkPath/.test(dialogTs), "Preview deve desenhar forks com path unico quando filhos compartilham cor.");
assert(/buildRoundedForkOutletPath/.test(dialogTs), "Preview deve arredondar saidas coloridas de forks com cores diferentes.");
assert(/buildRoundedForkStemPath/.test(dialogTs), "Preview deve ter helper para stem parent->junction do fork.");
assert(/junctionY/.test(dialogTs), "Fork deve usar junctionY explicito para alinhar dentes retos e curvos.");
assert(/renderMixedColorFork/.test(dialogTs), "Preview deve tratar forks com filhos de cores diferentes sem sobrepor paths completos.");
assert(/sp-editor-drill-edge-fork/.test(dialogTs) || /sp-editor-drill-edge-fork/.test(visualLess), "Preview deve ter classe de fork colorido.");
assert(/cornerRadius:\s*18/.test(dialogTs) || /cornerRadius\?\?\s*18/.test(dialogTs), "Cantos devem ter arredondamento mais visivel.");
assert(/elbowX/.test(dialogTs), "Preview deve usar elbowX comum para brace/trunk arredondado.");
assert(/getDrillBranchElbowX/.test(dialogTs), "Preview deve calcular elbowX comum para brace de filhos.");
assert(/rowGap\s*=\s*60/.test(dialogTs) || /rowGap\s*=\s*58/.test(dialogTs) || /rowGap\s*=\s*62/.test(dialogTs), "Preview deve usar espaçamento vertical mais compacto.");
assert(/branchGap\s*=\s*18/.test(dialogTs), "Preview deve reduzir branchGap para compactar layout.");
assert(/drillPreviewShowOptional/.test(dialogTs), "Preview deve ter toggle para automaticos e sem proximo nivel.");
assert(/drillPreviewMaxDepth/.test(dialogTs), "Preview deve ter limite defensivo de profundidade.");
assert(/normalizeDrillGraphForRender/.test(dialogTs) || /getReachableDrillNodeKeys/.test(dialogTs), "Preview deve remover/evitar nodes orfaos antes do render.");
assert(/getDrillGraphSignature/.test(dialogTs), "Preview deve detectar mudancas no grafo para resetar scroll/focus.");
assert(/drillPreviewLastGraphSignature/.test(dialogTs), "Preview deve memorizar assinatura do grafo renderizado.");
assert(/sp-editor-drill-level-header/.test(dialogTs) || /sp-editor-drill-level-sticky-layer/.test(dialogTs), "Headers de nivel devem ficar separados do canvas.");
assert(/translateX\(\$\{-[^}]*flowViewport\.scrollLeft\}px\)/.test(dialogTs), "Header fixo deve sincronizar scroll horizontal.");
assert(/updateDrillLevelHeaderPositions/.test(dialogTs), "Preview deve atualizar header de niveis sem depender de scale no transform.");
assert(/getDrillLevelMarkerX/.test(dialogTs), "Preview deve calcular marker X a partir das posicoes finais do layout.");
assert(/dataset\.levelIndex/.test(dialogTs), "Markers de nivel devem guardar levelIndex para reposicionamento robusto.");
assert(/drillPreviewZoom/.test(dialogTs), "Zoom do preview deve ser estado de classe.");
assert(/0\.35/.test(dialogTs) || /0\.4/.test(dialogTs), "Zoom out maximo deve permitir afastar mais que 0.7.");
assert(/computeFitScale/.test(dialogTs), "Preview do Drill Path deve calcular escala de fit.");
assert(/fitGraph/.test(dialogTs), "Preview do Drill Path deve reutilizar helper fitGraph.");
assert(/fitBtn\.addEventListener\("click"[\s\S]{0,200}fitGraph/.test(dialogTs), "Botao Fit deve usar fitGraph.");
assert(/requestAnimationFrame\(\(\) => \{[\s\S]{0,700}fitGraph\("auto"\)/.test(dialogTs), "Preview do Drill Path deve iniciar com fit automatico quando o grafo muda.");
assert(/drillPreviewLastGraphSignature/.test(dialogTs), "Preview deve usar assinatura do grafo para decidir quando reaplicar fit.");
assert(/focusDrillConfigArea/.test(dialogTs), "Clique no preview deve levar para configuracao da area.");
assert(/focusDrillConfigMap/.test(dialogTs), "Clique no nome do mapa no preview deve levar para configuracao das areas desse mapa.");
assert(/sp-editor-drill-branch-map-link/.test(dialogTs) && /sp-editor-drill-branch-map-link/.test(visualLess), "Nome do mapa no node deve ter affordance clicavel.");
assert(/event\.stopPropagation\(\);[\s\S]{0,120}this\.focusDrillConfigMap/.test(dialogTs), "Clique no nome do mapa nao deve disparar clique da area.");
assert(!/sp-editor-drill-preview-legend-bar/.test(dialogTs), "Preview nao deve renderizar legenda inferior.");
assert(/hasBlockingErrors/.test(dialogTs), "Preview deve bloquear aplicar em erros criticos.");
assert(/MAPA RAIZ/.test(dialogTs) || /Mapa raiz/.test(dialogTs), "Preview deve tratar root como mapa raiz.");
assert(/NÍVEL \$\{levelIndex\}/.test(dialogTs) || /NÍVEL/.test(dialogTs), "Preview deve renderizar marcadores dinamicos de nivel.");
assert(!/marker\.textContent\s*=\s*`NÍVEL \$\{level\.index \+ 1\}`/.test(dialogTs), "Markers nao devem contar root como nivel de drill.");
assert(/style\.strokeDasharray\s*=\s*"none"/.test(dialogTs), "Edges manuais devem limpar strokeDasharray para evitar tracejado indevido.");
assert(/edge\.kind\s*===\s*"manual"[\s\S]{0,200}strokeDasharray/.test(dialogTs), "applyDrillEdgeColor deve tratar manual como linha continua.");
assert(!/edge\.branchColor\s*\|\|\s*this\.getDrillBranchColor/.test(dialogTs), "Render manual nao deve recalcular cor por hash quando branchColor falta.");
assert(/Edge manual sem branchColor/.test(dialogTs), "Integridade deve detectar manual sem branchColor.");
assert(!/buildRoundedForkOutletPath[\s\S]{0,700}elbowX\s*-\s*r/.test(dialogTs), "Dente reto do fork nao deve começar em elbowX - r; deve começar no eixo do fork.");
assert(!/straight:\s*Math\.abs\(y - attachY\)/.test(dialogTs), "Fork nao deve depender de straight por attachY; usar junctionY.");
assert(!/Math\.abs\(toY - fromY\)\s*<\s*14/.test(dialogTs), "buildRoundedOrthogonalPath nao deve usar threshold 14px.");
assert(/Math\.abs\(toY - fromY\)\s*<\s*2/.test(dialogTs), "buildRoundedOrthogonalPath deve tratar apenas delta menor que 2px como horizontal.");
assert(
  /M \$\{args\.elbowX\} \$\{args\.y\} H \$\{args\.toX\}/.test(dialogTs) ||
  /M \$\{args\.elbowX - straightOverlap\} \$\{args\.y\} H \$\{args\.toX\}/.test(dialogTs) ||
  /M \$\{args\.elbowX\} \$\{args\.junctionY\}/.test(dialogTs),
  "Saidas do fork devem nascer no eixo do fork ou cobrir pequena junta reta controlada."
);
assert(/straightOverlap\s*=\s*Math\.min\(radius,\s*horizontal \/ 2,\s*18\)/.test(dialogTs), "Saida reta do primeiro fork deve voltar o suficiente para cobrir gap branco.");
assert(!/translateX\(\$\{-flowViewport\.scrollLeft\}px\) scale\(\$\{flowScale\}\)/.test(dialogTs), "Header de niveis nao deve usar scale no transform; deve recalcular left por zoom.");
assert(!/levelHeaderInner\.style\.transform\s*=\s*`[^`]*scale/.test(dialogTs), "Header de niveis nao deve aplicar scale direto no layer.");
assert(!/sp-editor-drill-edge-spine/.test(dialogTs) || /display:\s*none/.test(visualLess) || /opacity:\s*0/.test(visualLess), "Spine tracejada nao deve ficar visivel em branches manuais.");
assert(/sp-editor-drill-edge-trunk/.test(dialogTs) || /sp-editor-drill-edge-trunk/.test(visualLess), "Preview deve desenhar tronco de ramificacao.");
assert(/H \$\{/.test(dialogTs) || / V \$\{/.test(dialogTs), "Conectores devem usar linhas ortogonais.");
assert(/Q \$\{/.test(dialogTs) || / Q /.test(dialogTs), "Conectores ortogonais devem arredondar cantos com Q curto.");
assert(
  !/buildDrillPreviewCard[\s\S]*setAttribute\("d",\s*`[^`]*\sC\s/.test(dialogTs),
  "Drill Path Preview nao deve usar curvas Bezier cubicas."
);
assert(
  !/buildRoundedSpineOutletPath[\s\S]*return\s*`M \$\{args\.trunkX\} \$\{args\.fromY\} H \$\{args\.toX\}`/.test(dialogTs),
  "Saida principal da spine nao deve ser só linha horizontal sem canto arredondado."
);
assert(
  !/childPath\.setAttribute\(\s*"d",\s*`M \$\{[^}]*trunkX[^`]* H \$\{[^`]*\}`/.test(dialogTs),
  "Path principal para filho deve sair do parent com cotovelo arredondado."
);
assert(
  !/childPoints\.forEach[\s\S]{0,500}buildRoundedOrthogonalPath\(\{[\s\S]{0,200}fromX,[\s\S]{0,200}fromY,[\s\S]{0,200}elbowX/.test(dialogTs),
  "Fork multi-filho nao deve desenhar path completo parent->child para cada filho; usar buildRoundedForkPath/renderMixedColorFork."
);
assert(
  !/level\.nodes\.map\(\(node,\s*index\)[\s\S]{0,240}y:\s*marginY\s*\+\s*index\s*\*\s*rowGap/.test(dialogTs),
  "layoutDrillGraph nao deve posicionar por indice independente dentro do nivel."
);
assert(!/Ver mais/.test(dialogTs), "Toggle Mostrar automáticos deve mostrar tudo, sem 'Ver mais'.");
assert(!/isCollapsedSummary/.test(dialogTs), "Preview nao deve usar summary node para automaticos.");
assert(!/hiddenCount/.test(dialogTs), "Preview nao deve colapsar automaticos com hiddenCount.");
assert(/\.sp-editor-drill-page/.test(visualLess), "CSS deve estilizar a pagina interna do Drill Path.");
assert(/\.sp-editor-drill-preview-screen/.test(visualLess), "CSS deve estilizar a tela de preview do Drill Path.");
assert(/\.sp-editor-drill-config-screen/.test(visualLess), "CSS deve estilizar a tela de configuracao do Drill Path.");
assert(/\.sp-editor-drill-config/.test(visualLess), "CSS deve estilizar a configuracao do Drill Path.");
assert(/\.sp-editor-drill-details/.test(visualLess), "CSS deve estilizar o painel de detalhes do Drill Path.");
assert(/\.sp-editor-drill-graph-canvas/.test(visualLess), "CSS deve estilizar canvas do grafo do drill.");
assert(/\.sp-editor-drill-graph-node/.test(visualLess), "CSS deve estilizar nodes do grafo do drill.");
assert(/\.sp-editor-drill-branch-node/.test(visualLess), "CSS deve estilizar nodes compactos de branch.");
assert(/\.sp-editor-drill-branch-dot/.test(visualLess), "CSS deve estilizar dot circular de branch.");
assert(/\.sp-editor-drill-edge-trunk/.test(visualLess), "CSS deve estilizar tronco de agrupamento.");
assert(/\.sp-editor-drill-edge-fork/.test(visualLess), "CSS deve estilizar fork colorido.");
assert(/\.sp-editor-drill-level-marker/.test(visualLess), "CSS deve estilizar marcador dinamico de nivel.");
assert(/\.sp-editor-drill-level-header/.test(visualLess) || /\.sp-editor-drill-level-sticky-layer/.test(visualLess), "CSS deve estilizar header fixo dos niveis.");
assert(/\.sp-editor-drill-graph-scale-host/.test(visualLess), "CSS deve estilizar host de escala para zoom correto.");
assert(/--drill-branch-halo/.test(visualLess), "CSS deve usar halo dinamico por cor do branch.");
assert(/sp-editor-drill-branch-label[\s\S]{0,180}background:\s*transparent/.test(visualLess), "Container do label nao deve ter fundo branco que apaga linhas.");
assert(/width:\s*max-content/.test(visualLess) || /display:\s*inline-grid/.test(visualLess), "Label deve ocupar apenas texto visivel.");
assert(
  !/\.sp-editor-drill-graph-node\s*\{[\s\S]{0,220}width:\s*220px;[\s\S]{0,260}box-shadow:\s*0 8px 20px/.test(visualLess),
  "Nodes do preview nao devem voltar a ser cards grandes."
);
assert(
  !/box-shadow:\s*0 0 0 4px rgba\(59,\s*130,\s*246,\s*0\.14\)/.test(visualLess),
  "Dot manual nao pode ter halo azul fixo."
);
assert(!/Associacao Visual/.test(dialogTs), "Drill Path nao deve mais expor associacao visual por nivel/path.");
assert(!/Associar nivel atual/.test(dialogTs), "Drill Path nao deve mais expor botao legado de associacao por nivel.");
assert(!/data-drill-path-map-row/.test(dialogTs), "Drill Path nao deve mais gravar level/drillPath por linha de mapa.");
assert(/data-drill-path-area-target/.test(dialogTs), "Drill Path deve manter edicao de branch/override por area.");
assert(/getDrillRouteForRow/.test(visualTs), "clique em area deve usar helper source-aware por row.");
assert(/this\.getDrillRouteForRow\(row\)/.test(visualTs), "event delegation deve resolver rota de drill a partir da area clicada.");
assert(!/hasNextDrillMapForCurrentLevel/.test(visualTs), "clique de drill nao deve depender de detector global por level.");
assert(/shouldSuppressHostSelectionForUnmappedDrill/.test(visualTs), "visual deve suprimir host select quando area sem rota e drill nativo ativo.");
assert(/suppressHostSelect/.test(visualTs), "selectRow deve aceitar opcao para nao chamar selectionManager.select.");
assert(/applyLocalRowSelection/.test(visualTs), "visual deve aplicar selecao local sem acionar host drill.");
assert(/canHostDrillControls/.test(visualTs), "visual deve separar controles nativos de drill da permissao de drilldown por clique.");
assert(/canHostDrillUp/.test(visualTs), "visual deve rastrear drill up para manter controles nativos em niveis profundos.");
assert(/lastSetCanDrillValue/.test(visualTs), "visual deve evitar chamadas repetidas desnecessarias a setCanDrill.");
assert(/getCurrentResolvedLevel/.test(visualTs), "visual deve usar nivel resolvido por path e mapa ativo.");
assert(/activeMapHasExplicitNextDrillTarget/.test(visualTs), "visual deve detectar se mapa ativo tem proximo drill explicito.");
assert(/setCanDrill\.call\(this\.host,\s*shouldEnableDrillControls\)/.test(visualTs), "setCanDrill deve receber estado dos controles nativos, nao apenas canDrillDown.");
assert(!/const canDrillDown\s*=\s*!isDrillDisabled\s*&&/.test(visualTs), "isDrillDisabled nao pode impedir reabilitar drill via setCanDrill(true).");
assert(!/setCanDrill\.call\(this\.host,\s*canDrillDown\)/.test(visualTs), "setCanDrill nao deve usar canDrillDown direto.");
assert(/canDisableDrill/.test(JSON.stringify(capabilities.drilldown || {})), "capabilities.json deve declarar canDisableDrill para controle dinamico de drill.");
assert(!/disabledByDefault/.test(JSON.stringify(capabilities.drilldown || {})), "capabilities.json nao deve iniciar drill desabilitado por padrao.");
assert(/requireExplicitDrillPath/.test(resolverTs), "resolver deve bloquear fallback por level em branch sem drillPath explicito.");
assert(!/if \(levelMatches\.length > 0\) \{[\s\S]{0,300}return finish\(\s*levelMatches\[0\],\s*"level"/.test(resolverTs), "resolver nao pode escolher mapa por level antes de respeitar requireExplicitDrillPath.");
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
assert(/shouldPruneSvgToDrillDataScope\(\): boolean \{[\s\S]{0,420}noDataBehavior === "Hide"/.test(visualTs), "poda fisica do SVG so deve ocorrer quando areas sem dado estiverem configuradas para ocultar.");
assert(/computeRenderScope\(\): RenderScopeState \{[\s\S]{0,520}noDataBehavior === "Hide"/.test(visualTs), "renderScope nao deve esconder areas sem dado quando noDataBehavior for Fade.");
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
assert(/openMapActionMenuId/.test(dialogTs), "Editor deve armazenar qual menu de acoes de mapa esta aberto.");
assert(/renamingMapId/.test(dialogTs), "Editor deve suportar edicao inline do nome do mapa.");
assert(/buildMapActionMenu/.test(dialogTs), "Editor deve ter menu de acoes por mapa.");
assert(/deleteMapById/.test(dialogTs), "Exclusao de mapa deve ser centralizada em helper reutilizavel.");
assert(/Editar nome/.test(dialogTs), "Menu do mapa deve permitir editar nome.");
assert(/Excluir/.test(dialogTs), "Menu do mapa deve permitir excluir.");
assert(!/defaultView\?\.confirm/.test(dialogTs), "Excluir mapa nao deve depender de window.confirm dentro do iframe do Power BI.");
assert(!/row\.append\(body,\s*this\.createIcon\("overflow"\)\)/.test(dialogTs), "Overflow nao pode ser so icone decorativo; precisa ser botao com acao.");
assert(/stopPropagation\(\)/.test(dialogTs), "Clique no menu deve parar propagacao para nao selecionar o mapa.");
assert(/sp-editor-map-action-menu/.test(visualLess), "CSS deve estilizar o menu de acoes do mapa.");
assert(/sp-editor-map-item-shell/.test(visualLess), "CSS deve suportar estrutura de item com botao principal e botao de acoes.");
assert(/\.sp-editor-map-actions\s*\{[\s\S]{0,220}position:\s*absolute;[\s\S]{0,220}right:\s*12px;/.test(visualLess), "Botao de acoes deve ficar visualmente dentro do card do mapa.");
assert(/\.sp-editor-map-action-menu\s*\{[\s\S]{0,220}position:\s*absolute;/.test(visualLess), "Menu de acoes deve flutuar sem empurrar itens da lista.");
assert(!/\.sp-editor-map-action-menu\s*\{[\s\S]{0,120}grid-column:\s*1 \/ -1;/.test(visualLess), "Menu de acoes nao deve ocupar linha do grid e empurrar a lista.");
assert(/\.sp-editor-map-item-shell\.is-menu-open\s*\{[\s\S]{0,120}z-index:\s*(?:[5-9]\d|\d{3,});/.test(visualLess), "Card com menu aberto deve criar stacking acima dos botoes de cards vizinhos.");
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
assert(/updateHostDrillState/.test(visualTs), "visual deve ler metadata.dataRoles.drillableRoles e sincronizar permissao de drill.");
assert(/setCanDrill/.test(visualTs), "visual deve informar ao host quando drill down esta permitido.");
assert(/drillableRoles\?\.category/.test(visualTs), "visual deve consultar drillableRoles.category para saber se o drill nativo esta ativo.");
assert(/if \(!this\.canHostDrillDown\) return null;/.test(visualTs), "visual nao deve criar rota de drill quando o drill nativo do Power BI esta desligado.");
assert(/const hostReportsDrillDown\s*=[\s\S]{0,220}drillTypes\.includes\(2\)/.test(visualTs), "visual deve ler drillableRoles do host para saber quando drill down esta disponivel.");
assert(/const shouldEnableDrillControls\s*=[\s\S]{0,260}this\.canHostDrillUp[\s\S]{0,260}this\.canHostDrillDown/.test(visualTs), "controles nativos devem continuar habilitados em niveis profundos para preservar drill up.");
assert(/currentLevel > 0/.test(visualTs), "visual deve manter controles de drill quando esta dentro da hierarquia.");
assert(!/this\.triggerHostDrillDown\(\);/.test(visualTs), "clique comum em area nao deve chamar host.drill automaticamente; isso fura o drill mode nativo.");
assert(/clearPotentialDrillClickState/.test(visualTs), "visual deve limpar estado pendente de drill quando nao houver drill real.");
assert(/getDrillNavigationDirection/.test(visualTs), "visual deve detectar subida\/descida para limpar pendingDrillSource corretamente.");
const preFocusSelectRowStart = visualTs.indexOf("private selectRow(");
const preFocusSelectRowBody = visualTs.slice(preFocusSelectRowStart, visualTs.indexOf("private selectRows", preFocusSelectRowStart));
assert(/if \(deferPotentialDrillSelection && drillRoute\) \{[\s\S]{0,360}this\.armPotentialDrillClickTransition\(\);[\s\S]{0,360}this\.preFocusPotentialDrillSource\(row\);/.test(preFocusSelectRowBody), "clique candidato a drill deve iniciar pre-foco antes de aguardar o host trocar de nivel.");
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
assert(/selectionManager[\s\S]{0,140}\.select\(row\.identity as any,\s*multiSelect\)[\s\S]{0,220}this\.deferPotentialDrillSelection/.test(selectRowBody), "clique candidato a drill deve selecionar datapoint e agendar fallback visual sem chamar host.drill.");
assert(!/if \(potentialDrillClick[\s\S]{0,1200}applyLocalSelection\(\);[\s\S]{0,260}selectionManager/.test(selectRowBody), "clique candidato a drill nao deve aplicar selecao local otimista antes do host confirmar o nivel.");
assert(/sp-drill-loading/.test(visualLess), "visual.less deve estilizar o loading discreto do drill.");
assert(/@keyframes\s+sp-drill-spinner/.test(visualLess), "visual.less deve animar spinner local sem recursos externos.");
assert(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(visualLess), "CSS deve respeitar reducao de movimento.");

console.log("Interaction, editor, drill and label override regression checks passed.");
