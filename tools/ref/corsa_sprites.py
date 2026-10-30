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
from vectra_sprites import flatten, outline, red_mask  # noqa: E402

PERIOD = {'side': 6.09, 'rear': 3.49, 'front': 4.665}
SRC = {'side': 'src-side', 'rear': 'src-rear2', 'front': 'src-front'}  # traseira nova (vermelha)
# peças com o retângulo exato (sai tudo) e peças de contorno curvo (sai só o que fica dentro
# do contorno escuro: a lataria que encosta na borda do retângulo continua)
# traseira (vermelha): lanternas, luz de freio do alto, emblema GSi e a placa
REAR_RED_CUT = [(171, 99, 197, 110), (87, 106, 151, 127)]  # GSi e placa: o que fica dentro do contorno
REAR_LAMPS = [(26.0, 101.5, 14.0, 131), (213.0, 101.5, 14.0, 131)]  # lanternas: topo redondo (centro, raio) até a linha de baixo
REAR_THIRD = (105, 20, 131, 28)  # luz de freio do alto
CUT = {
    'rear': [],
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


def taillights(a):
    """Lanternas como as do Corsa nacional: a faixa âmbar do meio vira vermelho (um pouco mais
    escuro que o de cima) e a luz de ré branca fica só na metade de dentro, embaixo; a metade de
    fora vira vermelho escuro."""
    W = a.shape[1]
    hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 // 256
    for x0, x1 in ((9, 34), (W - 34, W - 9)):
        inner_left = x0 > W / 2  # na lanterna da direita, o lado de dentro é o esquerdo
        mid = (x0 + x1) // 2
        for y in range(84, 105):
            for x in range(x0, x1):
                r, g, b = (int(v) for v in a[y, x, :3])
                amber = 12 <= hue[y, x] <= 50 and hsv[y, x, 1] > 120 and y < 96
                white = min(r, g, b) > 150 and 94 <= y <= 103
                if amber:
                    lum = (r + g + b) / 3
                    k = min(1.0, lum / 150)
                    a[y, x, :3] = (int(150 + 70 * k), int(12 + 14 * k), int(10 + 10 * k))
                elif white and ((x < mid) != inner_left):
                    a[y, x, :3] = (128, 12, 12) if (x + y) % 5 else (150, 20, 18)


def white_body(a, m):
    # a foto da traseira é de um carro vermelho; o Corsário é branco de lado e de frente: a lataria
    # vira o mesmo branco levemente azulado, mantendo o sombreado (luminância relativa à média)
    px = a[m][:, :3].astype(float)
    L = px @ np.array([0.3, 0.59, 0.11])
    base = np.array([224.0, 230.0, 234.0])
    nl = np.clip(229 + (L - np.median(L)) * 1.1, 60, 252)
    a[m, :3] = np.clip(base[None, :] * (nl / 229)[:, None], 0, 255).astype(np.uint8)


def main():
    src, cars = sys.argv[1], sys.argv[2]
    for view in ('side', 'rear', 'front'):
        out = os.path.join(cars, f'br-corsa-{view}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'{SRC[view]}.png'), out, str(PERIOD[view])], check=True)
        a = np.array(Image.open(out).convert('RGBA'))
        H, W = a.shape[:2]
        if view == 'rear':
            # letreiro com o nome do modelo: lataria (cor da coluna ao lado, linha a linha)
            for y in range(99, 110):
                a[y, 40:68] = a[y, 38]
            # emblema da marca na maçaneta do porta-malas: maçaneta lisa e o emblema fictício
            for y in range(84, 99):
                a[y, 113:127] = a[y, 112]
            emblem(a, 120.0, 91.5)
        if view == 'front':  # gravata da grade: grade lisa por baixo e o emblema fictício
            for y in range(84, 95):
                a[y, 86:110] = a[y, 82]
            emblem(a, 97.5, 89.0)
        # os vidros da arte já são azulados (o branco da lataria não é vidro). De lado, o contorno
        # escuro de baixo liga os dois pneus: a regra da Onça apagaria a metade de baixo inteira,
        # então as rodas saem por círculos medidos
        if view == 'rear':  # a traseira nova é vermelha: máscara pelo matiz
            m = red_mask(a, REAR_RED_CUT, [REAR_THIRD])
            yy, xx = np.mgrid[0:H, 0:W]
            for cx, cy, r, yb in REAR_LAMPS:
                lamp = ((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= r * r) | ((np.abs(xx + 0.5 - cx) <= r) & (yy + 0.5 >= cy) & (yy < yb))
                m &= ~lamp
        else:
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
        if view == 'rear':
            white_body(a, m)
        flatten(a, m, 10)
        outline(a)
        fix_glass(a, m, view)
        Image.fromarray(a, 'RGBA').save(out)
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(out.replace('.png', '-mask.png'))
        print(view, W, H, 'máscara', int(m.sum()))


if __name__ == '__main__':
    main()
