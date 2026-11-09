"""Cabine do Gaúcho GTI (Gol GTI 1993) a partir das artes do Victor:
- painel e teto da arte sem volante (vista do motorista); o volante vem da arte com volante (vista
  mais aberta), ampliado 1,633x (o quadro de instrumentos das duas tem essa proporção) e centrado no
  quadro: aro pela geometria, os quatro raios e a placa central por um contorno justo
- vidro: a paisagem ligada ao alto e à janela da porta vira transparente; o retrovisor interno sai
- máscaras da lataria vermelha vista de dentro (retrovisor, moldura da porta) para a cor do carro
- o quadro VDO é desenhado por cima (tools/ref/gol_gauges.py)
Escala 0,24 (pixel 8:7), pivô do volante no centro do quadro.
Uso: python3 tools/ref/gol_cockpit2.py <pasta com cab.png e cab-nowheel.png> <src/assets/cockpit>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

S = 0.24
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV = (695.0, 625.0)            # centro do volante na arte sem volante
PIV_N = (128.0, 112.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 8, 240
C4, K4 = (465.0, 428.0), 1.633  # centro do volante na arte com volante e a ampliação
R_OUT, R_IN = 258, 222          # aro (na arte com volante)
HUB = [(228, 372), (702, 372), (702, 418), (618, 418), (618, 505), (668, 548), (632, 586), (575, 545),
       (560, 540), (370, 540), (355, 545), (298, 586), (262, 548), (312, 505), (312, 418), (228, 418)]
MIRROR = (1050, 0, 1430, 140)   # retrovisor interno


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD):
    xs = PIV[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys):
    xi = np.clip(xs.astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def red_mask(rgb, al):
    hsv = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    return al & ((hue < 14) | (hue > 344)) & (hsv[..., 1] > 110) & (hsv[..., 2] > 50)


def main():
    d, out = sys.argv[1], sys.argv[2]
    nw = np.array(Image.open(os.path.join(d, 'cab-nowheel.png')).convert('RGB'))
    ww = np.array(Image.open(os.path.join(d, 'cab.png')).convert('RGB'))
    H, W = nw.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    rgb = nw.astype(int)
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    red = red_mask(nw, np.ones((H, W), bool))
    # vidro: paisagem (colorida, clara ou cinza-azulada da estrada) ligada ao alto ou à esquerda
    win = (yy < 296) | ((xx < 215) & (yy < 300 + (215 - xx) * 0.62))
    land = ((sat > 38) | (lum > 150) | (rgb[..., 2] > rgb[..., 0] + 10)) & ~red & win
    n, lab = cv2.connectedComponents(land.astype(np.uint8), connectivity=4)
    seeds = set(np.unique(lab[0])) | set(np.unique(lab[:430, 0]))
    sky = np.isin(lab, list(seeds - {0}))
    sky = cv2.morphologyEx(sky.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool) & win
    x0, y0, x1, y1 = MIRROR
    sky[y0:y1, x0:x1] = True
    sky |= (yy < 210) & (xx > 345)  # alto do para-brisa: só paisagem (riscos escuros dos morros saem)
    # vidro do retrovisor esquerdo: o que a moldura vermelha cerca fica transparente (o jogo põe a
    # vista de trás nele: glass em COCKPIT_ART['br-golgti'])
    box = np.zeros((H, W), bool)
    box[270:405, 8:185] = True
    frame = cv2.dilate((red & box).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    n3, lab3 = cv2.connectedComponents((box & ~frame).astype(np.uint8), connectivity=4)
    cx = lab3[340, 95]
    if cx:
        sky |= lab3 == cx
    inv = (~sky & win).astype(np.uint8)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n2):
        if st2[i, cv2.CC_STAT_AREA] < 600:
            sky[lab2 == i] = True
    y0d = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0d, ROWS)
    xr = np.clip(xs, 0, W - 1)
    d_rgb = sample(nw, xr, ys)
    d_al = ~sample(sky, xr, ys)
    Image.fromarray(np.dstack([d_rgb, d_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'br-golgti-dash.png'))
    Image.fromarray((red_mask(d_rgb, d_al) * 255).astype(np.uint8), 'L').save(os.path.join(out, 'br-golgti-dash-mask.png'))
    xs, ys = grid(y0d - EXT * PXH, EXT)
    xr = np.clip(xs, 0, W - 1)
    t_rgb = sample(nw, xr, ys)
    t_al = ~sample(sky, xr, ys)
    t_al[ys < 0, :] = False
    Image.fromarray(np.dstack([t_rgb, t_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'br-golgti-top.png'))
    Image.fromarray((red_mask(t_rgb, t_al) * 255).astype(np.uint8), 'L').save(os.path.join(out, 'br-golgti-top-mask.png'))
    # volante (na arte com volante)
    Hh, Wh = ww.shape[:2]
    y4, x4 = np.mgrid[0:Hh, 0:Wh]
    rr = np.hypot(x4 - C4[0], y4 - C4[1])
    hub = np.zeros((Hh, Wh), np.uint8)
    cv2.fillPoly(hub, [np.array(HUB, np.int32)], 1)
    wheel = ((rr <= R_OUT) & (rr >= R_IN)) | (hub.astype(bool) & (rr <= R_OUT))
    # emblema da marca real no miolo: some (textura da placa copiada de cima)
    w2 = ww.copy()
    ex, ey, er = 510, 462, 17
    e = np.hypot(x4 - ex, y4 - ey) <= er
    w2[e] = ww[y4[e], np.clip(2 * 465 - x4[e], 0, Wh - 1)]  # espelho do lado esquerdo da placa
    xs, ys = grid(y0d - WTOP * PXH, WROWS, 0, 256)
    xs4 = C4[0] + (xs - PIV[0]) / K4
    ys4 = C4[1] + (ys - PIV[1]) / K4
    w_rgb = sample(w2, xs4, ys4)
    w_al = sample(wheel, xs4, ys4)
    Image.fromarray(np.dstack([w_rgb, w_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'br-golgti-wheel.png'))
    nat = lambda p: (round(PIV_N[0] + (p[0] - PIV[0]) * S, 1), round((p[1] - y0d) / PXH, 1))
    hub_n = (round(PIV_N[0], 1), round((PIV[1] + (465 - C4[0]) * K4 * 0 + (462 - C4[1]) * K4 - (y0d - WTOP * PXH)) / PXH, 1))
    print('y0d', round(y0d, 1), 'quadro', nat((450, 330)), nat((940, 500)), 'emblema volante (png do volante)', hub_n,
          'retrovisor esq. vidro', nat((95, 340)))


if __name__ == '__main__':
    main()
