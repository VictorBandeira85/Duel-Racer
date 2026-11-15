"""Animação dos policiais (folhas do Victor: 6 quadros lado a lado sobre magenta: 4 de caminhada vindo de
frente e 2 parado mandando parar) -> src/assets/people/cop-<id>-walk0..3.png e cop-<id>-stop0..1.png, na
MESMA escala dos sprites parados (cop_sprites.py): o bloco de cada folha é a altura do personagem dividida
pela altura do sprite stand daquele policial; cada bloco vira a cor do miolo (sem borrar). Pés na última
linha; acrescenta largura, altura e meio dos pés ao cops.json.
Uso: python3 tools/ref/cop_walk.py <pasta com walkD1.png ... walkS2.png> [saída=src/assets/people]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

IDS = ['D1', 'D2', 'C1', 'C2', 'B1', 'B2', 'A1', 'A2', 'S1', 'S2']
POSES = ['walk0', 'walk1', 'walk2', 'walk3', 'stop0', 'stop1']


def magenta(a):
    return (a[..., 0] > 160) & (a[..., 1] < 120) & (a[..., 2] > 160)


def to_native(a, mag, P, y0, y1):
    """amostra cada bloco de P px (P não inteiro) pelo miolo; linhas ancoradas nos pés (y1)"""
    xs = np.where((~mag[y0:y1]).any(0))[0]
    x0, x1 = xs.min(), xs.max() + 1
    nrow = int(round((y1 - y0) / P))
    rows = y1 - P / 2 - np.arange(nrow)[::-1] * P
    cols = np.arange(x0 + P / 2, x1, P)
    r = max(1, int(P * 0.25))
    o = np.zeros((len(rows), len(cols), 4), np.uint8)
    for j, cy in enumerate(rows):
        for i, cx in enumerate(cols):
            yy, xx = int(cy), int(cx)
            blk = a[yy - r:yy + r + 1, xx - r:xx + r + 1].reshape(-1, 3)
            m = mag[yy - r:yy + r + 1, xx - r:xx + r + 1].reshape(-1)
            if m.mean() > 0.5:
                continue
            o[j, i] = [*np.median(blk[~m], axis=0).astype(np.uint8), 255]
    yy, xx = np.where(o[..., 3] > 0)
    return o[:, xx.min():xx.max() + 1]  # mantém a linha de baixo (pés) e a altura total


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/people')
    mp = os.path.join(out, 'cops.json')
    meta = json.load(open(mp))
    for cid in IDS:
        a = np.array(Image.open(os.path.join(src, f'walk{cid}.png')).convert('RGB')).astype(int)
        mag = magenta(a)
        # tira ruído: só conta coluna com bastante pixel não-magenta
        cols = (~mag).sum(0) > 3
        segs, s = [], None
        for x, v in enumerate(list(cols) + [False]):
            if v and s is None:
                s = x
            if not v and s is not None:
                if x - s > 40:
                    segs.append((s, x))
                s = None
        assert len(segs) == 6, (cid, segs)
        tgt = meta[f'{cid}-stand'][1]
        boxes = []
        for x0, x1 in segs:
            sub = ~mag[:, x0:x1]
            ys = np.where(sub.sum(1) > 1)[0]
            boxes.append((ys.min(), ys.max() + 1))
        # escala: a altura do quadro parado (stop0) casa com o stand
        hs = boxes[4][1] - boxes[4][0]
        P = hs / tgt
        for pose, (x0, x1), (y0, y1) in zip(POSES, segs, boxes):
            sa, sm = a[:, max(0, x0 - 6):x1 + 6], mag[:, max(0, x0 - 6):x1 + 6]
            o = to_native(sa, sm, P, y0, y1)
            hb = max(2, int(o.shape[0] * 0.06))
            fx = np.where(o[-hb:, :, 3].any(0))[0]
            foot = float((fx.min() + fx.max() + 1) / 2)
            if pose.startswith('walk'):  # na caminhada, o meio do corpo (cintura) segura melhor que os pés abertos
                mid = o[int(o.shape[0] * 0.45):int(o.shape[0] * 0.55), :, 3].any(0)
                mx = np.where(mid)[0]
                foot = float((mx.min() + mx.max() + 1) / 2)
            Image.fromarray(o).save(os.path.join(out, f'cop-{cid}-{pose}.png'), optimize=True)
            meta[f'{cid}-{pose}'] = [int(o.shape[1]), int(o.shape[0]), round(foot, 1)]
            print(cid, pose, o.shape[1], 'x', o.shape[0], 'bloco', round(P, 2))
    with open(mp, 'w') as f:
        json.dump(meta, f, indent=0)


if __name__ == '__main__':
    main()
