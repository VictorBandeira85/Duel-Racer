"""Sprites do Passeio GTS (Passat GTS Pointer) a partir da arte ampliada: reamostra na grade
nativa (regrid.py), alisa a lataria e gera a máscara de pintura (lateral e traseira prata: regra
da Onça GTB; frente vermelha: matiz vermelho), sem lanternas, faróis, piscas, frisos e
para-choques pretos. O branco do para-brisa da frente (fundo da arte) vira vidro. As marcas reais
saem: letreiros da traseira e da lateral viram lataria, a placa vira genérica, o emblema da grade
vira o fictício.

Uso: python3 tools/ref/passat_sprites.py <pasta com src-side/rear/front.png> <src/assets/cars>
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from glass_fix import fix_glass  # noqa: E402
from onca_sprites import body_mask  # noqa: E402
from uno_sprites import emblem, plate  # noqa: E402
from vectra_sprites import flatten, glass, outline, red_mask  # noqa: E402

PERIOD = {'side': 6.00, 'rear': 5.76, 'front': 6.39}
WHEELS_SIDE = [(30.5, 51.0, 13.5), (162.5, 51.0, 13.5)]
CUT = {
    'side': [(0, 22, 9, 31), (198, 22, 206, 32)],
    'rear': [(2, 56, 54, 72), (118, 56, 170, 72), (62, 57, 110, 73)],
    'front': [(6, 55, 47, 73), (118, 55, 161, 73), (10, 88, 34, 98), (130, 88, 155, 98)],
}


def main():
    src, cars = sys.argv[1], sys.argv[2]
    for view in ('side', 'rear', 'front'):
        out = os.path.join(cars, f'br-passat-{view}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'src-{view}.png'), out, str(PERIOD[view])], check=True)
        a = np.array(Image.open(out).convert('RGBA'))
        H, W = a.shape[:2]
        if view == 'side':  # letreiro na faixa da porta: faixa lisa
            for y in range(39, 45):
                a[y, 120:146] = a[y, 118]
        if view == 'rear':
            for y in range(43, 51):  # emblema + nome da marca e nome do modelo: lataria
                a[y, 12:50] = a[y, 10]
                a[y, 122:160] = a[y, 162]
            plate(a, 63, 58, 109, 72)
        if view == 'front':
            glass(a)  # o branco do para-brisa é o fundo da arte
            for y in range(58, 70):  # emblema e "1.8" da grade: grade lisa e o fictício
                a[y, 50:96] = a[y, 48]
                a[y, 96:112] = a[y, 114]
            emblem(a, 82.5, 64.0)
        if view == 'front':
            m = red_mask(a, [], CUT[view])
        else:
            m = body_mask(a, 'rear', np.zeros(a.shape[:2], bool))
            if view == 'side':  # a metade de baixo da lateral é prata mais escuro (sombra)
                import cv2
                rgb = a[..., :3].astype(int)
                lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
                low = (a[..., 3] > 0) & (sat < 30) & (lum > 120)  # abaixo das janelas: nada é vidro
                low[:24] = False
                low[38:] = False
                low &= cv2.erode((a[..., 3] > 0).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
                n, lab, st, _ = cv2.connectedComponentsWithStats(low.astype(np.uint8), 4)
                for i in range(1, n):
                    if st[i, cv2.CC_STAT_AREA] >= 40:
                        m |= lab == i
            for x0, y0, x1, y1 in CUT[view]:
                m[y0:y1, x0:x1] = False
            if view == 'side':
                yy, xx = np.mgrid[0:H, 0:W]
                for cx, cy, r in WHEELS_SIDE:
                    m &= (xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 > r * r
                m[37:] = False  # para-choques e saia pretos/frisos embaixo
        flatten(a, m, 10)
        outline(a)
        fix_glass(a, m, view)
        Image.fromarray(a, 'RGBA').save(out)
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(out.replace('.png', '-mask.png'))
        print(view, W, H, 'máscara', int(m.sum()))


if __name__ == '__main__':
    main()
