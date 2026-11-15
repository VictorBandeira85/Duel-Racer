"""Posto de cada mapa (arte do Victor, 1536 x 1024) -> src/assets/gas/gas-<tema>-<day|night>.png,
30% maior que gas_screen.py (posto centrado na tela: as laterais largas levam no máximo uma cópia
espelhada da borda; bomba e carro em proporção mais real). Mesmo enquadramento em todas as artes.
Uso: python3 tools/ref/gas_theme.py <tema> <day|night> <arte.png> [...]
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import gas_screen  # noqa: E402

gas_screen.K *= 1.3
OUT, shrink = gas_screen.OUT, gas_screen.shrink

args = sys.argv[1:]
for i in range(0, len(args), 3):
    theme, when, src = args[i:i + 3]
    o = shrink(src)
    Image.fromarray(o).save(os.path.join(OUT, f'gas-{theme}-{when}.png'), optimize=True)
    print(theme, when, o.shape[1], 'x', o.shape[0])
