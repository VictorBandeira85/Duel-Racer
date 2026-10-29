"""Sprites do Onça GTE (Puma GTE) a partir da arte ampliada: reamostra na grade nativa
(regrid.py), troca o branco da janela lateral por vidro, alisa a lataria e gera a máscara de
pintura pelo matiz vermelho, sem as lanternas (vermelhas, dentro dos aros cromados). O emblema
da fábrica real ao lado do "GTE" na traseira vira lataria lisa.

Uso: python3 tools/ref/onca_gte_sprites.py <pasta com src-side/rear/front.png> <src/assets/cars>
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from vectra_sprites import flatten, glass, outline, red_mask  # noqa: E402

PERIOD = {'side': 7.82, 'rear': 9.93, 'front': 5.74}


def main():
    src, cars = sys.argv[1], sys.argv[2]
    for view in ('side', 'rear', 'front'):
        out = os.path.join(cars, f'br-pumagte-{view}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'src-{view}.png'), out, str(PERIOD[view])], check=True)
        a = np.array(Image.open(out).convert('RGBA'))
        H, W = a.shape[:2]
        if view == 'side':
            glass(a)
        cut = []
        if view == 'rear':
            # emblema da marca (à esquerda do GTE): lataria lisa no lugar
            x0, y0, x1, y1 = 63, 21, 70, 27
            box = a[y0:y1, x0:x1, :3].astype(int)
            red = (box[..., 0] > box[..., 2] + 80) & (box[..., 0] > 150)
            body = np.median(box[red], axis=0) if red.any() else np.array([210, 30, 20])
            a[y0:y1, x0:x1][~red, :3] = body.astype(np.uint8)
            cut = [(10, 29, 31, 40), (71, 29, 93, 40)]  # lanternas
        m = red_mask(a, (), cut)
        flatten(a, m)
        outline(a)
        Image.fromarray(a, 'RGBA').save(out)
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(out.replace('.png', '-mask.png'))
        print(view, W, H, 'máscara', int(m.sum()))


if __name__ == '__main__':
    main()
