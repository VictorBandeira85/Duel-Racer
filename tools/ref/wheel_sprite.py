"""Gera o sprite de um volante direto da arte do interior, no tamanho e centro que a
cabine do jogo já usa, e espelha a metade esquerda (volante simétrico).

Uso: python3 tools/ref/wheel_sprite.py <arte> <saida.png> <config>
Configurações abaixo: aro (centro e raios na arte), miolo e barra, e onde ele fica no jogo.
"""
import sys

import cv2
import numpy as np
from PIL import Image

CFG = {
    # Corvette C4: aro, miolo redondo com o emblema e a barra de um lado ao outro do aro
    'zr1': {
        'center': (583.5, 465), 'outer': (323, 322), 'inner': (280, 282),
        'hub': (583.5, 487, 108), 'bar': (250, 506, 920, 594),
        'pivot': (128, 86), 'rx': 72, 'ry': 81, 'size': (256, 170),
    },
}

src, out, key = sys.argv[1], sys.argv[2], sys.argv[3]
c = CFG[key]
img = cv2.cvtColor(cv2.imread(src), cv2.COLOR_BGR2RGB)
(cx, cy), (ao, bo), (ai, bi) = c['center'], c['outer'], c['inner']
hx, hy, hr = c['hub']
bx0, by0, bx1, by1 = c['bar']
pxw, pxh = ao / c['rx'], bo / c['ry']
W, H = c['size']
px, py = c['pivot']
spr = np.zeros((H, W, 4), np.uint8)
for Y in range(H):
    for X in range(W):
        sx, sy = cx + (X - px) * pxw, cy + (Y - py) * pxh
        qo = ((sx - cx) / ao) ** 2 + ((sy - cy) / bo) ** 2
        qi = ((sx - cx) / ai) ** 2 + ((sy - cy) / bi) ** 2
        rim = qo <= 1 and qi >= 1
        hub = (sx - hx) ** 2 + (sy - hy) ** 2 <= hr * hr
        bar = bx0 <= sx <= bx1 and by0 <= sy <= by1 and qo <= 1
        if rim or hub or bar:
            ix, iy = int(sx), int(sy)
            if 0 <= ix < img.shape[1] and 0 <= iy < img.shape[0]:
                spr[Y, X, :3] = img[iy, ix]
                spr[Y, X, 3] = 255
# contorno escuro onde o miolo/barra termina sobre a abertura (o recorte da arte não pega a linha)
op = spr[..., 3] > 0
edge = op[:-1] & ~op[1:]
for Y, X in zip(*np.where(edge)):
    sx, sy = cx + (X - px) * pxw, cy + (Y - py) * pxh
    if ((sx - cx) / ai) ** 2 + ((sy - cy) / bi) ** 2 < 0.97:
        spr[Y, X, :3] = (20, 20, 22)
# simetria: a metade direita é o espelho da esquerda
for X in range(px + 1, W):
    m = 2 * px - X
    if 0 <= m < W:
        spr[:, X] = spr[:, m]
Image.fromarray(spr, 'RGBA').save(out)
print(out, (W, H))
