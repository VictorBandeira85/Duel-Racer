"""Sprites do Cadete GSi (Kadett GSi) a partir da arte ampliada: reamostra na grade nativa
(regrid.py), alisa a lataria e gera a máscara de pintura pelo matiz amarelo (as faixas
vermelhas, lanternas e piscas âmbar ficam de fora pelo próprio matiz). O letreiro com o nome
real do modelo na traseira vira lataria lisa (os "GSi" ficam).

Uso: python3 tools/ref/kadett_sprites.py <pasta com src-side/rear/front.png> <src/assets/cars>
"""
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from glass_fix import fix_glass  # noqa: E402
sys.path.insert(0, HERE)
from vectra_sprites import flatten, outline  # noqa: E402

PERIOD = {'side': 9.86, 'rear': 9.22, 'front': 6.70}
K4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)


def yellow_mask(a):
    hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(float)
    hue = hsv[..., 0] * 360 / 256
    m = (hue >= 40) & (hue <= 68) & (hsv[..., 1] > 110) & (hsv[..., 2] > 90) & (a[..., 3] > 0)
    m &= cv2.erode((a[..., 3] > 0).astype(np.uint8), K4) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    keep = np.zeros(m.shape, bool)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 10:
            keep |= lab == i
    return keep


def main():
    src, cars = sys.argv[1], sys.argv[2]
    for view in ('side', 'rear', 'front'):
        out = os.path.join(cars, f'br-kadett-{view}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'src-{view}.png'), out, str(PERIOD[view])], check=True)
        a = np.array(Image.open(out).convert('RGBA'))
        H, W = a.shape[:2]
        if view == 'rear':  # letreiro do nome do modelo: lataria
            x0, y0, x1, y1 = 14, 24, 33, 31
            box = a[y0:y1, x0:x1, :3].astype(int)
            yel = (box[..., 0] > 180) & (box[..., 1] > 150) & (box[..., 2] < 90)
            body = np.median(box[yel], axis=0) if yel.any() else np.array([238, 206, 20])
            a[y0:y1, x0:x1][~yel, :3] = body.astype(np.uint8)
        m = yellow_mask(a)
        flatten(a, m)
        outline(a)
        fix_glass(a, m, view)  # branco que sobrou nos vidros vira vidro (vale para todo carro)
        Image.fromarray(a, 'RGBA').save(out)
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(out.replace('.png', '-mask.png'))
        print(view, W, H, 'máscara', int(m.sum()))


if __name__ == '__main__':
    main()
