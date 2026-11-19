"""Equipamentos da cabine (arte do Victor sobre magenta) -> src/assets/copgear/<nome>.png: recorte do magenta
(franja rosada vira contorno), justo no objeto e reduzido pela cor do miolo de cada bloco (sem borrar) para a
largura W de cada um. O jogo desenha por cima o que muda (números do radar, LEDs do detector, teclas do giroflex).
Uso: python3 tools/ref/copgear_art.py <nome>=<arte.png> ...
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from oficina_art import cut, reduce  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/copgear')
W = {'radar': 96, 'sirene': 80, 'microfone': 40, 'terminal': 96, 'detector': 80, 'giroflex-tras': 160, 'giroflex-frente': 160, 'giroflex-lado': 80}

for arg in sys.argv[1:]:
    name, path = arg.split('=', 1)
    a, obj = cut(np.array(Image.open(path).convert('RGB')))
    ys, xs = np.nonzero(obj)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    f = (x1 - x0) / W[name]
    o = reduce(a[y0:y1, x0:x1], obj[y0:y1, x0:x1], f)
    Image.fromarray(o).save(os.path.join(OUT, f'{name}.png'), optimize=True)
    print(name, o.shape[1], o.shape[0], 'fator', round(f, 3), 'caixa', x0, y0, x1, y1)
