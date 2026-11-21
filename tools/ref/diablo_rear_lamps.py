"""Toro V12 (Diablo) e as viaturas SV: no Diablo de verdade a lente âmbar do pisca é a de FORA. Na arte o
lado direito está certo (âmbar por fora) e o esquerdo veio copiado sem espelhar (vermelha por fora, âmbar
por dentro). Troca as duas lentes redondas do lado esquerdo de lugar (cada uma mantém o próprio brilho):
as duas âmbar ficam por fora, e o pisca (sigRear de diablo/patrolsv em cars.ts) acende nelas.
Uso: python3 tools/ref/diablo_rear_lamps.py
"""
import os

import numpy as np
from PIL import Image

A = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'assets')
R = 17.5
for name, dy in [('cars/diablo-rear', 0), ('cars/diablo-rear-mask', 0), ('cars/patrolsv-rear', 10), ('traffic/policesv-rear', 10), ('traffic/policesv-rear-liv', 10)]:
    p = os.path.join(A, name + '.png')
    if not os.path.exists(p):
        continue
    im = Image.open(p)
    mode = im.mode
    a = np.array(im)
    cy = 96.5 + dy
    c1, c2 = 44.0, 79.0  # lado esquerdo: vermelha (fora) e âmbar (dentro)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    m1 = (xx - c1) ** 2 + (yy - cy) ** 2 <= R * R
    m2 = (xx - c2) ** 2 + (yy - cy) ** 2 <= R * R
    d = int(c2 - c1)
    b = a.copy()
    ys, xs = np.nonzero(m1)
    b[ys, xs] = a[ys, xs + d]   # âmbar vai para fora
    ys, xs = np.nonzero(m2)
    b[ys, xs] = a[ys, xs - d]   # vermelha vem para dentro
    Image.fromarray(b, mode).save(p, optimize=True)
    print(name)
