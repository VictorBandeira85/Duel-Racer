"""Vidros com cor de vidro em todos os carros: o branco quase puro que sobra dentro da silhueta
(o fundo da arte visto pelo vidro, reflexos estourados) vira vidro azul-acinzentado, mais claro
em cima e mais escuro embaixo, mantendo o sombreado relativo. Só fora da máscara de pintura
(lataria branca continua branca) e na parte de cima do carro (faróis e lanternas ficam).
Rodar em todo carro novo (os scripts de sprites chamam fix_glass no fim).

Uso: python3 tools/ref/glass_fix.py src/assets/cars [arte...]
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

TOP, BOT = np.array([182, 198, 214]), np.array([104, 120, 140])


def fix_glass(a, m, view):
    H, W = a.shape[:2]
    rgb = a[..., :3].astype(int)
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    white = (a[..., 3] > 0) & (lum > 205) & (sat < 28) & ~m
    white[int(H * 0.5):] = False  # metade de cima: vidros (rodas, faróis e lanternas ficam)
    # só manchas de verdade (mais de 3 px): pontinhos de brilho isolados ficam
    n, lab, st, _ = cv2.connectedComponentsWithStats(white.astype(np.uint8), 8)
    sel = np.zeros_like(white)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 3 and st[i, cv2.CC_STAT_TOP] < H * 0.42:
            sel |= lab == i
    if not sel.any():
        return 0
    ys = np.nonzero(sel)[0]
    y0, y1 = ys.min(), ys.max()
    t = np.clip((np.arange(H) - y0) / max(1, y1 - y0), 0, 1)[:, None, None]
    col = TOP * (1 - t) + BOT * t
    k = np.clip(lum / 240, 0.85, 1.08)[..., None]  # o mais claro continua um reflexo
    out = np.clip(col * k, 0, 255).astype(np.uint8)
    a[sel, :3] = np.broadcast_to(out, (H, W, 3))[sel]
    return int(sel.sum())


def main():
    d = sys.argv[1]
    arts = sys.argv[2:] or sorted({f.rsplit('-', 1)[0] for f in os.listdir(d) if f.endswith('-side.png')})
    for art in arts:
        for v in ('side', 'front', 'rear'):
            p = os.path.join(d, f'{art}-{v}.png')
            if not os.path.exists(p):
                continue
            mp = p.replace('.png', '-mask.png')
            if not os.path.exists(mp):
                continue  # sem máscara (viaturas: portas e teto brancos de verdade)
            a = np.array(Image.open(p).convert('RGBA'))
            m = np.array(Image.open(mp).convert('L')) > 0
            k = fix_glass(a, m, v)
            if k:
                Image.fromarray(a, 'RGBA').save(p)
                print(art, v, 'pixels de vidro corrigidos:', k)


if __name__ == '__main__':
    main()
