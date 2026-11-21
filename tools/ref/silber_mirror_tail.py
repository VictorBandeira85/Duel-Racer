"""Silber 95: tira só o toquinho solto no canto de baixo à esquerda da carcaça do retrovisor esquerdo (sobre a
janela). Depois de silber_cockpit.py.  Uso: python3 tools/ref/silber_mirror_tail.py src/assets/cockpit/959-dash.png
"""
import sys

import numpy as np
from PIL import Image

p = sys.argv[1]
a = np.array(Image.open(p).convert('RGBA'))
a[64, 22:29, 3] = 0          # linha 140 do topo+painel empilhados, x 22..28
Image.fromarray(a).save(p, optimize=True)
