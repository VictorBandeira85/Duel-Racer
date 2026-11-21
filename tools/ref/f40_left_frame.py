"""Fúria F4: o friso fino da janela à esquerda (o que desce em diagonal até a borda) sumia num retângulo em volta
do retrovisor (o recorte do vidro do retrovisor levou a borda direita dele). Aqui ele continua até a borda da tela
na mesma inclinação, copiando o perfil de cor do trecho de cima (linhas 80..88). Depois de f40_cockpit2.py.
Uso: python3 tools/ref/f40_left_frame.py src/assets/cockpit
"""
import os
import sys

import numpy as np
from PIL import Image

DIR = sys.argv[1]
top = np.array(Image.open(os.path.join(DIR, 'f40-top.png')).convert('RGBA'))
dash = np.array(Image.open(os.path.join(DIR, 'f40-dash.png')).convert('RGBA'))
st = np.concatenate([top, dash])


def redge(y):
    al = np.nonzero(st[y, :30, 3] > 0)[0]
    return al.max() if len(al) else None


# inclinação medida no trecho bom (linhas 60..88)
ys = np.arange(60, 89)
rs = np.array([redge(y) for y in ys], float)
k, b = np.polyfit(ys, rs, 1)
prof = [st[86, redge(86) - i].copy() for i in range(10)]   # perfil do friso a partir da borda direita
n = 0
for y in range(89, 140):
    R = int(round(k * y + b))
    if R < 0:
        break
    for i in range(10):
        x = R - i
        if x < 0:
            break
        if st[y, x, 3] == 0:
            st[y, x] = prof[i]
            n += 1
Image.fromarray(st[:top.shape[0]]).save(os.path.join(DIR, 'f40-top.png'), optimize=True)
Image.fromarray(st[top.shape[0]:]).save(os.path.join(DIR, 'f40-dash.png'), optimize=True)
print('inclinação', round(k, 3), 'pixels', n)
