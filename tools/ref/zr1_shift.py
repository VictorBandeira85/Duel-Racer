"""Cabine do Vortex ZR: com o quadro todo dentro do volante (desenhado no jogo, até a coluna
nativa ~190), a parte central do painel da arte (saídas de ar e console, a partir da coluna
234) é puxada para a esquerda até encostar no quadro; à direita as últimas colunas se repetem
(área esticada de tela larga).

Uso: python3 tools/ref/zr1_shift.py src/assets/cockpit
"""
import os
import sys

import numpy as np
from PIL import Image

PAD = 102
SRC, DST = 234, 192  # coluna nativa onde começa o meio do painel, antes e depois


def main():
    fn = os.path.join(sys.argv[1], 'zr1-dash.png')
    a = np.array(Image.open(fn).convert('RGBA'))
    s, d = SRC + PAD, DST + PAD
    n = a.shape[1] - s
    a[:, d:d + n] = a[:, s:].copy()
    a[:, d + n:] = a[:, -1:]
    Image.fromarray(a, 'RGBA').save(fn)
    print('meio do painel puxado', SRC - DST, 'colunas para a esquerda')


if __name__ == '__main__':
    main()
