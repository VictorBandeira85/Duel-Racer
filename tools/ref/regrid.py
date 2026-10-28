"""Reamostra pixel art ampliada (cada pixel do desenho virou um bloco de ~N px, com borrão de
compressão) na grade nativa: acha o período e a fase da grade pelas bordas entre blocos e pega
a cor do miolo de cada bloco (mediana). Sai um sprite nítido, um pixel do desenho por pixel,
sem as colunas e linhas duplicadas de uma redução para um tamanho qualquer.
O fundo branco ligado às bordas vira transparente (o branco de dentro, como vidros, fica).

Uso: python3 tools/ref/regrid.py <imagem> <saida.png> [periodo]
"""
import sys

import cv2
import numpy as np
from PIL import Image


def period_phase(edges, lo=3.0, hi=12.0):
    """Período (fração de px) e fase que alinham uma grade às bordas (soma por coluna/linha)."""
    e = edges - edges.mean()
    best = (0, lo, 0)
    for p in np.arange(lo, hi, 0.01):
        k = np.arange(len(e))
        ph = np.exp(2j * np.pi * k / p)
        v = np.abs((e * ph).sum())
        if v > best[0]:
            best = (v, p, 0)
    p = best[1]
    ang = np.angle((e * np.exp(2j * np.pi * np.arange(len(e)) / p)).sum())
    phase = (-ang / (2 * np.pi) * p) % p  # posição da primeira borda
    return p, phase


def main():
    src, out = sys.argv[1], sys.argv[2]
    img = cv2.imread(src)
    h, w = img.shape[:2]
    near_white = (img.min(axis=2) > 225).astype(np.uint8)
    work = near_white.copy()
    msk = np.zeros((h + 2, w + 2), np.uint8)
    for x in range(0, w, 4):
        for y in (0, h - 1):
            if work[y, x] == 1:
                cv2.floodFill(work, msk, (x, y), 2)
    for y in range(0, h, 4):
        for x in (0, w - 1):
            if work[y, x] == 1:
                cv2.floodFill(work, msk, (x, y), 2)
    fg = work != 2
    ys, xs = np.nonzero(fg)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    f = img.astype(np.float32).sum(axis=2)
    ex = np.abs(np.diff(f, axis=1))[y0:y1, x0:x1].sum(axis=0)
    ey = np.abs(np.diff(f, axis=0))[y0:y1, x0:x1].sum(axis=1)
    if len(sys.argv) > 3:
        p = float(sys.argv[3])
        _, phx = period_phase(ex, p - 0.005, p + 0.005)
        _, phy = period_phase(ey, p - 0.005, p + 0.005)
        px = py = p
    else:
        px, phx = period_phase(ex)
        py, phy = period_phase(ey)
        px = py = (px + py) / 2
    # borda em x0 + phx + k*p (+0.5 porque diff fica entre colunas)
    gx0 = x0 + phx + 0.5
    gy0 = y0 + phy + 0.5
    while gx0 > x0:
        gx0 -= px
    while gy0 > y0:
        gy0 -= py
    nx = int(np.ceil((x1 - gx0) / px))
    ny = int(np.ceil((y1 - gy0) / py))
    rgba = np.zeros((ny, nx, 4), np.uint8)
    r = max(1, int(px * 0.28))  # miolo do bloco (longe do borrão das bordas)
    for j in range(ny):
        cy = int(round(gy0 + (j + 0.5) * py))
        for i in range(nx):
            cx = int(round(gx0 + (i + 0.5) * px))
            ya, yb, xa, xb = max(0, cy - r), min(h, cy + r + 1), max(0, cx - r), min(w, cx + r + 1)
            if ya >= yb or xa >= xb:
                continue
            cell = fg[ya:yb, xa:xb]
            if cell.mean() < 0.5:
                continue
            col = np.median(img[ya:yb, xa:xb][cell], axis=0)
            rgba[j, i, :3] = col[::-1]
            rgba[j, i, 3] = 255
    al = rgba[..., 3] > 0
    ys, xs = np.nonzero(al)
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(rgba, 'RGBA').save(out)
    print(out, rgba.shape[1], rgba.shape[0], 'periodo %.2f' % px)


if __name__ == '__main__':
    main()
