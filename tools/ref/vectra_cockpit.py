"""Acabamento do painel do Vetor GSi (depois de import_cockpit.py br-vectra): em volta dos quatro
mostradores auxiliares redesenhados no jogo sobravam as marcações e números da arte (pontos
claros e vermelhos). Num anel em volta de cada um, o que for claro ou colorido vira o cinza
escuro do painel ao redor.

Uso: python3 tools/ref/vectra_cockpit.py src/assets/cockpit
"""
import os
import sys

import numpy as np
from PIL import Image

PAD = 102
AUX = [(178.5, 55.5, 5.5), (196.5, 58, 6), (178.5, 74.5, 6), (197, 75.5, 6)]  # como em cockpit.ts


def main():
    fn = os.path.join(sys.argv[1], 'br-vectra-dash.png')
    a = np.array(Image.open(fn).convert('RGBA'))
    rgb = a[..., :3].astype(int)
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    H, W = lum.shape
    yy, xx = np.mgrid[0:H, 0:W]
    ring = np.zeros((H, W), bool)
    for x, y, r in AUX:
        d = np.sqrt((xx - (PAD + x + 0.5) + 0.5) ** 2 + ((yy - (y + 0.5) + 0.5) / (8 / 7)) ** 2)
        ring |= d <= r + 4.5
    bad = ring & ((lum > 30) | (sat > 25))
    calm = ring & ~bad
    # cada mancha vira a média dos pixels calmos mais próximos (o painel em volta)
    for y, x in zip(*np.nonzero(bad)):
        for k in range(1, 6):
            win = calm[max(0, y - k):y + k + 1, max(0, x - k):x + k + 1]
            if win.sum() >= 3:
                a[y, x, :3] = rgb[max(0, y - k):y + k + 1, max(0, x - k):x + k + 1][win].mean(axis=0).astype(np.uint8)
                break
    Image.fromarray(a, 'RGBA').save(fn)
    print('pixels limpos:', int(bad.sum()))


if __name__ == '__main__':
    main()
