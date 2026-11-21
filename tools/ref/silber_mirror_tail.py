"""Silber 95: a borda de baixo da carcaça do retrovisor esquerdo vinha com uma segunda linha clara e um rabicho
soltos embaixo do aro (sobre a janela). A linha de baixo vira o contorno escuro e o rabicho sai.
Depois de silber_cockpit.py.  Uso: python3 tools/ref/silber_mirror_tail.py src/assets/cockpit/959-dash.png
"""
import sys

import numpy as np
from PIL import Image

p = sys.argv[1]
a = np.array(Image.open(p).convert('RGBA'))
dark = a[62, 30].copy()                      # contorno escuro da carcaça (linha 138 do empilhado)
for x in range(23, 45):                       # linha 139: contorno escuro (fecha a carcaça)
    if a[63, x, 3]:
        a[63, x] = dark
a[64, 15:47, 3] = 0                           # linha 140: rabicho e restos sobre a janela
Image.fromarray(a).save(p, optimize=True)
