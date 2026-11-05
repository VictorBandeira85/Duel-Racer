"""Sprites da Furia TR (Ferrari Testarossa) a partir das artes do Victor (pixel art ampliada):
- lateral e traseira vêm com transparência (fundo vira branco e o regrid.py tira); a frente vem
  num fundo escuro com brilho vermelho, recortado na grade nativa por cut_dark.py
- regrid.py na grade da arte (lateral 5,35 px, traseira 3,57 px, frente 5,31 px)
- o letreiro "testarossa" da traseira vira lataria; o cavalinho e os escudos viram o emblema da
  Fúria depois (brand_badges.py --only testarossa), inclusive o miolo das rodas da lateral
- máscara de pintura (sem as lanternas) e vidros

Uso: python3 tools/ref/testarossa_sprites.py <pasta com src-side/rear/front.png> <src/assets/cars>
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from cut_dark import cut  # noqa: E402
from glass_fix import fix_glass  # noqa: E402
from vectra_sprites import red_mask  # noqa: E402

PERIOD = {'side': 5.35, 'rear': 3.57, 'front': 5.31}
TEXT = {'rear': [(189, 54, 239, 63)]}
CUT = {
    'side': [],
    'rear': [(20, 67, 68, 93), (207, 67, 255, 93), (94, 101, 117, 122), (159, 101, 182, 122)],
    'front': [],
}


def main():
    src, out = sys.argv[1], sys.argv[2]
    for k, p in PERIOD.items():
        tmp = os.path.join(src, f'rg-{k}.png')
        if k == 'front':
            subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'src-{k}.png'), tmp, str(p)], check=True, capture_output=True)
            a = cut(np.array(Image.open(tmp).convert('RGB')))
        else:
            im = Image.open(os.path.join(src, f'src-{k}.png')).convert('RGBA')
            rgb = np.array(im)[..., :3].copy()
            rgb[np.array(im)[..., 3] < 128] = 255
            prep = os.path.join(src, f'prep-{k}.png')
            Image.fromarray(rgb).save(prep)
            subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), prep, tmp, str(p)], check=True, capture_output=True)
            a = np.array(Image.open(tmp).convert('RGBA'))
        for x0, y0, x1, y1 in TEXT.get(k, []):
            # o letreiro vira a lataria: cada coluna é a passagem suave entre a linha de cima e a de baixo
            top, bot = a[y0 - 1, x0:x1, :3].astype(float), a[y1, x0:x1, :3].astype(float)
            for y in range(y0, y1):
                t = (y - y0 + 1) / (y1 - y0 + 1)
                a[y, x0:x1, :3] = (top * (1 - t) + bot * t).astype(np.uint8)
        m = red_mask(a, cut=CUT[k])
        if k == 'front':
            fix_glass(a, m, k)
        Image.fromarray(a, 'RGBA').save(os.path.join(out, f'testarossa-{k}.png'))
        mk = np.zeros_like(a)
        mk[..., :3] = np.where(m[..., None], 255, 0)
        mk[..., 3] = a[..., 3]
        Image.fromarray(mk, 'RGBA').save(os.path.join(out, f'testarossa-{k}-mask.png'))
        print(k, a.shape[1], a.shape[0], 'pintura', int(m.sum()))


if __name__ == '__main__':
    main()
