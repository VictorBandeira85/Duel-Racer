"""Onça GTB: retrovisor apoiado na carroceria (depois do pumagtb_cockpit.py). Na arte o retrovisor fica
solto no vidro: aparecia a estrada entre a carcaça e a porta e entre a carcaça e a chapa vermelha da
coluna. Aqui: a fresta da direita vira chapa vermelha (cor da chapa ao lado, linha a linha) e a faixa
embaixo do retrovisor vira a base escura dele, assentada na borracha da porta.
Uso: python3 tools/ref/pumagtb_mirror_base.py src/assets/cockpit/br-pumagtb-dash.png
"""
import sys

import numpy as np
from PIL import Image

p = sys.argv[1]
d = np.array(Image.open(p).convert('RGBA'))
a = d[..., 3] > 0
H, W = a.shape
# fresta entre a carcaça (x >= 76) e a chapa da coluna
for y in range(26, 75):
    xs = [x for x in range(74, 100) if not a[y, x]]
    for x in xs:
        L = next((x - k for k in range(1, 12) if x - k >= 70 and a[y, x - k]), None)
        R = next((x + k for k in range(1, 14) if x + k < W and a[y, x + k]), None)
        if L is None or R is None:
            continue
        d[y, x] = d[y, R]
        d[y, x, 3] = 255
a = d[..., 3] > 0
# base embaixo do retrovisor: do aro de baixo até a borracha da porta
for x in range(22, 92):
    col = a[:, x]
    bot = next((y for y in range(70, 40, -1) if col[y] and not col[y + 1]), None)  # fim do aro
    if bot is None or bot < 55:
        continue
    door = next((y for y in range(bot + 1, min(H, bot + 14)) if col[y]), None)
    if door is None:
        continue
    for y in range(bot + 1, door):
        t = (y - bot) / max(1, door - bot)
        d[y, x, :3] = (52, 48, 58) if t < 0.5 else (34, 32, 40)
        d[y, x, 3] = 255
    d[bot + 1, x, :3] = (18, 16, 20)  # contorno do aro
Image.fromarray(d).save(p, optimize=True)
