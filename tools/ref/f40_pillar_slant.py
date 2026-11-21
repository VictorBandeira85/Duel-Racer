"""Fúria F4: a borda de dentro da coluna A (o friso claro e a borracha do para-brisa) vinha cortada numa
reta vertical (o recorte do vidro foi um retângulo), enquanto o lado de fora da coluna desce inclinado.
Aqui o friso inteiro (as 8 colunas da borda) anda para a esquerda linha a linha, na inclinação da coluna
(0,15 px por linha a partir do pé, no painel), e o que sobra à direita vira vidro. Depois de f40_cockpit2.py.
Uso: python3 tools/ref/f40_pillar_slant.py src/assets/cockpit
"""
import os
import sys

import numpy as np
from PIL import Image

DIR = sys.argv[1]
top = np.array(Image.open(os.path.join(DIR, 'f40-top.png')).convert('RGBA'))
dash = np.array(Image.open(os.path.join(DIR, 'f40-dash.png')).convert('RGBA'))
st = np.concatenate([top, dash])
FOOT, SLOPE, BAND = 102, 0.15, 8


def right_edge(y):
    al = st[y, 30:120, 3] > 0
    xs = np.nonzero(al)[0]
    # fim do primeiro trecho opaco depois de x 40 (a coluna)
    run = [x for x in xs if x + 30 >= 40]
    if not run:
        return None
    e = run[0]
    while e + 1 < len(al) and al[e + 1]:
        e += 1
    return e + 30


r12 = right_edge(12)
d12 = max(0, int(round(r12 - (85 - SLOPE * (FOOT - 12)))))
for y in range(4, FOOT):
    r = right_edge(y)
    if r is None:
        continue
    d = d12 if y < 12 else max(0, int(round(r - (85 - SLOPE * (FOOT - y)))))
    if d <= 0:
        continue
    band = st[y, r - BAND + 1:r + 1].copy()
    st[y, r - d + 1:r + 1, 3] = 0
    st[y, r - BAND + 1 - d:r + 1 - d] = band
top2, dash2 = st[:top.shape[0]], st[top.shape[0]:]
Image.fromarray(top2).save(os.path.join(DIR, 'f40-top.png'), optimize=True)
Image.fromarray(dash2).save(os.path.join(DIR, 'f40-dash.png'), optimize=True)
print('deslocamento no alto', d12)
