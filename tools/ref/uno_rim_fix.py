"""Unão Turbo: apaga o disco do volante antigo que sobrava por fora do aro do jogo
(br-uno-dash.png). Cada linha, fora da elipse do aro (95 x 90,3 em 231,5/91,2), recebe o painel
limpo logo além do disco (colunas 121-122 à esquerda, 341-342 à direita). Rodar uma vez sobre a
arte importada: python3 tools/ref/uno_rim_fix.py src/assets/cockpit/br-uno-dash.png
"""
import sys
import numpy as np
from PIL import Image

P = sys.argv[1]
a = np.array(Image.open(P).convert('RGBA'))
H, W = a.shape[:2]
cx, cy, rx, ry = 231.5, 91.2, 95.0, 90.3
L, R = 122, 341
out = a.copy()
for y in range(H):
    for x in range(L + 1, R):
        if np.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) <= 0.995:
            continue
        s1, s2 = (a[y, L], a[y, L - 1]) if x < cx else (a[y, R], a[y, R + 1])
        out[y, x] = s1 if s1[3] == 0 else ((s1.astype(int) + s2.astype(int)) // 2).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(P)
