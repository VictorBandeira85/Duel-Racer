"""Tira a franja magenta (resto do recorte dos vidros pintados de magenta na arte) das bordas da cabine:
só pixels rosados ou roxo-escuros a até 2 px de um vidro (transparência). Cada um vira a mediana dos
vizinhos opacos não rosados (o alfa fica).
Uso: python3 tools/ref/magenta_fringe.py br-vectra   (ou br-kadett), depois do script da cabine e do edge_build."""
import sys

import cv2
import numpy as np
from PIL import Image

ID = sys.argv[1] if len(sys.argv) > 1 else 'br-vectra'
for n in ('dash', 'top', 'wheel'):
    f = f'src/assets/cockpit/{ID}-{n}.png'
    a = np.array(Image.open(f).convert('RGBA'))
    i = a.astype(int)
    lo = np.minimum(i[..., 0], i[..., 2])
    pink = ((i[..., 0] > i[..., 1] + 25) & (i[..., 2] > i[..., 1] + 25)
            | (lo >= 8) & (i[..., 1] * 2.5 < lo)) & (i[..., 3] > 0)   # e a franja escura (roxo quase preto)
    near = cv2.dilate((i[..., 3] < 255).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    pink &= near
    good = ~pink & (i[..., 3] > 200)
    h, w = pink.shape
    out = a.copy()
    for y, x in zip(*np.nonzero(pink)):
        for r in (1, 2, 3, 4):
            ys, xs = slice(max(0, y - r), y + r + 1), slice(max(0, x - r), x + r + 1)
            g = good[ys, xs]
            if g.sum() >= 2:
                out[y, x, :3] = np.median(a[ys, xs][g][:, :3], axis=0).astype(np.uint8)
                break
        else:
            out[y, x, 3] = 0
    Image.fromarray(out, 'RGBA').save(f, optimize=True)
    print(n, int(pink.sum()), 'pixels')
