"""Jornada Sport: luz de ré apagada (depois do voyagesport_sprites.py). Na arte a lente da ré, ao lado da
placa, saiu cor de pêssego e parecia uma lanterna acesa o tempo todo; vira lente clara de vidro (branco
acinzentado, o sombreado da arte pelo brilho). O pisca fica na parte de fora da faixa de cima (sigRear).
Uso: python3 tools/ref/voyagesport_reverse.py src/assets/cars/br-voyagesport-rear.png
"""
import colorsys
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
for y, x in zip(ys, xs):
    l = L[y, x]
    nl = min(0.92, 0.42 + l * 0.55)  # vidro claro, apagado
    rr, gg, bb = colorsys.hls_to_rgb(0.6, nl, 0.12)
    a[y, x, :3] = (rr * 255, gg * 255, bb * 255)
print('pixels', len(ys))
Image.fromarray(a).save(p, optimize=True)
