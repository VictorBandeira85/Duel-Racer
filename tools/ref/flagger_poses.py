"""Folha do sinaleiro de obra (3 poses lado a lado em fundo magenta) -> src/assets/obra/<nome>-<0|1|2>.png
Corta pelas colunas vazias entre as poses, tira o magenta e reduz pegando o pixel do meio de cada
bloco até ALTO px (todas as poses na mesma escala, pés na mesma linha).
Uso: python3 tools/ref/flagger_poses.py <folha.png> <nome>
"""
import os
import sys

import numpy as np
from PIL import Image

ALTO = 150  # altura da pessoa (sem a bandeira erguida) na saída
src, name = sys.argv[1], sys.argv[2]
a = np.array(Image.open(src).convert('RGB')).astype(int)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
key = (r > 150) & (b > 150) & (g < 0.6 * np.minimum(r, b)) & (np.abs(r - b) < 90)
solid = ~key
cols = solid.sum(0) > 2
# grupos de colunas com conteúdo (as poses); junta grupos separados por vãos pequenos
runs, x = [], 0
W = a.shape[1]
while x < W:
    if cols[x]:
        x0 = x
        while x < W and cols[x]:
            x += 1
        if runs and x0 - runs[-1][1] < 4:
            runs[-1][1] = x
        else:
            runs.append([x0, x])
    x += 1
runs = [r_ for r_ in runs if r_[1] - r_[0] > 60]
assert len(runs) == 3, runs
# escala única: pela altura do corpo (do capacete aos pés) da pose 0
ys = np.where(solid[:, runs[0][0]:runs[0][1]].any(1))[0]
k = ALTO / (ys.max() - ys.min() + 1)
foot = max(np.where(solid[:, x0:x1].any(1))[0].max() for x0, x1 in runs)
top = min(np.where(solid[:, x0:x1].any(1))[0].min() for x0, x1 in runs)
for i, (x0, x1) in enumerate(runs):
    crop, m = a[top:foot + 1, x0:x1], key[top:foot + 1, x0:x1]
    H, Wc = crop.shape[:2]
    oh, ow = round(H * k), round(Wc * k)
    yy = ((np.arange(oh) + 0.5) * H / oh).astype(int)
    xx = ((np.arange(ow) + 0.5) * Wc / ow).astype(int)
    out = np.dstack([crop[yy][:, xx], np.where(m[yy][:, xx], 0, 255)]).astype(np.uint8)
    p = os.path.join('src/assets/obra', f'{name}-{i}.png')
    Image.fromarray(out, 'RGBA').save(p, optimize=True)
    print(p, ow, 'x', oh)
