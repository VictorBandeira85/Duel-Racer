"""Vetor GSi (lateral): tira o resto de mato escuro grudado na quina da tampa do porta-malas (uma faixa de 3 px
verde-escura acima da lanterna) e deixa só o contorno escuro de 1 px; a cunha escura da quina vira lataria e a ponta é arredondada. Depois de vectra_sprites.py.
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
# quina de cima da tampa: a cunha escura (x 385-389, y 39-42) vira lataria, o contorno fica com 1-2 px
# como no resto da borda, e a ponta é arredondada
L1, L2, L3 = (185, 182, 217, 255), (215, 213, 242, 255), (195, 190, 224, 255)
a[40, 385:389] = L1
a[41, 385:389] = L2
a[42, 388] = L3
a[42, 389] = dark
a[38, 390, 3] = 0
Image.fromarray(a).save(p, optimize=True)
m = p.replace('.png', '-mask.png')
mk = np.array(Image.open(m).convert('RGBA'))
mk[38:57, 391:394] = 0
mk[40:42, 385:389] = (255, 255, 255, 255)   # a lataria nova da quina entra na pintura
mk[42, 388] = (255, 255, 255, 255)
Image.fromarray(mk).save(m, optimize=True)
