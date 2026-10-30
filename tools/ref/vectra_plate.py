"""Vetor GSi: o vão da placa traseira saía pintado na cor da carroceria (sem placa); põe a placa
genérica (a mesma do Unão e do Passeio) e tira o vão da máscara de pintura.
Uso: python3 tools/ref/vectra_plate.py src/assets/cars (depois de vectra_sprites.py)
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from uno_sprites import plate  # noqa: E402

d = sys.argv[1]
p, mp = os.path.join(d, 'br-vectra-rear.png'), os.path.join(d, 'br-vectra-rear-mask.png')
a = np.array(Image.open(p).convert('RGBA'))
m = np.array(Image.open(mp).convert('L')) > 0
box = (40, 52, 73, 62)
plate(a, *box, text='DRV-1994')
m[box[1]:box[3], box[0]:box[2]] = False
Image.fromarray(a).save(p)
Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(mp)
print('placa do Vetor')
