"""Pintura da Furia TR (Testarossa): conserta as máscaras e as cores das três vistas.
- reflexos claros da lataria (rosados, pouca cor) entram na máscara: com outra cor não ficam rosa
- traseira: o rebaixo vermelho da placa entra na máscara; as carcaças dos retrovisores (vistas por
  trás) eram azuis como vidro e passam a ser da cor da carroceria
Uso: python3 tools/ref/tr_paint_fix.py <src/assets/cars>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image


def hsv(a):
    h = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(int)
    return h[..., 0] * 360 / 256, h[..., 1], h[..., 2]


def main():
    d = sys.argv[1]
    for v in ('side', 'rear', 'front'):
        p, mp = os.path.join(d, f'testarossa-{v}.png'), os.path.join(d, f'testarossa-{v}-mask.png')
        a = np.array(Image.open(p).convert('RGBA'))
        m0 = np.array(Image.open(mp).convert('L')) > 127
        h, s, val = hsv(a)
        inner = cv2.erode((a[..., 3] > 0).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        near = cv2.dilate(m0.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        pink = inner & near & ((h < 22) | (h > 330)) & (s > 12) & (s < 130) & (val > 120)
        m = m0 | pink
        if v == 'rear':
            H, W = m.shape
            box = np.zeros_like(m)
            box[int(H * 0.56):int(H * 0.78), int(W * 0.3):int(W * 0.7)] = True
            m |= box & inner & ((h < 18) | (h > 340)) & (s > 120) & (val > 70)
            # carcaças dos retrovisores: azul -> vermelho da carroceria com o mesmo brilho
            mir = np.zeros_like(m)
            mir[int(H * 0.14):int(H * 0.34), :int(W * 0.17)] = True
            mir[int(H * 0.14):int(H * 0.34), int(W * 0.83):] = True
            blue = mir & (h > 180) & (h < 260) & (s > 50) & (a[..., 3] > 0)
            body = a[..., :3][m0].astype(float)
            ref = np.sort(body.mean(axis=1))
            lum = a[..., :3][blue].astype(float).mean(axis=1)
            ranks = np.argsort(np.argsort(lum)) / max(1, len(lum) - 1)
            nl = np.percentile(ref, 15 + ranks * 80)
            col = np.median(body, axis=0)
            k = nl / max(1, col.mean())
            a[..., :3][blue] = np.clip(col[None, :] * k[:, None], 0, 255).astype(np.uint8)
            m |= blue
        Image.fromarray(a, 'RGBA').save(p, optimize=True)
        Image.fromarray((m * 255).astype(np.uint8), 'L').convert('RGBA').save(mp, optimize=True)
        print(v, int(m0.sum()), '->', int(m.sum()))


if __name__ == '__main__':
    main()
