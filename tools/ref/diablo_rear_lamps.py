"""Toro V12 (Diablo) e as viaturas SV: na arte o lado direito das lanternas veio copiado sem espelhar (âmbar
por fora, vermelha por dentro); o esquerdo está certo (vermelha por fora, âmbar do pisca por dentro). Troca
as duas lentes redondas do lado direito de lugar (cada uma mantém o próprio brilho), deixando as duas
âmbar por dentro, e o pisca (sigRear de diablo/patrolsv em cars.ts) acende nelas.
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
    c1, c2 = 350.0, 384.0  # vermelha (dentro) e âmbar (fora) do lado direito
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    m1 = (xx - c1) ** 2 + (yy - cy) ** 2 <= R * R
    m2 = (xx - c2) ** 2 + (yy - cy) ** 2 <= R * R
    d = int(c2 - c1)
    b = a.copy()
    ys, xs = np.nonzero(m1)
    b[ys, xs] = a[ys, xs + d]   # âmbar vem para dentro
    ys, xs = np.nonzero(m2)
    b[ys, xs] = a[ys, xs - d]   # vermelha vai para fora
    Image.fromarray(b, mode).save(p, optimize=True)
    print(name)
