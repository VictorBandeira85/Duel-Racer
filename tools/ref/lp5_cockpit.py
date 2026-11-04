"""Cabine do Toro LP5 (Countach) a partir das duas artes do Victor: interior SEM volante (vira o
painel e o teto, sem nada a reconstruir embaixo do aro) e COM volante (de onde sai só o volante,
recortado pela geometria do aro, raios e miolo). Escala 0,46 (pixel 8:7), como as outras cabines.
- para-brisa (branco ligado ao alto) e palhetas do limpador viram vidro transparente; o
  retrovisor interno sai (o jogo desenha o dele)
- emblema real do miolo do volante vira um fictício (anel prateado com o centro vermelho)
- os mostradores são redesenhados pelo jogo (cockpit.ts), funcionando

Uso: python3 tools/ref/lp5_cockpit.py <pasta com cab-nowheel.png e cab-wheel.png> <src/assets/cockpit>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

S = 0.46
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV = (392.0, 536.0)        # centro do aro na arte
PIV_N = (128.0, 104.0)      # e na cabine (pixels nativos)
ROWS, EXT, PAD = 124, 76, 102
WTOP = 8                    # linhas do volante acima do topo do painel
WROWS = 230
RIM = ((215, 215), (184, 183))   # semi-eixos externo e interno do aro (px da arte)
HUB_TOP = 495               # dentro do aro, acima disto é o painel (mostradores)


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD):
    xs = PIV[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys):
    xi = np.clip(xs.astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def main():
    d, out = sys.argv[1], sys.argv[2]
    nw = cv2.cvtColor(cv2.imread(os.path.join(d, 'cab-nowheel.png')), cv2.COLOR_BGR2RGB)
    ww = cv2.cvtColor(cv2.imread(os.path.join(d, 'cab-wheel.png')), cv2.COLOR_BGR2RGB)
    H, W = nw.shape[:2]
    # vidro: branco ligado ao alto; fecha as palhetas do limpador (linhas escuras finas no branco)
    white = (nw.min(axis=2) > 215).astype(np.uint8)
    ff = white.copy()
    msk = np.zeros((H + 2, W + 2), np.uint8)
    for x in range(0, W, 6):
        if ff[110, x]:
            cv2.floodFill(ff, msk, (x, 110), 2)
    for y in range(0, 700, 6):  # vidro da janela lateral (ligado à borda esquerda)
        if ff[y, 0] == 1:
            cv2.floodFill(ff, msk, (0, y), 2)
    sky = ff == 2
    sky[:345] |= white[:345] > 0  # brancos presos entre as palhetas também são vidro
    # acima da borda do painel, entre as colunas, o que não é a lataria vermelha é vidro (palhetas)
    reg = nw[:336, 140:1150].astype(int)
    sky[:336, 140:1150] |= ~((reg[..., 0] > 140) & (reg[..., 1] < 90))
    # palhetas: trechos escuros curtos (na vertical) entre dois pedaços de vidro, acima do painel
    for x in range(W):
        col = sky[:350, x]
        ys_ = np.nonzero(col)[0]
        if len(ys_) < 2:
            continue
        gaps = np.nonzero(np.diff(ys_) > 1)[0]
        for g in gaps:
            a_, b_ = ys_[g] + 1, ys_[g + 1]
            if b_ - a_ < 22 and not (nw[a_:b_, x, 0] > 150).any():
                sky[a_:b_, x] = True
    # retrovisor interno e sua haste: vidro
    sky[60:200, 470:800] |= ~((nw[60:200, 470:800, 0] > 150) & (nw[60:200, 470:800, 1] < 80))
    y0 = PIV[1] - PIV_N[1] * PXH
    # painel
    xs, ys = grid(y0, ROWS)
    rgb = sample(nw, xs, ys)
    al = ~sample(sky, xs, ys)
    al[:, xs < 0] = sample(~sky, np.zeros(1), ys)  # fora da arte à esquerda: repete a borda (porta)
    rgb[:, xs < 0] = sample(nw, np.zeros(1), ys)
    Image.fromarray(np.dstack([rgb, al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'countach-dash.png'))
    # teto (colunas do para-brisa)
    ty0 = y0 - EXT * PXH
    xs, ys = grid(ty0, EXT)
    trgb = sample(nw, xs, ys)
    tal = ~sample(sky, xs, ys)
    trgb[:, xs < 0] = sample(nw, np.zeros(1), ys)
    tal[:, xs < 0] = sample(~sky, np.zeros(1), ys)
    Image.fromarray(np.dstack([trgb, tal.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'countach-top.png'))
    # volante: aro (anel) + raios e miolo (o que mudou entre as duas artes, abaixo do painel)
    yy, xx = np.mgrid[0:H, 0:W]
    (ax, ay), (bx, by) = RIM
    e_out = ((xx - PIV[0]) / ax) ** 2 + ((yy - PIV[1]) / ay) ** 2 <= 1
    e_in = ((xx - PIV[0]) / bx) ** 2 + ((yy - PIV[1]) / by) ** 2 <= 1
    # raios e miolo pela forma desenhada: braços horizontais e placa do miolo, raio de baixo;
    # o vermelho do painel que aparece entre eles fica de fora
    wi = ww.astype(int)
    lum = wi.mean(axis=2)
    grey = (wi.max(axis=2) - wi.min(axis=2) < 28) & (wi.max(axis=2) < 140)
    dark = grey
    diff = np.abs(wi - nw.astype(int)).sum(axis=2) > 25
    arms = (yy >= 503) & (yy <= 568) & (((xx >= 196) & (xx < 252)) | ((xx > 534) & (xx <= 590)))
    plate = (xx >= 252) & (xx <= 534) & (yy >= 494) & ((yy <= 565) | ((yy <= 598) & (xx >= 292) & (xx <= 492)))
    down = (xx >= 352) & (xx <= 412) & (yy >= 600)
    keep = (arms | plate | down) & dark
    rim = e_out & ~e_in & grey & ((lum > 40) | diff)
    rim = cv2.morphologyEx(rim.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
    # no alto do aro a arte desenhou os mostradores por cima dele: ali o aro é copiado de um
    # trecho limpo do mesmo raio, girado (o couro tem o mesmo sombreado em toda a volta)
    ring = e_out & ~e_in
    bad = ring & ~(grey & (lum > 40)) & (yy < PIV[1])
    bad = cv2.dilate(bad.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    bad &= ring
    ww = ww.copy()
    ang = np.arctan2(yy - PIV[1], xx - PIV[0])
    rad = np.hypot(xx - PIV[0], yy - PIV[1])
    by, bx = np.nonzero(bad)
    for dang in (0.6, -0.6, 1.0, -1.0):
        if not len(by):
            break
        a2 = ang[by, bx] + dang
        sx = np.clip((PIV[0] + np.cos(a2) * rad[by, bx]).round().astype(int), 0, W - 1)
        sy = np.clip((PIV[1] + np.sin(a2) * rad[by, bx]).round().astype(int), 0, H - 1)
        ok = ~bad[sy, sx] & ring[sy, sx]
        ww[by[ok], bx[ok]] = ww[sy[ok], sx[ok]]
        bad[by[ok], bx[ok]] = False
        by, bx = by[~ok], bx[~ok]
    rim |= ring & (yy < PIV[1])
    wheel = (rim & e_out) | (keep & e_in)
    wheel = cv2.morphologyEx(wheel.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    wy0 = y0 - WTOP * PXH
    xs, ys = grid(wy0, WROWS, 0, 256)
    wrgb = sample(ww, xs, ys)
    wal = sample(wheel, xs, ys)
    # emblema do miolo: disco escuro, anel prateado e centro vermelho (fictício)
    hx, hy = (391 - PIV[0]) / PXW + PIV_N[0], (545 - wy0) / PXH
    gy, gx = np.mgrid[0:WROWS, 0:256]
    dd = np.hypot(gx + 0.5 - hx, (gy + 0.5 - hy) * 1.14)
    shield = np.hypot((gx + 0.5 - hx) / 20, (gy + 0.5 - hy) / 25) <= 1
    plate_c = wrgb[int(hy), int(hx) - 28].copy()
    wrgb[shield] = plate_c
    wal[shield] = True
    yel = (wrgb[..., 0].astype(int) > 150) & (wrgb[..., 2].astype(int) < 90) & (np.abs(wrgb[..., 0].astype(int) - wrgb[..., 1].astype(int)) < 90)
    wrgb[yel & wal] = plate_c  # o emblema real some: fica a placa do miolo
    wrgb[dd <= 13] = (24, 24, 27)
    wrgb[(dd <= 9) & (dd > 7)] = (196, 198, 204)
    wrgb[dd <= 5] = (180, 20, 22)
    wrgb[dd <= 2] = (232, 60, 52)
    wal[dd <= 13] = True
    Image.fromarray(np.dstack([wrgb, wal.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'countach-wheel.png'))
    print('painel, teto e volante; pivô', PIV_N, 'topo do volante', WTOP)


if __name__ == '__main__':
    main()
