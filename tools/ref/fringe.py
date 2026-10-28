"""Polimento dos sprites: tira a franja clara (sobra do fundo branco) por fora do contorno.

Um pixel da borda da silhueta é franja quando é claro e pouco saturado e tem, logo para dentro,
um vizinho bem mais escuro (o contorno): fica transparente. Repete enquanto achar.
Uso: python3 tools/ref/fringe.py [--ver] <png>...   (--ver só conta, sem gravar)
"""
import sys

import cv2
import numpy as np
from PIL import Image

dry = '--ver' in sys.argv
for fn in [a for a in sys.argv[1:] if not a.startswith('--')]:
    a = np.array(Image.open(fn).convert('RGBA'))
    total = 0
    for _ in range(4):
        al = a[..., 3] > 0
        rgb = a[..., :3].astype(int)
        lum = rgb.mean(axis=2)
        sat = rgb.max(axis=2) - rgb.min(axis=2)
        out = ~al
        border = al & (cv2.dilate(out.astype(np.uint8), np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)) > 0)
        light = (rgb.min(axis=2) > 150) & (sat < 60)
        # vizinho opaco (8 direções) bem mais escuro
        darker = np.zeros_like(al)
        H, W = al.shape
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                sl = np.roll(np.roll(lum, dy, 0), dx, 1)
                sa = np.roll(np.roll(al, dy, 0), dx, 1)
                darker |= sa & (sl < lum - 70)
        # pixel claro solto (no máximo 2 vizinhos opacos) também sai
        nb = cv2.filter2D(al.astype(np.uint8), -1, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT) - al
        kill = border & light & (darker | (nb <= 2))
        n = int(kill.sum())
        if not n:
            break
        total += n
        a[kill, 3] = 0
    print(fn, total)
    if total and not dry:
        Image.fromarray(a, 'RGBA').save(fn)
