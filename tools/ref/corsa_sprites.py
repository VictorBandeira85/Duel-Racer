"""Sprites do Corsário GSi (Corsa GSi) a partir da arte ampliada (branco): reamostra na grade
nativa (regrid.py), alisa a lataria e gera a máscara de pintura da lataria branca (mesma regra da
Onça GTB: claro e sem cor, ilhas grandes), sem placas, faróis, faróis de neblina, luz de ré,
vidros dos retrovisores e escapamento. As marcas reais saem: a gravata da traseira vira lataria e
a da grade vira o emblema fictício (anel com traços de velocidade); os "GSi" ficam.

Uso: python3 tools/ref/corsa_sprites.py <pasta com src-side/rear/front.png> <src/assets/cars>
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
from onca_sprites import body_mask  # noqa: E402
from uno_sprites import emblem  # noqa: E402
from vectra_sprites import flatten, outline  # noqa: E402

PERIOD = {'side': 6.09, 'rear': 3.57, 'front': 4.665}
# peças com o retângulo exato (sai tudo) e peças de contorno curvo (sai só o que fica dentro
# do contorno escuro: a lataria que encosta na borda do retângulo continua)
CUT = {
    'rear': [(84, 83, 140, 107), (10, 94, 34, 106), (188, 94, 212, 106), (0, 50, 21, 68), (201, 50, 222, 68), (37, 145, 54, 158)],
    'front': [(72, 99, 123, 119), (89, 82, 107, 97)],
    'side': [],
}
# faróis (elipses) e faróis de neblina de frente: saem pela forma, não pelo retângulo
LAMPS_FRONT = [(31.5, 83.5, 21, 12), (163.5, 83.5, 21, 12), (22.5, 118.5, 7, 6.5), (172.5, 118.5, 7, 6.5)]
WHEELS_SIDE = [(36.5, 64.5, 16.5), (171.5, 64.5, 16.5)]  # pneu inteiro (centro, raio)
INNER = {
    'rear': [],
    'front': [],
    'side': [(0, 37, 18, 54)],
}


def inner_cut(m, a, rect):
    x0, y0, x1, y1 = rect
    lum = a[y0:y1, x0:x1, :3].astype(int).mean(axis=2)
    sub = ((lum > 70) & (a[y0:y1, x0:x1, 3] > 0)).astype(np.uint8)
    n, lab = cv2.connectedComponents(sub, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    inner = (sub > 0) & ~np.isin(lab, list(border))
    inner = cv2.dilate(inner.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    m[y0:y1, x0:x1] &= ~inner


def main():
    src, cars = sys.argv[1], sys.argv[2]
    for view in ('side', 'rear', 'front'):
        out = os.path.join(cars, f'br-corsa-{view}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'src-{view}.png'), out, str(PERIOD[view])], check=True)
        a = np.array(Image.open(out).convert('RGBA'))
        H, W = a.shape[:2]
        if view == 'rear':  # gravata da marca: lataria (cor da coluna ao lado, linha a linha)
            for y in range(66, 77):
                a[y, 99:124] = a[y, 96]
        if view == 'front':  # gravata da grade: grade lisa por baixo e o emblema fictício
            for y in range(84, 95):
                a[y, 86:110] = a[y, 82]
            emblem(a, 97.5, 89.0)
        # os vidros da arte já são azulados (o branco da lataria não é vidro). De lado, o contorno
        # escuro de baixo liga os dois pneus: a regra da Onça apagaria a metade de baixo inteira,
        # então as rodas saem por círculos medidos
        m = body_mask(a, 'rear' if view == 'side' else view, np.zeros(a.shape[:2], bool))
        if view == 'side':
            yy, xx = np.mgrid[0:H, 0:W]
            for cx, cy, r in WHEELS_SIDE:
                m &= (xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 > r * r
        for x0, y0, x1, y1 in CUT[view]:
            m[y0:y1, x0:x1] = False
        for r in INNER[view]:
            inner_cut(m, a, r)
        if view == 'front':
            yy, xx = np.mgrid[0:H, 0:W]
            for cx, cy, rx, ry in LAMPS_FRONT:
                m &= ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 > 1
        flatten(a, m, 10)
        outline(a)
        fix_glass(a, m, view)
        Image.fromarray(a, 'RGBA').save(out)
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(out.replace('.png', '-mask.png'))
        print(view, W, H, 'máscara', int(m.sum()))


if __name__ == '__main__':
    main()
