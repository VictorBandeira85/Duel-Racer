"""Sprites do Serpe V10 (Dodge Viper RT/10) a partir da arte do Victor (preparada por
viper_prep.py): regrid.py na grade nativa (lateral 7,92 px, traseira 5,24 px, frente 7,36 px),
o xadrez preso no arco vira transparente, os letreiros e emblemas reais (VIPER RT/10, DODGE e a
cobra) viram lataria (o emblema da Serpe entra com brand_badges.py), máscara de pintura e vidros.

Uso: python3 tools/ref/viper_sprites.py <pasta com prep-*.png> <src/assets/cars>
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

PERIOD = {'side': 7.92, 'rear': 5.24, 'front': 7.36}
# letreiros/emblemas: (x0, y0, x1, y1) em pixels do sprite; o claro dentro vira a cor de cada
# linha tirada do que não é claro no próprio retângulo
TEXT = {
    'side': [(74, 53, 108, 63)],
    'rear': [(30, 102, 72, 115), (162, 100, 213, 115)],
    'front': [(82, 68, 98, 81), (108, 82, 148, 92)],
}
CUT = {'side': [(244, 42, 263, 52)], 'rear': [(10, 72, 62, 92), (174, 72, 226, 92)], 'front': []}


def main():
    src, out = sys.argv[1], sys.argv[2]
    for k, p in PERIOD.items():
        tmp = os.path.join(src, f'rg-{k}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'prep-{k}.png'), tmp, str(p)], check=True, capture_output=True)
        a = np.array(Image.open(tmp).convert('RGBA'))
        rgb = a[..., :3].astype(int)
        mag = (rgb[..., 0] > 200) & (rgb[..., 1] < 80) & (rgb[..., 2] > 200)
        a[mag, 3] = 0
        for x0, y0, x1, y1 in TEXT[k]:
            # cada linha do retângulo vira a lataria da própria linha (mediana da faixa um pouco
            # maior, sem os pontos mais claros e mais escuros): o letreiro some inteiro
            for y in range(y0, y1):
                band = a[y, max(0, x0 - 6):x1 + 6, :3].astype(int)
                lum = band.mean(axis=1)
                lo, hi = np.percentile(lum, 25), np.percentile(lum, 60)
                body = band[(lum >= lo) & (lum <= hi)]
                col = np.median(body, axis=0) if len(body) else band.mean(axis=0)
                seg = a[y, x0:x1, :3].astype(int)
                dev = np.abs(seg.mean(axis=1) - col.mean()) > 10
                a[y, x0:x1, :3][dev] = col.astype(np.uint8)
        if k == 'rear':  # emblema da cobra na placa: placa preta lisa
            reg = a[74:93, 100:137, :3]
            r = reg.astype(int)
            plate = (r[..., 0] - r[..., 1] < 40)
            dark = plate & (r.mean(axis=2) < 50)
            reg[plate & ~dark & (r.mean(axis=2) >= 50)] = np.median(r[dark], axis=0).astype(np.uint8)
        m = red_mask(a, cut=CUT[k])
        if k == 'front':  # só a frente tem para-brisa à vista (o claro atrás dos bancos)
            fix_glass(a, m, k)
        Image.fromarray(a, 'RGBA').save(os.path.join(out, f'viper-{k}.png'))
        mk = np.zeros_like(a)
        mk[..., :3] = np.where(m[..., None], 255, 0)
        mk[..., 3] = a[..., 3]
        Image.fromarray(mk, 'RGBA').save(os.path.join(out, f'viper-{k}-mask.png'))
        print(k, a.shape[1], a.shape[0], 'pintura', int(m.sum()))


if __name__ == '__main__':
    main()
