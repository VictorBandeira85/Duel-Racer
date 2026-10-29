"""Cadete GSi: alavancas de seta e limpador fixas no painel e sem borrão atrás do volante.

- As pontas das alavancas vinham dentro do PNG do volante (giravam com ele): passam para o
  painel, na posição de repouso, e saem do volante.
- Atrás do volante (abaixo do visor digital) a importação deixou um borrão cinza; vira a capa
  da coluna de direção escura com o painel liso em volta.
Uso: kadett_wheel_fix.py src/assets/cockpit (rodar uma vez sobre a arte importada)
"""
import os
import sys
import numpy as np
from PIL import Image

d = sys.argv[1]
wp, dp = os.path.join(d, 'br-kadett-wheel.png'), os.path.join(d, 'br-kadett-dash.png')
w = np.array(Image.open(wp).convert('RGBA'))
a = np.array(Image.open(dp).convert('RGBA'))
H = a.shape[0]
PAD = 102
cx, cy, rx, ry = 229.9, 105.7, 80.0, 91.5  # aro interno (coordenadas do painel)
yy, xx = np.mgrid[0:H, 0:a.shape[1]]
inside = ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 < 1

# 1) borrão atrás do volante: painel liso escuro + capa da coluna
zone = inside & (yy >= 85)
base = np.array([34, 34, 37])
for y in range(85, H):
    k = (y - 85) / (H - 85)
    row = zone[y]
    a[y, row, :3] = (base * (1 - 0.25 * k)).astype(np.uint8)
    a[y, row, 3] = 255
# capa da coluna: trapézio central com borda de cima clara
for y in range(92, H):
    half = 26 + (y - 92) * 0.35
    x0, x1 = int(round(cx - half)), int(round(cx + half))
    a[y, x0:x1, :3] = (22, 22, 24)
    a[y, x0, :3] = (48, 48, 52)
    a[y, x1 - 1, :3] = (14, 14, 15)
a[92, int(cx - 26):int(cx + 26), :3] = (58, 58, 62)
a[93, int(cx - 26):int(cx + 26), :3] = (40, 40, 44)

# 2) alavancas: tudo o que é opaco nas caixas das pontas, dentro do aro, sai do volante e vai
# para o painel no mesmo lugar (volante em repouso)
moved = 0
for (x0, x1) in ((50, 84), (184, 206)):
    for y in range(83, 101):
        for x in range(x0, x1):
            X = x + PAD
            if not inside[y, X] or w[y, x, 3] == 0:
                continue
            al = w[y, x, 3] / 255
            a[y, X, :3] = (w[y, x, :3] * al + a[y, X, :3] * (1 - al)).astype(np.uint8)
            w[y, x, 3] = 0
            moved += 1
Image.fromarray(w).save(wp)
Image.fromarray(a).save(dp)
print('alavancas:', moved, 'px; painel refeito:', int(zone.sum()))
