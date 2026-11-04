"""Sprites do Toro LP5 (Countach) a partir da arte do Victor (vermelha, fundo branco):
regrid.py na grade nativa (lateral 6,01 px, traseira 8,81 px ampliada 2x, frente 5,86 px), vãos
brancos sob a asa transparentes, emblema real do capô trocado por um fictício (cunha prateada),
máscara de pintura da lataria vermelha (sem lanternas, bancos vistos pelo para-brisa) e vidros.

Uso: python3 tools/ref/lp5_sprites.py <pasta com src-side/rear/front.png> <src/assets/cars>
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from glass_fix import fix_glass  # noqa: E402
from vectra_sprites import red_mask  # noqa: E402

PERIOD = {'side': 6.01, 'rear': 8.81, 'front': 5.86}


def main():
    src, out = sys.argv[1], sys.argv[2]
    for k, p in PERIOD.items():
        tmp = os.path.join(src, f'rg-{k}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'src-{k}.png'), tmp, str(p)], check=True, capture_output=True)
        a = np.array(Image.open(tmp).convert('RGBA'))
        if k == 'rear':
            a[6:9, 30:82, 3] = 0  # vão branco sob a asa
            cut = [(5, 21, 29, 38), (81, 21, 108, 38)]  # lanternas
        elif k == 'front':
            white = (a[..., :3].min(axis=2) > 200)
            a[7:16, 50:134][white[7:16, 50:134], 3] = 0  # vão sob a asa
            # emblema real do capô: vira lataria e ganha uma cunha prateada fictícia
            body = a[60, 92, :3].copy()
            a[64:76, 86:97, :3] = body
            for i, row in enumerate(range(68, 72)):
                a[row, 88 + i:96 - i, :3] = (210, 212, 218) if i < 2 else (150, 152, 158)
            cut = [(52, 20, 132, 40), (86, 66, 97, 73)]  # bancos pelo para-brisa, emblema
        else:
            cut = []
        m = red_mask(a, cut=cut)
        fix_glass(a, m, k)
        if k == 'rear':  # 112 px: dobra (cada pixel da arte vira 2x2, mais nítido no jogo)
            a = np.repeat(np.repeat(a, 2, 0), 2, 1)
            m = np.repeat(np.repeat(m, 2, 0), 2, 1)
        Image.fromarray(a, 'RGBA').save(os.path.join(out, f'countach-{k}.png'))
        mk = np.zeros_like(a)
        mk[..., :3] = np.where(m[..., None], 255, 0)
        mk[..., 3] = a[..., 3]
        Image.fromarray(mk, 'RGBA').save(os.path.join(out, f'countach-{k}-mask.png'))
        print(k, a.shape[1], a.shape[0], 'pintura', int(m.sum()))


if __name__ == '__main__':
    main()
