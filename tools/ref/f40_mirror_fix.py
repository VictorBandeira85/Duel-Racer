"""Retrovisor esquerdo da Fúria F4: fica do lado de FORA do carro. O add_mirror.py desenhava por cima da
coluna e do painel (parecia estar dentro da cabine); aqui ele é desenhado à esquerda e a arte original
(coluna, painel e porta, de <pasta>/top.png e dash.png, a cabine sem retrovisor) volta por cima: do
retrovisor só aparece o que se vê pela janela.
Uso: python3 tools/ref/f40_mirror_fix.py <pasta com top.png e dash.png originais>
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
C = os.path.join(HERE, '..', '..', 'src/assets/cockpit/f40-')


def stack(a, b):
    return np.concatenate([np.array(Image.open(a).convert('RGBA')), np.array(Image.open(b).convert('RGBA'))])


def save(c):
    Image.fromarray(c[:76]).save(C + 'top.png', optimize=True)
    Image.fromarray(c[76:]).save(C + 'dash.png', optimize=True)


def main():
    src = sys.argv[1]
    old = stack(os.path.join(src, 'top.png'), os.path.join(src, 'dash.png'))
    c = stack(C + 'top.png', C + 'dash.png')
    c[84:134, 0:64] = old[84:134, 0:64]
    save(c)
    subprocess.run([sys.executable, os.path.join(HERE, '..', 'qa', 'add_mirror.py'), 'f40', '9', '91', '42', '119', '24', '131', '#c8141a'], check=True)
    c = stack(C + 'top.png', C + 'dash.png')
    op = old[..., 3] > 0
    c[op] = old[op]
    save(c)


if __name__ == '__main__':
    main()
