# Certificacao - SVGs de teste

Os SVGs abaixo foram montados com IDs que batem com a coluna "Curral" da tabela de exemplo.
Use-os para validar o mapeamento e a sanitizacao do visual.

Arquivos:
- svg/00-safe-basic.svg (apenas IDs validos)
- svg/01-script-onload.svg (script/onload/onclick devem ser removidos)
- svg/02-external-image.svg (apenas data:image/png deve ficar)
- svg/03-style-url.svg (so url(#...) deve ficar)
- svg/04-disallowed-tags.svg (foreignObject/iframe devem ser removidos)

Observacao: o visual usa o ID do elemento SVG para cruzar com "Curral".

Caso de uso adicional:
- O modo `Gradient` usa a medida atual para calcular a cor final de cada area sem alterar a sanitizacao do SVG.

Para submissao:
- sample PBIX final deve usar mesma versao do `.pbiviz` submetido;
- sample deve funcionar offline;
- sample deve incluir pagina final `Hints & Tips`;
- pagina `Hints & Tips` pode ser baseada em `docs/sample-hints-and-tips.md`.
