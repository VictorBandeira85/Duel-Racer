"""Acabamento da cabine do Passeio GTS (depois de import_cockpit.py br-passat e de
gtb_rim_fix.py ... ceu):
- branco preso entre a porta e o retrovisor (o vidro lateral visto na arte): transparente (céu)
- volante: o emblema da marca vira o fictício
Uso: python3 tools/ref/passat_cockpit.py src/assets/cockpit
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image


def main():
    d = sys.argv[1]
    wp, dp, tp = (os.path.join(d, f'br-passat-{k}.png') for k in ('wheel', 'dash', 'top'))
    w = np.array(Image.open(wp).convert('RGBA'))
    a = np.array(Image.open(dp).convert('RGBA'))
    t = np.array(Image.open(tp).convert('RGBA'))
    al = np.vstack([t, a])
    rgb = al[..., :3].astype(int)
    white = ((al[..., 3] > 0) & (rgb.min(axis=2) > 215)).astype(np.uint8)
    white[:, 110:350] = 0  # só os vidros laterais (fora do miolo da cabine)
    n, lab, st, _ = cv2.connectedComponentsWithStats(white, 4)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 15:
            al[lab == i, 3] = 0
    t, a = al[:t.shape[0]], al[t.shape[0]:]
    # faixa do aro antigo: a média puxou o vermelho do friso do painel; volta a cinza-escuro
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    rgb = a[..., :3].astype(int)
    rho = np.hypot((xx + 0.5 - 230.1) / 96.1, (yy + 0.5 - 103.8) / 104.2)
    red = (rgb[..., 0] > rgb[..., 1] + 3) & (rho > 0.82) & (rho < 1.14) & (yy < 40)
    g = ((rgb[..., 1] + rgb[..., 2]) // 2).astype(np.uint8)
    for k in range(3):
        a[..., k] = np.where(red, g, a[..., k])
    # o aro recortado da arte pegou o friso vermelho do painel no alto: cinza como o resto do aro
    wr = w[..., :3].astype(int)
    redw = (wr[..., 0] > wr[..., 1] + 3) & (w[..., 3] > 0) & (np.arange(w.shape[0])[:, None] < 70)
    gw = ((wr[..., 1] + wr[..., 2]) // 2).astype(np.uint8)
    for k in range(3):
        w[..., k] = np.where(redw, gw, w[..., k])
    # o volante é desenhado 10 colunas à direita (wheelDx, centrado no quadro): a faixa do aro
    # antigo (refeita borrada por gtb_rim_fix) fica exposta fora do aro novo e dentro do vão
    # dele. Cada trecho exposto vira a passagem, na mesma linha, entre o painel limpo à esquerda
    # e à direita dele (o painel tem estrutura horizontal), com um leve borrão vertical
    rho_new = np.hypot((xx + 0.5 - 240.1) / 96.1, (yy + 0.5 - 103.8) / 104.2)
    old = (rho > 0.76) & (rho < 1.15) & (a[..., 3] > 0) & ~((rho_new > 0.9) & (rho_new < 1.0))
    rgb0 = a[..., :3].astype(int)
    # o vermelho das marcas do conta-giros não serve de referência (riscaria o painel)
    known = (a[..., 3] > 0) & ~old & ~(rgb0[..., 0] > rgb0[..., 1] + 10)
    f = a[..., :3].astype(np.float32)
    out = f.copy()
    for y in range(H):
        xs = np.nonzero(old[y])[0]
        if not len(xs):
            continue
        runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
        for r in runs:
            l, rgt = r[0] - 1, r[-1] + 1
            while l >= 0 and not known[y, l]:
                l -= 1
            while rgt < W and not known[y, rgt]:
                rgt += 1
            cl = f[y, l] if l >= 0 else None
            cr = f[y, rgt] if rgt < W else None
            for x in r:
                if cl is not None and cr is not None:
                    k = (x - l) / (rgt - l)
                    out[y, x] = cl * (1 - k) + cr * k
                else:
                    out[y, x] = cl if cl is not None else cr if cr is not None else f[y, x]
    sm = cv2.blur(out, (1, 5))
    a[old, :3] = np.clip(sm[old], 0, 255).astype(np.uint8)
    # emblema do volante
    cx, cy = 128.5, 112.0
    yy, xx = np.mgrid[0:w.shape[0], 0:w.shape[1]]
    dd = np.sqrt((xx + 0.5 - cx) ** 2 + ((yy + 0.5 - cy) / 1.1) ** 2)
    ring = (dd > 12.5) & (dd < 15) & (w[..., 3] > 0)
    w[dd <= 12.5, :3] = np.median(w[ring, :3], axis=0).astype(np.uint8)
    w[dd <= 9.2, :3] = (12, 12, 14)
    chrome = (dd <= 8.4) & (dd > 6.8)
    tt = np.clip((yy + 0.5 - (cy - 9)) / 18, 0, 1)
    col = (np.array([238, 238, 242]) * (1 - tt[..., None]) + np.array([128, 130, 136]) * tt[..., None]).astype(np.uint8)
    w[chrome, :3] = col[chrome]
    for dy, k in ((-3, 8), (0, 5), (3, 3)):
        y = int(cy + dy)
        for x in range(int(cx + 4) - k, int(cx + 4)):
            w[y, x, :3] = col[y, x]
    Image.fromarray(w).save(wp)
    Image.fromarray(np.ascontiguousarray(a)).save(dp)
    Image.fromarray(np.ascontiguousarray(t)).save(tp)
    print('vidro lateral e emblema')


if __name__ == '__main__':
    main()
