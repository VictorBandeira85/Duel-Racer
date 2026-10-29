# Sprites dos carros e das cabines

Os sprites do F40 e do 959 (lateral, traseira, frente e cabine) vêm da pixel art
enviada pelo Victor, importada por `tools/ref/import_art.py` (carros) e
`tools/ref/import_cockpit.py` (painel + volante, que gira separado).

A pixel art foi feita a partir de fotos de terceiros; antes de publicar o jogo,
confirmar que o resultado é arte própria o bastante (ou refazer).

Os outros seis carros (Diablo, ZR-1, Testarossa, Countach, NSX e Viper) são desenhados
por código em `tools/art/` (`sides.py`, `rears.py`, `interiors.py`; rodar `tools/art/build.sh`).
Os arquivos `*-mask.png` marcam a carroceria, usada pela troca de cor no jogo; as do
F40 e do 959 saem de `tools/ref/body_mask.py`.

## Vidros (regra para todo carro)

Vidro nunca fica branco: depois de gerar os sprites, `tools/ref/glass_fix.py` troca o branco que
sobra dentro da silhueta (metade de cima, fora da máscara de pintura) por vidro azul-acinzentado.
Os scripts de sprites de cada carro já chamam `fix_glass` no fim; para rodar em tudo:
`python3 tools/ref/glass_fix.py src/assets/cars`.
