"""Vetor GSi: tira a franja magenta (resto do recorte dos vidros da 3ª arte) das bordas da cabine.
Cada pixel rosado vira a mediana dos vizinhos opacos não rosados (o alfa fica).
Rodar depois do vectra_cockpit.py e do edge_build.py."""
import numpy as np
from PIL import Image

for n in ('dash', 'top', 'wheel'):
    f = f'src/assets/cockpit/br-vectra-{n}.png'
    a = np.array(Image.open(f).convert('RGBA'))
    i = a.astype(int)
    pink = (i[..., 0] > i[..., 1] + 25) & (i[..., 2] > i[..., 1] + 25) & (i[..., 3] > 0)
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
