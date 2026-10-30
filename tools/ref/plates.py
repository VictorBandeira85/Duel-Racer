"""Placa genérica (a mesma do Unão, Passeio e Vetor) nas traseiras que vinham com a placa lisa
da arte (escura ou branca, sem caracteres); o retângulo da placa sai da máscara de pintura.
Rodar depois dos scripts de sprites de cada carro.
Uso: python3 tools/ref/plates.py src/assets/cars
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from uno_sprites import plate  # noqa: E402

PLATES = {  # carro: (x0, y0, x1, y1, texto)
    'br-golgti': (51, 41, 84, 55, 'DRG-1994'),
    'br-kadett': (31, 30, 62, 40, 'DR-1989'),
    'br-pumagte': (35, 34, 64, 46, 'DR-1976'),
    'br-corsa': (88, 108, 150, 127, 'DRC-1995'),
}

d = sys.argv[1]
for car, (x0, y0, x1, y1, text) in PLATES.items():
    p, mp = os.path.join(d, f'{car}-rear.png'), os.path.join(d, f'{car}-rear-mask.png')
    a = np.array(Image.open(p).convert('RGBA'))
    plate(a, x0, y0, x1, y1, text=text)
    Image.fromarray(a).save(p)
    if os.path.exists(mp):
        m = np.array(Image.open(mp).convert('L')) > 0
        m[y0:y1, x0:x1] = False
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(mp)
    print(car, text)
