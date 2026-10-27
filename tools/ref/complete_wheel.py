"""Completa um volante cortado na borda de baixo da tela (o painel só tem 124 linhas).

Girado, o corte aparecia como se faltasse a parte de baixo. O aro é redondo: a metade de
baixo vem da de cima pela simetria em torno do centro (sem a marca colorida das 12 h, que
iria parar nas 6 h); os raios e o miolo continuam na direção radial até encontrar o aro.

Uso: python3 tools/ref/complete_wheel.py <volante.png> <centro_x> <centro_y> [--so-aro]
  --so-aro: não prolonga raios (volantes só com raios laterais, como o do 959)
"""
import sys

import numpy as np
from PIL import Image

path, px, py = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
only_rim = '--so-aro' in sys.argv
im = np.array(Image.open(path).convert('RGBA'))
H, W = im.shape[:2]
op = im[..., 3] > 0
cx = int(round(px))
# raios do aro: topo na coluna do centro, borda esquerda na linha do centro
col = np.where(op[:, cx])[0]
y_top = col.min()
ry_o = py - y_top
y = y_top
while y < H and op[y, cx]:
    y += 1
ry_i = py - y
row = np.where(op[int(round(py)), :])[0]
rx_o = px - row.min()
rx_i = rx_o * ry_i / ry_o
H2 = int(np.ceil(py + ry_o + 3))
if H2 <= H:
    print('já está inteiro', path)
    sys.exit()
out = np.zeros((H2, W, 4), np.uint8)
out[:H] = im


def is_mark(c):  # marca colorida do aro (amarela/laranja/vermelha), não deve ir para baixo
    r, g, b = int(c[0]), int(c[1]), int(c[2])
    return max(r, g, b) - min(r, g, b) > 60


for y in range(H, H2):
    for x in range(W):
        dx, dy = x - px, y - py
        q_o = (dx / rx_o) ** 2 + (dy / ry_o) ** 2
        q_i = (dx / rx_i) ** 2 + (dy / ry_i) ** 2
        if q_o > 1.08:
            continue
        if q_i >= 0.92:  # aro: ponto oposto em relação ao centro
            sx, sy = int(round(2 * px - x)), int(round(2 * py - y))
            if 0 <= sx < W and 0 <= sy < H and op[sy, sx]:
                c = im[sy, sx]
                k = 1
                while is_mark(c) and k < 12:  # pula a marca: usa o aro ao lado
                    for s in (k, -k):
                        if 0 <= sx + s < W and op[sy, sx + s] and not is_mark(im[sy, sx + s]):
                            c = im[sy, sx + s]
                            break
                    k += 1
                out[y, x] = c
        elif not only_rim:  # raios / miolo: continua pelo mesmo raio a partir da última linha da arte
            t = (H - 1 - py) / dy
            sx, sy = int(round(px + dx * t)), H - 1
            if 0 <= sx < W and op[sy, sx]:
                qs = ((sx - px) / rx_i) ** 2 + ((sy - py) / ry_i) ** 2
                if qs < 0.92:
                    out[y, x] = im[sy, sx]
Image.fromarray(out, 'RGBA').save(path)
print(path, (W, H2), 'aro', round(rx_o, 1), round(ry_o, 1), round(rx_i, 1), round(ry_i, 1))
