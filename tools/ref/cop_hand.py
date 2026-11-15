"""Mão do policial segurando a multa (arte do Victor: braço entrando pela esquerda, papel branco em branco à
direita, fundo magenta) -> src/assets/people/hand-<id>.png na grade nativa. O magenta e o papel saem (o jogo
desenha o auto de infração dele); fica a manga, o braço e a mão. Grava também em hand.json o ponto onde o papel
encosta na mão (borda esquerda do papel, à altura do polegar), para o jogo casar com o papel dele.
Uso: python3 tools/ref/cop_hand.py <arte.png> <id> [bloco]
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'src/assets/people')


def main():
    src, cid = sys.argv[1], sys.argv[2]
    blk = float(sys.argv[3]) if len(sys.argv) > 3 else 6.0
    a = np.array(Image.open(src).convert('RGB')).astype(int)
    H, W = a.shape[:2]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = (r > 170) & (g < 110) & (b > 170)
    white = (r > 225) & (g > 225) & (b > 215) & (np.abs(r - b) < 30)
    # papel: a maior mancha branca ligada à borda direita
    n, lab, st, _ = cv2.connectedComponentsWithStats(white.astype(np.uint8), connectivity=4)
    paper = np.zeros_like(white)
    for i in range(1, n):
        if st[i, 0] + st[i, 2] >= W - 2 and st[i, 4] > 5000:
            paper |= lab == i
    # contorno preto do papel (linha escura colada ao papel, fora da mão): também sai
    dark = (a.max(-1) < 70)
    near = cv2.dilate(paper.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0
    skin = (r > 150) & (g > 80) & (b < 120) & (r - b > 60)
    skin_near = cv2.dilate(skin.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    edge = dark & near & ~skin_near
    keep = ~mag & ~paper & ~edge
    # só a maior mancha (braço + mão)
    n, lab, st, _ = cv2.connectedComponentsWithStats(keep.astype(np.uint8), connectivity=8)
    big = 1 + int(np.argmax(st[1:, 4]))
    keep = lab == big
    # ponto de pega: canto inferior esquerdo... a borda esquerda do papel na altura do meio da mão
    ys, xs = np.nonzero(paper)
    left_x = np.array([xs[ys == y].min() if (ys == y).any() else W for y in range(H)])
    rows = np.nonzero(left_x < W)[0]
    gy = int(np.median(rows))
    gx = int(left_x[gy])
    # grade nativa: miolo de cada bloco
    nx, ny = int(W / blk), int(H / blk)
    o = np.zeros((ny, nx, 4), np.uint8)
    rr = max(1, int(blk * 0.2))
    for j in range(ny):
        for i in range(nx):
            cy, cx = int((j + 0.5) * blk), int((i + 0.5) * blk)
            m = keep[max(0, cy - rr):cy + rr + 1, max(0, cx - rr):cx + rr + 1]
            if m.mean() < 0.5:
                continue
            px = a[max(0, cy - rr):cy + rr + 1, max(0, cx - rr):cx + rr + 1][m]
            o[j, i] = [*np.median(px, axis=0).astype(np.uint8), 255]
    # sobra do contorno do papel: traço fino solto (pouca coisa opaca em volta)
    al = (o[..., 3] > 0).astype(np.float32)
    dens = cv2.blur(al, (5, 5))
    lum = o[..., :3].max(-1)
    o[(al > 0) & (dens < 0.42) & (lum < 90)] = 0
    yy, xx = np.nonzero(o[..., 3])
    x0, y0, x1, y1 = xx.min(), yy.min(), xx.max() + 1, yy.max() + 1
    o = o[y0:y1, x0:x1]
    Image.fromarray(o).save(os.path.join(OUT, f'hand-{cid}.png'), optimize=True)
    jp = os.path.join(OUT, 'hand.json')
    meta = json.load(open(jp)) if os.path.exists(jp) else {}
    meta[cid] = {'w': int(o.shape[1]), 'h': int(o.shape[0]), 'grip': [round(gx / blk - x0, 1), round(gy / blk - y0, 1)],
                 'paperTop': round(rows.min() / blk - y0, 1), 'paperBottom': round(rows.max() / blk - y0, 1)}
    json.dump(meta, open(jp, 'w'), indent=1)
    print(cid, meta[cid])


if __name__ == '__main__':
    main()
