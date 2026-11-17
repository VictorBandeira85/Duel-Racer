"""Posto sem a coluna da esquerda (artes antigas: só a coluna da direita junto das bombas): copia a
coluna da direita (mesma altura, mesma luz vinda da esquerda) para perto da ponta esquerda da
cobertura, como nas artes novas (savana, cânion, selva à noite).
Uso: python3 tools/ref/gas_left_column.py <png> [...]   (edita no lugar)
"""
import sys

import numpy as np
from PIL import Image

LEFT = 58  # x da borda esquerda da coluna nova (432 px de largura): entre a ponta da cobertura e o freezer


def dark(p):
    return int(p[0]) + int(p[1]) + int(p[2]) < 150


for path in sys.argv[1:]:
    im = np.array(Image.open(path).convert('RGBA'))
    H, W = im.shape[:2]
    # coluna da direita: mesmo lugar em todas as artes antigas (mesmo enquadramento), medido no
    # posto da cidade de dia (contornos em x 322 e 343, do capitel em 103 à base em 215)
    x0, x1, y0, y1 = 322, 343, 104, 216
    col = im[y0 - 1:y1 + 1, x0:x1 + 1].copy()
    # só o que está entre os contornos de cada linha (o fundo de trás da coluna não vem junto)
    out = im.copy()
    out[y0 - 1:y1 + 1, LEFT:LEFT + col.shape[1]] = col
    Image.fromarray(out).save(path, optimize=True)
    print(path, '->', LEFT)
