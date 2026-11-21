"""Helicóptero da polícia (folha do Victor sobre magenta: de trás à esquerda, de frente à direita) ->
src/assets/heli/heli-rear.png e heli-front.png, na mesma escala (largura do maior = 160 px), recortados do
magenta e reduzidos pela cor do miolo de cada bloco (oficina_art). O jogo desenha as pás do rotor principal
girando a partir da cabeça do rotor (HELI_HUB em src/heli.ts, medida aqui).
Uso: python3 tools/ref/heli_art.py <folha.png>
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from oficina_art import cut, reduce  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/heli')
a = np.array(Image.open(sys.argv[1]).convert('RGB'))
H, W = a.shape[:2]
boxes = []
for name, (c0, c1) in [('rear', (0, W // 2)), ('front', (W // 2, W))]:
    part = a[:, c0:c1]
    aa, obj = cut(part)
    ys, xs = np.nonzero(obj)
    boxes.append((name, aa, obj, ys.min(), ys.max() + 1, xs.min(), xs.max() + 1))
f = max(b[6] - b[5] for b in boxes) / 160
for name, aa, obj, y0, y1, x0, x1 in boxes:
    o = reduce(aa[y0:y1, x0:x1], obj[y0:y1, x0:x1], f)
    Image.fromarray(o).save(os.path.join(OUT, f'heli-{name}.png'), optimize=True)
    # cabeça do rotor: a linha mais alta com pixels, no meio
    al = o[..., 3] > 0
    top = np.nonzero(al.any(1))[0][0]
    print(name, o.shape[1], 'x', o.shape[0], 'fator', round(f, 3), 'topo', top)
