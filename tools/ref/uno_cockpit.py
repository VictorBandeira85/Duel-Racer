"""Acabamento da cabine do Unão Turbo (depois de import_cockpit.py br-uno e de
gtb_rim_fix.py ... ceu): as marcas reais saem.
- volante: o emblema da marca no miolo vira o fictício (anel cromado com traços de velocidade)
- console: o nome da marca embaixo da tela vira o plástico em volta
- retrovisor esquerdo: o reflexo desenhado no vidro vira vidro liso (o jogo desenha o reflexo)

Uso: python3 tools/ref/uno_cockpit.py src/assets/cockpit
"""
import os
import sys

import numpy as np
from PIL import Image


def main():
    d = sys.argv[1]
    wp, dp = os.path.join(d, 'br-uno-wheel.png'), os.path.join(d, 'br-uno-dash.png')
    w = np.array(Image.open(wp).convert('RGBA'))
    a = np.array(Image.open(dp).convert('RGBA'))
    # emblema do volante
    cx, cy = 128.1, 106.1
    yy, xx = np.mgrid[0:w.shape[0], 0:w.shape[1]]
    dd = np.sqrt((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2)
    ring = (dd > 11) & (dd < 13.5) & (w[..., 3] > 0)
    pad = np.median(w[ring, :3], axis=0).astype(np.uint8)
    w[dd <= 11, :3] = pad
    w[dd <= 6.8, :3] = (14, 14, 16)
    chrome = (dd <= 6.2) & (dd > 4.8)
    t = np.clip((yy + 0.5 - (cy - 6)) / 12, 0, 1)
    col = (np.array([236, 236, 240]) * (1 - t[..., None]) + np.array([130, 132, 138]) * t[..., None]).astype(np.uint8)
    w[chrome, :3] = col[chrome]
    inner = dd <= 4.8
    w[inner, :3] = (16, 16, 20)
    for dy, n in ((-2, 6), (0, 4), (2, 2)):
        y = int(cy + dy)
        for x in range(int(cx + 3) - n, int(cx + 3)):
            if inner[y, x]:
                w[y, x, :3] = col[y, x]
    # nome da marca no console
    for y in range(76, 84):
        a[y, 365:381] = a[y, 363]
    # vidro do retrovisor (teto + painel juntos): azul-claro liso, mais claro em cima
    tp = os.path.join(d, 'br-uno-top.png')
    t = np.array(Image.open(tp).convert('RGBA'))
    al = np.vstack([t, a])
    rgb = al[..., :3].astype(int)
    zone = np.zeros(al.shape[:2], bool)
    zone[80:135, :60] = True
    glass = zone & (al[..., 3] > 0) & (rgb.min(axis=2) > 60) & (rgb[..., 0] < rgb[..., 1] + 30)  # tudo que não é moldura (escura ou vermelha)
    ys = np.nonzero(glass)[0]
    for y in range(ys.min(), ys.max() + 1):
        f = (y - ys.min()) / max(1, ys.max() - ys.min())
        al[y, glass[y], :3] = (int(196 - 30 * f), int(222 - 28 * f), int(240 - 22 * f))
    Image.fromarray(al[:t.shape[0]]).save(tp)
    a = al[t.shape[0]:]
    Image.fromarray(w).save(wp)
    Image.fromarray(a).save(dp)
    print('emblema e console trocados')


if __name__ == '__main__':
    main()
