"""Capô e para-lamas do Serpe V10 mais baixos na cabine (pedido do Victor: as bossas do capô vistas
de dentro ficavam altas demais e tapavam a estrada). Em cada coluna onde o topo opaco é o capô (não a
coluna da porta nem o retrovisor, que começam no alto da arte), o trecho do capô, do topo até a faixa
azul do friso do painel, é comprimido para K da altura, encostado embaixo (o friso e o painel não
mudam); o que sobra em cima vira vidro (transparente). Vale igual para as máscaras de pintura.
Uso: python3 tools/ref/viper_hood_lower.py <pasta com viper-top/dash(-mask).png originais> src/assets/cockpit [K=0.55]
"""
import os
import sys

import numpy as np
from PIL import Image


def main():
    src, dst = sys.argv[1], sys.argv[2]
    K = float(sys.argv[3]) if len(sys.argv) > 3 else 0.55
    ld = lambda n, m='RGBA': np.array(Image.open(os.path.join(src, n)).convert(m))
    t, d = ld('viper-top.png'), ld('viper-dash.png')
    tm, dm = ld('viper-top-mask.png', 'L'), ld('viper-dash-mask.png', 'L')
    TH = t.shape[0]
    a = np.vstack([t, d]).astype(np.int32)
    m = np.vstack([tm, dm])
    oa, om = a.copy(), m.copy()
    H, W = a.shape[:2]
    X0 = 96  # à esquerda daqui: coluna da porta e retrovisor (não mexe)
    hood = m > 127  # o capô é a área de pintura (máscara) acima do painel
    y0s, ybs = np.full(W, -1), np.full(W, -1.0)
    for x in range(X0, W):
        ys = np.where(hood[:50 + TH, x])[0]
        ys = ys[ys >= 40]
        if not len(ys):
            continue
        top = ys.min()
        # o contorno escuro do capô fica logo acima da pintura
        y0 = top
        while y0 > 40 and a[y0 - 1, x, 3] > 0 and a[y0 - 1, x, :3].sum() < 200:
            y0 -= 1
        y0s[x], ybs[x] = y0, ys.max() + 1
    ok = ybs >= 0
    xs = np.arange(W)
    base = np.interp(xs, xs[ok], ybs[ok])
    sm = np.array([np.median(base[max(X0, i - 4):i + 5]) for i in range(W)])
    for x in range(X0, W):
        y0 = y0s[x]
        if y0 < 0:
            continue
        yb = int(round(max(sm[x], ybs[x])))
        h = yb - y0
        if h < 3:
            continue
        col = a[:, x]
        nh = max(2, int(round(h * K)))
        seg, segm = col[y0:yb].copy(), m[y0:yb, x].copy()
        idx = np.clip(np.round(np.linspace(0, h - 1, nh)).astype(int), 0, h - 1)
        oa[y0:yb, x] = 0
        om[y0:yb, x] = 0
        oa[yb - nh:yb, x] = seg[idx]
        om[yb - nh:yb, x] = segm[idx]
    # sobras do contorno antigo que ficaram soltas no vidro: grupos pequenos acima do capô somem
    import cv2
    reg = (oa[:, :, 3] > 0).astype(np.uint8)
    reg[:40] = 0
    reg[:, :X0] = 0
    reg[TH + 12:] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(reg, connectivity=8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 12:
            oa[lab == i] = 0
            om[lab == i] = 0
    for arr, nm, mode in [(oa[:TH], 'viper-top.png', 'RGBA'), (oa[TH:], 'viper-dash.png', 'RGBA'), (om[:TH], 'viper-top-mask.png', 'L'), (om[TH:], 'viper-dash-mask.png', 'L')]:
        Image.fromarray(arr.astype(np.uint8), mode).save(os.path.join(dst, nm), optimize=True)
    print('ok K =', K)


if __name__ == '__main__':
    main()
