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
    # o volante é desenhado 10 colunas à direita (wheelDx, centrado no quadro): a parte da faixa
    # do aro antigo que fica à esquerda do aro novo aparecia como um aro-sombra; vira o painel
    # da esquerda na mesma linha (o painel tem estrutura horizontal)
    rho_new = np.hypot((xx + 0.5 - 240.1) / 96.1, (yy + 0.5 - 103.8) / 104.2)
    old = (rho > 0.78) & (rho < 1.13) & (xx < 230) & (rho_new > 1.0)
    for y in range(H):
        xs = np.nonzero(old[y])[0]
        if not len(xs):
            continue
        src = a[y, max(0, xs.min() - 1)].copy()
        a[y, xs] = src
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
