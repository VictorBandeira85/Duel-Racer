"""Sprites do Kaze NX (Honda NSX) a partir da arte do Victor (vermelho, fundo branco):
regrid.py na grade nativa (lateral 6,65 px, traseira 5,12 px, frente 5,63 px), emblemas reais
apagados (o H da traseira e do capô viram lataria; o "NSX" da placa da frente vira placa lisa;
o emblema da marca fictícia entra depois por brand_badges.py), máscara de pintura e vidros.

Uso: python3 tools/ref/nsx_sprites.py <pasta com src-side/rear/front.png> <src/assets/cars>
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

PERIOD = {'side': 6.65, 'rear': 5.12, 'front': 5.63}


def patch(a, x0, y0, x1, y1, ref):
    """repinta o retângulo com a cor de cada linha tirada da coluna `ref` (lataria ao lado)"""
    for y in range(y0, y1):
        a[y, x0:x1, :3] = a[y, ref, :3]


def main():
    src, out = sys.argv[1], sys.argv[2]
    for k, p in PERIOD.items():
        tmp = os.path.join(src, f'rg-{k}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'src-{k}.png'), tmp, str(p)], check=True, capture_output=True)
        a = np.array(Image.open(tmp).convert('RGBA'))
        H, W = a.shape[:2]
        cut = []
        if k == 'rear':
            # H no meio da faixa das lanternas: vira o painel escuro em volta
            hx, hy = W // 2, int(H * 0.40)
            sub = a[hy - 5:hy + 5, hx - 6:hx + 6, :3].astype(int)
            bright = sub.min(axis=2) > 150
            ys, xs = np.nonzero(bright)
            if len(xs):
                x0, x1, y0, y1 = hx - 6 + xs.min(), hx - 6 + xs.max() + 1, hy - 5 + ys.min(), hy - 5 + ys.max() + 1
                patch(a, x0, y0, x1, y1, x0 - 2)
            cut = [(10, int(H * 0.33), W - 10, int(H * 0.47))]  # faixa das lanternas
        elif k == 'front':
            # H do capô (no meio, acima da placa): lataria, cor de cada linha tirada ao lado
            patch(a, 82, 49, 104, 60, 80)
            # "NSX" da placa: placa preta lisa (só o que não é a lataria vermelha em volta)
            reg = a[64:80, 72:106, :3]
            rgb = reg.astype(int)
            plate = rgb[..., 0] - rgb[..., 1] < 40
            lum = rgb.mean(axis=2)
            base = np.median(lum[plate])
            reg[plate & (lum > base + 5)] = np.median(rgb[plate & (lum <= base + 5)], axis=0).astype(np.uint8)
        m = red_mask(a, cut=cut)
        fix_glass(a, m, k)
        Image.fromarray(a, 'RGBA').save(os.path.join(out, f'nsx-{k}.png'))
        mk = np.zeros_like(a)
        mk[..., :3] = np.where(m[..., None], 255, 0)
        mk[..., 3] = a[..., 3]
        Image.fromarray(mk, 'RGBA').save(os.path.join(out, f'nsx-{k}-mask.png'))
        print(k, W, H, 'pintura', int(m.sum()))


if __name__ == '__main__':
    main()
