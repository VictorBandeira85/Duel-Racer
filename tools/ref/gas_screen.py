"""Fundo da tela do posto (arte do Victor, dia e noite, 1536 x 1024) -> src/assets/gas/gas-{day,night}.png
na escala da tela (cobertura com 248 px de largura, como o posto desenhado antes). Reduz pegando a cor
do miolo de cada bloco (mediana 3x3 no centro), sem misturar tons: pixel art nítida.
Uso: python3 tools/ref/gas_screen.py <dia.png> <noite.png>
"""
import os
import sys

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/gas')
K = 248 / 1145  # cobertura da arte: x 195..1340


def shrink(path):
    a = np.array(Image.open(path).convert('RGB')).astype(int)
    H, W = a.shape[:2]
    w, h = int(round(W * K)), int(round(H * K))
    o = np.zeros((h, w, 3), np.uint8)
    for j in range(h):
        cy = int((j + 0.5) / K)
        for i in range(w):
            cx = int((i + 0.5) / K)
            blk = a[max(0, cy - 1):cy + 2, max(0, cx - 1):cx + 2].reshape(-1, 3)
            o[j, i] = np.median(blk, axis=0)
    return o


def main():
    os.makedirs(OUT, exist_ok=True)
    for src, name in zip(sys.argv[1:3], ('day', 'night')):
        o = shrink(src)
        Image.fromarray(o).save(os.path.join(OUT, f'gas-{name}.png'), optimize=True)
        print(name, o.shape[1], 'x', o.shape[0])


if __name__ == '__main__':
    main()
