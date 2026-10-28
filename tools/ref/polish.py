"""Polimento de sprite importado (pixel art gerada com fundo branco): tira a franja clara e os
pixels soltos da borda, reduz a paleta, troca pixels isolados pela cor vizinha e fecha a silhueta
com contorno escuro (o mesmo tratamento da Diablo, em tools/ref/diablo_sprites.py).
Uso: python3 tools/ref/polish.py <png>...  (grava por cima)
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from diablo_sprites import clean  # noqa: E402

for fn in sys.argv[1:]:
    a = clean(np.array(Image.open(fn).convert('RGBA')))
    Image.fromarray(a, 'RGBA').save(fn)
    print(fn, a.shape[1], a.shape[0])
