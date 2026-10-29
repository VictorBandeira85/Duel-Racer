"""Revisão das máscaras de pintura dos carros importados: traços vermelhos da arte (que é de
um carro vermelho) ficavam fora da pintura e apareciam em qualquer outra cor — borda do teto do
Vortex, frisos da Furia F4, contorno dos arcos de roda da Furia TR e da Serpe. Entram na
máscara os componentes vermelhos que encostam na pintura e são finos (linhas, arcos); os
compactos (lanternas, refletores) ficam de fora.

Uso: python3 tools/ref/mask_fix.py src/assets/cars <arte> [<arte>...]
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image


def fix(a, m):
    hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(float)
    hue = hsv[..., 0] * 360 / 256
    red = ((hue >= 340) | (hue <= 16)) & (hsv[..., 1] > 110) & (hsv[..., 2] > 50) & (a[..., 3] > 0) & ~m
    near = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0  # até 2 px (pode haver um contorno escuro no meio)
    n, lab, st, _ = cv2.connectedComponentsWithStats(red.astype(np.uint8), 8)
    add = np.zeros_like(m)
    for i in range(1, n):
        comp = lab == i
        w, h, area = st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT], st[i, cv2.CC_STAT_AREA]
        thin = min(w, h) <= 3 or area / (w * h) < 0.35
        if thin and (comp & near).any():
            add |= comp
    return m | add, int(add.sum())


def main():
    d = sys.argv[1]
    for art in sys.argv[2:]:
        for v in ('side', 'front', 'rear'):
            mp = os.path.join(d, f'{art}-{v}-mask.png')
            if not os.path.exists(mp):
                continue
            a = np.array(Image.open(os.path.join(d, f'{art}-{v}.png')).convert('RGBA'))
            m = np.array(Image.open(mp).convert('L')) > 0
            m2, k = fix(a, m)
            if art == 'zr1' and v in ('front', 'rear'):
                # borda do teto (acima do vidro) é lataria; na traseira o meio é a luz de freio alta
                hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(float)
                hue = hsv[..., 0] * 360 / 256
                red = ((hue >= 340) | (hue <= 16)) & (hsv[..., 1] > 110) & (a[..., 3] > 0)
                H, W = m.shape
                top = np.zeros_like(m)
                top[: int(H * 0.08)] = True
                if v == 'rear':
                    top[:, int(W * 0.4):int(W * 0.6)] = False
                extra = red & top & ~m2
                m2 |= extra
                k += int(extra.sum())
            if k:
                Image.fromarray((m2 * 255).astype(np.uint8)).convert('1').save(mp)
            print(art, v, 'pixels incluídos:', k)


if __name__ == '__main__':
    main()
