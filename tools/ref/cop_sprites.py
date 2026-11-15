"""Policiais por classe (folhas do Victor: 3 poses lado a lado sobre magenta #FF00FF) -> sprites nativos
src/assets/people/cop-<id>-<pose>.png (pose: stand, wave, paper) e src/assets/people/cops.json com a
largura, a altura e o x do meio dos pés de cada um (âncora do pé no jogo). Cada pose é recortada pelas
colunas sem magenta, a grade da pixel art é achada (período e fase dos blocos) e cada bloco vira a cor
do miolo (sem borrar), como em scenery_sprite.py. Pés de todos na última linha.
Uso: python3 tools/ref/cop_sprites.py <pasta com as folhas> [saída=src/assets/people]
As folhas: copD1.png copD2.png copC1.png ... copS2.png na pasta dada.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))

IDS = ['D1', 'D2', 'C1', 'C2', 'B1', 'B2', 'A1', 'A2', 'S1', 'S2']
POSES = ['stand', 'wave', 'paper']


def magenta(a):
    return (a[..., 0] > 170) & (a[..., 1] < 110) & (a[..., 2] > 170)


P = 8.0  # bloco fixo: a grade das folhas é irregular (o detector pula entre harmônicas); com o mesmo
# bloco em todas, os 10 policiais saem na mesma escala (~115 linhas de altura)


def to_native(a, mag):
    """cor do miolo (mediana dos 4x4 do centro) de cada bloco de P px, a partir do topo/esquerda do recorte"""
    ys, xs = np.where(~mag)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rows = np.arange(y0 + P / 2, y1, P)
    cols = np.arange(x0 + P / 2, x1, P)
    r = 2
    o = np.zeros((len(rows), len(cols), 4), np.uint8)
    for j, cy in enumerate(rows):
        for i, cx in enumerate(cols):
            yy, xx = int(cy), int(cx)
            blk = a[yy - r:yy + r, xx - r:xx + r].reshape(-1, 3)
            m = mag[yy - r:yy + r, xx - r:xx + r].reshape(-1)
            if m.mean() > 0.5:
                continue
            o[j, i] = [*np.median(blk[~m], axis=0).astype(np.uint8), 255]
    yy, xx = np.where(o[..., 3] > 0)
    return o[yy.min():yy.max() + 1, xx.min():xx.max() + 1], P


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/people')
    os.makedirs(out, exist_ok=True)
    meta = {}
    for cid in IDS:
        a = np.array(Image.open(os.path.join(src, f'cop{cid}.png')).convert('RGB')).astype(int)
        mag = magenta(a)
        cols = (~mag).sum(0) > 0
        segs, s = [], None
        for x, v in enumerate(cols):
            if v and s is None:
                s = x
            if not v and s is not None:
                if x - s > 30:
                    segs.append((s, x))
                s = None
        assert len(segs) == 3, (cid, segs)
        for pose, (x0, x1) in zip(POSES, segs):
            sub_a, sub_m = a[:, max(0, x0 - 4):x1 + 4], mag[:, max(0, x0 - 4):x1 + 4]
            o, p = to_native(sub_a, sub_m)
            # meio dos pés: colunas opacas nas 6% de baixo
            hb = max(2, int(o.shape[0] * 0.06))
            fx = np.where(o[-hb:, :, 3].any(0))[0]
            foot = float((fx.min() + fx.max() + 1) / 2)
            name = f'cop-{cid}-{pose}'
            Image.fromarray(o).save(os.path.join(out, name + '.png'), optimize=True)
            meta[f'{cid}-{pose}'] = [int(o.shape[1]), int(o.shape[0]), round(foot, 1)]
            print(name, o.shape[1], 'x', o.shape[0], 'bloco', round(p, 2), 'pé', round(foot, 1))
    with open(os.path.join(out, 'cops.json'), 'w') as f:
        json.dump(meta, f, indent=0)


if __name__ == '__main__':
    main()
