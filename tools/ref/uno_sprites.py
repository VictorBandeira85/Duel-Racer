"""Sprites do Unão Turbo (Uno Turbo i.e.) a partir da arte ampliada: reamostra na grade nativa
(regrid.py), troca o branco das janelas por vidro, alisa a lataria e gera as máscaras de pintura
pelo matiz vermelho, sem as lanternas e o "Turbo" vermelho da grade. As marcas reais saem:
emblema e letreiro da traseira viram lataria, a placa de loja vira uma placa genérica, o adesivo
do vidro vira vidro e o emblema da grade vira o fictício (anel com traços de velocidade).

Uso: python3 tools/ref/uno_sprites.py <pasta com src-side/rear/front.png> <src/assets/cars>
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from glass_fix import fix_glass  # noqa: E402
from vectra_sprites import flatten, glass, outline, red_mask  # noqa: E402

PERIOD = {'side': 5.07, 'rear': 5.11, 'front': 4.395}
INK = (14, 14, 16, 255)


def body_fill(a, x0, y0, x1, y1, ref):
    """Retângulo vira lataria: cada linha recebe a cor da lataria logo ao lado (coluna ref)."""
    for y in range(y0, y1):
        a[y, x0:x1] = a[y, ref]


def plate(a, x0, y0, x1, y1):
    """Placa genérica: moldura escura, fundo cinza-claro e caracteres em blocos escuros."""
    a[y0:y1, x0:x1] = INK
    a[y0 + 1:y1 - 1, x0 + 1:x1 - 1] = (206, 208, 212, 255)
    a[y0 + 1, x0 + 1:x1 - 1] = (232, 234, 238, 255)
    cy0, cy1 = y0 + (y1 - y0) // 2 - 3, y0 + (y1 - y0) // 2 + 3
    w = x1 - x0 - 6
    x = x0 + 4
    glyphs = [3, 3, 3, 0, 3, 3, 3, 3]  # "AAA 0000": três letras, espaço, quatro números
    step = w / len(glyphs)
    for i, g in enumerate(glyphs):
        if not g:
            continue
        gx = int(round(x + i * step))
        a[cy0:cy1, gx:gx + g] = (40, 40, 46, 255)
        a[cy0 + 2:cy1 - 2, gx + 1:gx + g - 1] = (206, 208, 212, 255)  # miolo vazado


def emblem(a, cx, cy):
    """Emblema fictício: anel cromado com três traços de velocidade (o mesmo do Gaúcho)."""
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    d = np.sqrt((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2)
    a[d <= 6.6] = INK
    ring = (d <= 6.0) & (d > 4.6)
    t = np.clip((yy + 0.5 - (cy - 6)) / 12, 0, 1)
    chrome = (np.array([244, 244, 246]) * (1 - t[..., None]) + np.array([150, 152, 158]) * t[..., None]).astype(np.uint8)
    a[ring, :3] = chrome[ring]
    inner = d <= 4.6
    a[inner, :3] = (14, 14, 18)
    for dy, n in ((-2, 6), (0, 4), (2, 2)):
        y = int(cy + dy)
        for x in range(int(cx + 3) - n, int(cx + 3)):
            if inner[y, x]:
                a[y, x, :3] = chrome[y, x]


def main():
    src, cars = sys.argv[1], sys.argv[2]
    for view in ('side', 'rear', 'front'):
        out = os.path.join(cars, f'br-uno-{view}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'src-{view}.png'), out, str(PERIOD[view])], check=True)
        a = np.array(Image.open(out).convert('RGBA'))
        H, W = a.shape[:2]
        if view == 'side':
            glass(a)
        if view == 'rear':
            body_fill(a, 19, 62, 39, 72, 17)      # emblema da marca
            body_fill(a, 131, 61, 171, 73, 128)   # letreiro com o nome do modelo
            plate(a, 70, 81, 118, 100)            # placa de loja -> genérica
            # adesivo no vidro traseiro: vira o vidro em volta
            for y in range(45, 55):
                a[y, 86:102] = a[y, 84]
        if view == 'front':
            # emblema da grade: refaz as listras da grade por baixo e põe o fictício
            for y in range(100, 117):
                a[y, 108:133] = a[y, 104]
            emblem(a, 120.0, 108.0)
        excl = {'rear': [], 'side': [], 'front': []}[view]
        cut = {
            'rear': [(12, 72, 34, 100), (153, 72, 178, 100)],
            'side': [(231, 46, 242, 64)],
            'front': [(68, 99, 172, 120)],  # grade (o "Turbo" vermelho fica)
        }[view]
        m = red_mask(a, excl, cut)
        flatten(a, m)
        outline(a)
        fix_glass(a, m, view)
        Image.fromarray(a, 'RGBA').save(out)
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(out.replace('.png', '-mask.png'))
        print(view, W, H, 'máscara', int(m.sum()))


if __name__ == '__main__':
    main()
