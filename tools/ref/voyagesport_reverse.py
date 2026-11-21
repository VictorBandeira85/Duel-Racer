"""Jornada Sport: luz de ré apagada (depois do voyagesport_sprites.py). Na arte a lente da ré, ao lado da
placa, saiu cor de pêssego e parecia uma lanterna acesa o tempo todo. No Voyage Sport de verdade a faixa
de cima da lanterna é toda fumê (cinza): a lente da ré vira o mesmo cinza da faixa (sombreado da arte pelo
brilho, tons tirados da própria faixa). A ré só acenderia dando ré; o pisca acende nas extremidades (sigRear).
Uso: python3 tools/ref/voyagesport_reverse.py src/assets/cars/br-voyagesport-rear.png
"""
import sys

import numpy as np
from PIL import Image

p = sys.argv[1]
a = np.array(Image.open(p).convert('RGBA'))
H, W = a.shape[:2]
rgb = a[..., :3].astype(float) / 255
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
# pêssego/laranja claro da lente (R alto, G médio, B baixo), só na faixa de cima da lanterna
warm = (r > 0.45) & (r - b > 0.2) & (g > 0.25) & (g < r) & (a[..., 3] > 0)
band = np.zeros((H, W), bool)
band[int(H * 0.44):int(H * 0.53)] = True
m = warm & band
ys, xs = np.nonzero(m)
L = (rgb.max(-1) + rgb.min(-1)) / 2
# paleta da faixa fumê ao lado (pixels não pretos da mesma faixa, fora da lente), do escuro ao claro
smoke = band & ~m & (a[..., 3] > 0) & (L > 0.1) & (L < 0.5) & (np.abs(r - b) < 0.15)
pal = np.array(sorted({tuple(int(c) for c in v) for v in a[smoke][:, :3]}, key=lambda c: sum(c)))
lo, hi = L[m].min(), L[m].max()
for y, x in zip(ys, xs):
    t = (L[y, x] - lo) / max(1e-3, hi - lo)
    a[y, x, :3] = pal[int(round(t * 0.85 * (len(pal) - 1)))]
print('pixels', len(ys))
Image.fromarray(a).save(p, optimize=True)
