"""Acabamento da cabine do Cadete GSi (depois de import_cockpit.py br-kadett): o vidro do
retrovisor esquerdo vem em xadrez azul e branco (reflexo desenhado); vira vidro liso para o jogo
desenhar o reflexo de verdade.

Uso: python3 tools/ref/kadett_cockpit.py src/assets/cockpit
"""
import os
import sys

import numpy as np
from PIL import Image


def main():
    d = sys.argv[1]
    tp, dp = os.path.join(d, 'br-kadett-top.png'), os.path.join(d, 'br-kadett-dash.png')
    t, dd = np.array(Image.open(tp).convert('RGBA')), np.array(Image.open(dp).convert('RGBA'))
    a = np.vstack([t, dd])
    rgb = a[..., :3].astype(int)
    zone = np.zeros(a.shape[:2], bool)
    zone[50:140, :80] = True
    glass = zone & (a[..., 3] > 0) & (rgb.min(axis=2) > 120) & (rgb[..., 2] >= rgb[..., 0])
    ys = np.nonzero(glass)[0]
    for y in range(ys.min(), ys.max() + 1):
        f = (y - ys.min()) / max(1, ys.max() - ys.min())
        a[y, glass[y], :3] = (int(212 - 30 * f), int(222 - 28 * f), int(232 - 24 * f))
    Image.fromarray(a[:t.shape[0]], 'RGBA').save(tp)
    Image.fromarray(a[t.shape[0]:], 'RGBA').save(dp)
    print('retrovisor: vidro liso,', int(glass.sum()), 'px')


if __name__ == '__main__':
    main()
