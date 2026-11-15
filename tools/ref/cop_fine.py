"""Policial mostrando a multa (arte do Victor: policial à esquerda segurando um papel em branco, fundo magenta)
-> src/assets/people/fine-<id>.png na grade nativa (cor do miolo de cada bloco, sem borrar) + fine.json com:
paper = retângulo do papel em branco (onde o jogo escreve o auto de infração) e hand = caixa da mão que segura
o papel (é desenhada de novo por cima do texto). Uso: python3 tools/ref/cop_fine.py <arte.png> <id> [bloco]
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/people')


def main():
    src, cid = sys.argv[1], sys.argv[2]
    blk = float(sys.argv[3]) if len(sys.argv) > 3 else 6.0
    a = np.array(Image.open(src).convert('RGB')).astype(int)
    H, W = a.shape[:2]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = (r > 170) & (g < 110) & (b > 170)
    white = a.min(-1) > 225
    n, lab, st, _ = cv2.connectedComponentsWithStats(white.astype(np.uint8), connectivity=4)
    i = 1 + int(np.argmax(st[1:, 4]))
    px0, py0, pw, ph = st[i, :4]
    skin = (r > 190) & (g > 120) & (b < 120) & (r - b > 70)
    hs = skin.copy()
    hs[:, :px0 + pw // 2] = False
    ys, xs = np.nonzero(hs)
    hand = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
    keep = ~mag
    nx, ny = int(W / blk), int(H / blk)
    o = np.zeros((ny, nx, 4), np.uint8)
    rr = max(1, int(blk * 0.2))
    for j in range(ny):
        for k in range(nx):
            cy, cx = int((j + 0.5) * blk), int((k + 0.5) * blk)
            m = keep[max(0, cy - rr):cy + rr + 1, max(0, cx - rr):cx + rr + 1]
            if m.mean() < 0.5:
                continue
            p = a[max(0, cy - rr):cy + rr + 1, max(0, cx - rr):cx + rr + 1][m]
            o[j, k] = [*np.median(p, axis=0).astype(np.uint8), 255]
    Image.fromarray(o).save(os.path.join(OUT, f'fine-{cid}.png'), optimize=True)
    f = lambda v: round(v / blk, 1)
    jp = os.path.join(OUT, 'fine.json')
    meta = json.load(open(jp)) if os.path.exists(jp) else {}
    meta[cid] = {'w': nx, 'h': ny, 'paper': [f(px0), f(py0), f(px0 + pw), f(py0 + ph)], 'hand': [f(v) for v in hand]}
    json.dump(meta, open(jp, 'w'), indent=1)
    print(cid, meta[cid])


if __name__ == '__main__':
    main()
