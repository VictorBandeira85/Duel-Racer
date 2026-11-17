"""Acabamento da arte da obra/blitz (src/assets/obra/*.png, já recortada pelo magenta_cut.py ou pelo
flagger_poses.py): tira a franja arroxeada que o fundo magenta deixa no contorno (vira contorno escuro
neutro) e grava em paleta de 256 cores sem pontilhado (de ~45 KB para ~5 KB por arquivo: tudo fica
abaixo de 32 KB e entra direto na página). Rodar de novo é inofensivo.
Uso: python3 tools/ref/obra_art.py [arquivos...]   (sem argumentos: todos de src/assets/obra)
"""
import glob
import sys

import numpy as np
from PIL import Image

files = sys.argv[1:] or sorted(glob.glob('src/assets/obra/*.png'))
for f in files:
    a = np.array(Image.open(f).convert('RGBA')).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    op = al > 0
    # anel de 3 px junto do transparente (a franja nunca passa disso)
    ring = op.copy()
    for _ in range(3):
        e = ring.copy()
        e[1:] &= ring[:-1]; e[:-1] &= ring[1:]; e[:, 1:] &= ring[:, :-1]; e[:, :-1] &= ring[:, 1:]
        ring = e
    edge = op & ~ring
    pur = edge & (r > g + 20) & (b > g + 20)
    v = ((r + g + b) / 3 * 0.55).astype(int)
    for ch, k in ((0, 1.0), (1, 1.0), (2, 1.08)):
        a[..., ch] = np.where(pur, np.minimum(255, (v * k).astype(int) + (2 if ch == 2 else 0)), a[..., ch])
    a[..., 3] = np.where(op, 255, 0)
    im = Image.fromarray(a.astype(np.uint8), 'RGBA')
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(f, optimize=True)
    print(f, 'franja', int(pur.sum()))
