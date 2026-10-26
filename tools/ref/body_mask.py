"""Máscara da carroceria (onde a cor do carro pode ser trocada) a partir da arte.

Pixels no matiz da carroceria, agrupados em manchas ligadas; manchas pequenas (lanternas,
detalhes) ficam de fora. Uso: python3 tools/ref/body_mask.py <png> <matiz0> <matiz1> [area_min]
(matiz em graus; matiz0 > matiz1 dá a volta, ex.: 345 15 para vermelho)
"""
import sys

import cv2
import numpy as np
from PIL import Image

src, h0, h1 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
amin = int(sys.argv[4]) if len(sys.argv) > 4 else 40
im = np.array(Image.open(src).convert('RGBA'))
hsv = cv2.cvtColor(im[..., :3], cv2.COLOR_RGB2HSV_FULL).astype(float)
hue = hsv[..., 0] * 360 / 256
inh = (hue >= h0) | (hue <= h1) if h0 > h1 else (hue >= h0) & (hue <= h1)
m = (inh & (hsv[..., 1] > 110) & (hsv[..., 2] > 50) & (im[..., 3] > 0)).astype(np.uint8)
n, lab, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=4)
keep = np.zeros(n, bool)
keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= amin
mask = keep[lab]
Image.fromarray((mask * 255).astype(np.uint8)).convert('1').save(src.replace('.png', '-mask.png'))
print(src, int(mask.sum()), 'px')
