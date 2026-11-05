"""Prepara as artes do Serpe V10 (Dodge Viper RT/10) para o regrid.py: a lateral vem com
transparência (vira fundo branco); na traseira e na frente o fundo claro (o xadrez de
"transparente" desenhado na arte, ou branco com ruído) ligado às bordas vira branco puro, e o
xadrez preso dentro do arco de proteção (traseira) vira magenta, que o viper_sprites.py torna
transparente depois.

Uso: python3 tools/ref/viper_prep.py <pasta com src-side/rear/front.png>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

d = sys.argv[1]
side = Image.open(os.path.join(d, 'src-side.png')).convert('RGBA')
bg = Image.new('RGBA', side.size, (255, 255, 255, 255))
bg.alpha_composite(side)
a = np.array(bg.convert('RGB'))
a[np.array(side)[..., 3] < 128] = 255
Image.fromarray(a).save(os.path.join(d, 'prep-side.png'))
for k in ('rear', 'front'):
    a = np.array(Image.open(os.path.join(d, f'src-{k}.png')).convert('RGB'))
    H, W = a.shape[:2]
    light = ((a.min(axis=2) > 185) & (a.max(axis=2).astype(int) - a.min(axis=2) < 18)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(light, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    out = np.isin(lab, list(border))
    a[out] = 255
    if k == 'rear':
        # xadrez preso no meio do arco (acima do porta-malas, entre os bancos e o arco)
        for i in range(1, n):
            if i in border:
                continue
            x, y, w, h, area = st[i]
            if area > 1500 and y < H * 0.42 and x > W * 0.28 and x + w < W * 0.72:
                a[lab == i] = (255, 0, 255)
    Image.fromarray(a).save(os.path.join(d, f'prep-{k}.png'))
print('ok')
