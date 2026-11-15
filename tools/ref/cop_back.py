"""Policiais voltando para a viatura DE COSTAS (folhas do Victor: 4 quadros de caminhada vistos de costas
sobre magenta) -> src/assets/people/cop-<id>-back0..3.png, na MESMA escala dos walk0..3 de frente
(cop_walk.py): o bloco de cada folha é a altura média dos 4 quadros dividida pela altura média dos walk0..3
daquele policial; cada bloco vira a cor do miolo (sem borrar), pés na última linha e apoio na cintura.
Uso: python3 tools/ref/cop_back.py <pasta com backD1.png ... backS2.png> [saída=src/assets/people]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from cop_walk import IDS, magenta, to_native  # noqa: E402


def segments(mag, n):
    cols = (~mag).sum(0) > 3
    segs, s = [], None
    for x, v in enumerate(list(cols) + [False]):
        if v and s is None:
            s = x
        if not v and s is not None:
            if x - s > 40:
                segs.append((s, x))
            s = None
    assert len(segs) == n, segs
    return segs


def demagenta(o):
    """restos do fundo magenta (r e b bem acima de g) viram a cor dos vizinhos limpos"""
    rgb = o[..., :3].astype(int)
    bad = (o[..., 3] > 0) & (np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1] > 50)
    for y, x in zip(*np.where(bad)):
        nb = [o[j, i] for j in range(max(0, y - 1), min(o.shape[0], y + 2)) for i in range(max(0, x - 1), min(o.shape[1], x + 2))
              if o[j, i, 3] > 0 and not bad[j, i]]
        o[y, x] = np.median(nb, axis=0).astype(np.uint8) if nb else 0
    return o


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/people')
    mp = os.path.join(out, 'cops.json')
    meta = json.load(open(mp))
    for cid in IDS:
        a = np.array(Image.open(os.path.join(src, f'back{cid}.png')).convert('RGB')).astype(int)
        mag = magenta(a)
        segs = segments(mag, 4)
        boxes = []
        for x0, x1 in segs:
            ys = np.where((~mag[:, x0:x1]).sum(1) > 1)[0]
            boxes.append((ys.min(), ys.max() + 1))
        tgt = np.mean([meta[f'{cid}-walk{i}'][1] for i in range(4)])
        P = np.mean([y1 - y0 for y0, y1 in boxes]) / tgt
        for i, ((x0, x1), (y0, y1)) in enumerate(zip(segs, boxes)):
            sa, sm = a[:, max(0, x0 - 6):x1 + 6], mag[:, max(0, x0 - 6):x1 + 6]
            o = demagenta(to_native(sa, sm, P, y0, y1))
            # apoio na cintura (meio do corpo), como nos walk de frente: os pés abertos balançam
            mid = o[int(o.shape[0] * 0.45):int(o.shape[0] * 0.55), :, 3].any(0)
            mx = np.where(mid)[0]
            foot = float((mx.min() + mx.max() + 1) / 2)
            Image.fromarray(o).save(os.path.join(out, f'cop-{cid}-back{i}.png'), optimize=True)
            meta[f'{cid}-back{i}'] = [int(o.shape[1]), int(o.shape[0]), round(foot, 1)]
            print(cid, f'back{i}', o.shape[1], 'x', o.shape[0], 'bloco', round(P, 2), 'walk', round(tgt, 1))
    with open(mp, 'w') as f:
        json.dump(meta, f, indent=0)


if __name__ == '__main__':
    main()
