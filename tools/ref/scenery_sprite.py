"""Objeto do cenário desenhado pelo Victor no gerador (pixel art ampliada sobre magenta #FF00FF) virando
o sprite nativo do jogo (src/assets/scenery/<tipo>.png): acha a grade da arte (período e fase dos blocos
pelas bordas, em x e em y), pega a cor do miolo de cada bloco, o magenta vira transparente e o desenho é
recortado justo. O jogo (sprites.ts) desenha a imagem no lugar do desenho vetorial, na mesma base.
Uso: python3 tools/ref/scenery_sprite.py <arte.png> <saida.png>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from regrid import period_phase  # noqa: E402


def main():
    src, out = sys.argv[1], sys.argv[2]
    a = np.array(Image.open(src).convert('RGB')).astype(int)
    mag = (a[..., 0] > 170) & (a[..., 1] < 110) & (a[..., 2] > 170)
    ys, xs = np.where(~mag)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    g = cv2.cvtColor(a.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(float)
    sub = g[y0:y1, x0:x1]
    p, phx = period_phase(np.abs(np.diff(sub, axis=1)).sum(0), 8, 34)
    ey = np.abs(np.diff(sub, axis=0)).sum(1)
    ey = ey - ey.mean()
    k = np.arange(len(ey))
    phy = (-np.angle((ey * np.exp(2j * np.pi * k / p)).sum()) / (2 * np.pi) * p) % p
    cols = np.arange(x0 + phx + p / 2 - p, x1 + p, p)
    rows = np.arange(y0 + phy + p / 2 - p, y1 + p, p)
    r = max(1, int(p * 0.2))
    o = np.zeros((len(rows), len(cols), 4), np.uint8)
    for j, cy in enumerate(rows):
        for i, cx in enumerate(cols):
            yy, xx = int(round(cy)), int(round(cx))
            if yy < 0 or xx < 0 or yy >= a.shape[0] or xx >= a.shape[1]:
                continue
            blk = a[max(0, yy - r):yy + r + 1, max(0, xx - r):xx + r + 1].reshape(-1, 3)
            m = mag[max(0, yy - r):yy + r + 1, max(0, xx - r):xx + r + 1].reshape(-1)
            if m.mean() > 0.5:
                continue
            o[j, i] = [*np.median(blk[~m], axis=0).astype(np.uint8), 255]
    al = o[..., 3] > 0
    yy, xx = np.where(al)
    o = o[yy.min():yy.max() + 1, xx.min():xx.max() + 1]
    Image.fromarray(o).save(out, optimize=True)
    print(out, o.shape[1], 'x', o.shape[0], 'bloco', round(p, 2))


if __name__ == '__main__':
    main()
