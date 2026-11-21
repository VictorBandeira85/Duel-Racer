"""Vetor GSi (lateral): tira o resto de mato escuro grudado na quina da tampa do porta-malas (uma faixa de 3 px
verde-escura acima da lanterna) e deixa só o contorno escuro de 1 px. Depois de vectra_sprites.py.
Uso: python3 tools/ref/vectra_side_fix.py src/assets/cars/br-vectra-side.png
"""
import sys

import numpy as np
from PIL import Image

p = sys.argv[1]
a = np.array(Image.open(p).convert('RGBA'))
dark = np.array([22, 22, 30, 255], np.uint8)
a[38:57, 391:394, 3] = 0                       # faixa de mato além do contorno
a[38:57, 390] = dark                           # contorno da quina
row = a[38, 370:391]
g = (row[:, 1].astype(int) > row[:, 0].astype(int) + 8)
row[g] = dark                                  # topo da tampa: o verde vira contorno
Image.fromarray(a).save(p, optimize=True)
m = p.replace('.png', '-mask.png')
mk = np.array(Image.open(m).convert('RGBA'))
mk[38:57, 391:394] = 0
Image.fromarray(mk).save(m, optimize=True)
