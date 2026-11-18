"""Posto dos mapas na segunda leva de arte do Victor (1672 x 941: cobertura larga, duas ilhas de bombas e
a loja à direita, pista na frente) -> src/assets/gas/gas-<tema>-<day|night>.png. Mesma redução de
gas_screen.py (cor do miolo de cada bloco), na escala em que a bomba fica da altura das outras artes.
O enquadramento no jogo é GAS_LAYOUT.wide em src/screens.ts (ilha da direita: guia em y 662, visor em
1050,543 na arte).
Uso: python3 tools/ref/gas_theme2.py <tema> <day|night> <arte.png> [...]
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import gas_screen  # noqa: E402

gas_screen.K = 0.28
args = sys.argv[1:]
for i in range(0, len(args), 3):
    theme, when, src = args[i:i + 3]
    o = gas_screen.shrink(src)
    Image.fromarray(o).save(os.path.join(gas_screen.OUT, f'gas-{theme}-{when}.png'), optimize=True)
    print(theme, when, o.shape[1], 'x', o.shape[0])
