"""Cabine da Furia F4 (Ferrari F40) a partir da arte nova do Victor (interior preto, couro vermelho,
com volante). Escala 0,34 (pixel 8:7), pivô do volante no centro da tela.
- para-brisa e janelas (a paisagem da arte) viram vidro transparente; retrovisor interno sai
- volante recortado (aro, raios e miolo); o painel atrás dele é refeito (inpainting)
- marcas reais saem: letreiro "F40" do painel, cavalinho do chaveiro (vira o escudo da Fúria) e o do
  miolo do volante (brand_badges.py); o quadro Veglia é desenhado por cima (f40_gauges.py)

Uso: python3 tools/ref/f40_cockpit2.py <cab.png> <src/assets/cockpit>
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
S = 0.34
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV = (640.0, 492.0)
PIV_N = (128.0, 105.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 12, 240
RIM_OUT, RIM_IN = (288, 300), (240, 252)
HUB = [(380, 448), (500, 441), (580, 421), (640, 413), (700, 421), (780, 441), (900, 448), (900, 504), (700, 508),
       (676, 560), (673, 720), (702, 772), (578, 772), (607, 720), (604, 560), (580, 508), (380, 504)]
HUB_C, HUB_R = (640, 492), 72
SHROUD = [(452, 262), (468, 216), (510, 192), (645, 181), (780, 192), (822, 216), (840, 262), (840, 460), (452, 460)]
TEXT = (1360, 455, 1470, 508)       # letreiro "F40" do painel
FOB = (822, 582, 860, 628)          # chaveiro com o escudo


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD):
    xs = PIV[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys):
    xi = np.clip(xs.astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def logo(size):
    br = json.load(open(os.path.join(ROOT, 'src/assets/brands.json'), encoding='utf-8'))
    pal = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in br['palette'].items()}
    rows = br['brands']['furia']['logo']
    a = np.zeros((9, 9, 4), np.uint8)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.':
                a[j, i] = (*pal[ch], 255)
    return np.array(Image.fromarray(a, 'RGBA').resize((size, size), Image.NEAREST))


def main():
    src, out = sys.argv[1], sys.argv[2]
    art = np.array(Image.open(src).convert('RGB'))
    H, W = art.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    rgb = art.astype(int)
    lum_w = rgb.mean(axis=2)  # da arte com volante (recorte do volante)
    # vidro: tirado da arte sem volante (sem o aro na frente da estrada)
    nwp = os.path.join(os.path.dirname(src), 'cab-nowheel.png')
    if os.path.exists(nwp):
        rgb = np.array(Image.open(nwp).convert('RGB')).astype(int)
    r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    red = (r_ > 140) & (g_ < 90) & (b_ < 90)
    # paisagem (céu, árvores, estrada): clara ou colorida, sem o vermelho da carroceria; ligada ao alto
    land = ((lum > 88) | (sat > 45)) & ~red & (yy < 340)
    n, lab = cv2.connectedComponents(land.astype(np.uint8), connectivity=4)
    seeds = set(np.unique(lab[0])) | set(np.unique(lab[:340, 0])) | set(np.unique(lab[:340, -1]))
    sky = np.isin(lab, list(seeds - {0}))
    # no meio (atrás do volante e do quadro): vidro até a borda vermelha do capô, coluna a coluna
    tops = np.full(W, -1.0)
    for x in range(W):
        run = np.convolve(red[180:300, x].astype(np.uint8), np.ones(4, np.uint8), 'valid') >= 4
        idx = np.nonzero(run)[0]
        if len(idx):
            tops[x] = 180 + idx[0]
    ok = tops >= 0
    tops = np.interp(np.arange(W), np.nonzero(ok)[0], tops[ok])
    mid = (xx > 330) & (xx < 1000) & (yy < tops[None, :].astype(int))
    shroud = np.zeros((H, W), np.uint8)  # capa escura do quadro (fica)
    cv2.fillPoly(shroud, [np.array(SHROUD, np.int32)], 1)
    sky |= mid & ~shroud.astype(bool)
    # pontinhos escuros soltos da paisagem (troncos, sombras) presos no vidro
    inv = (~sky & (yy < 330)).astype(np.uint8)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n2):
        if st2[i, cv2.CC_STAT_AREA] < 600:
            sky[lab2 == i] = True
    sky = cv2.morphologyEx(sky.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool)
    sky[:140, 730:1080] = True  # retrovisor interno (o jogo desenha o dele)

    # volante
    e_out = ((xx - PIV[0]) / RIM_OUT[0]) ** 2 + ((yy - PIV[1]) / RIM_OUT[1]) ** 2 <= 1
    e_in = ((xx - PIV[0]) / RIM_IN[0]) ** 2 + ((yy - PIV[1]) / RIM_IN[1]) ** 2 <= 1
    hub = np.zeros((H, W), np.uint8)
    cv2.fillPoly(hub, [np.array(HUB, np.int32)], 1)
    disc = np.hypot(xx - HUB_C[0], yy - HUB_C[1]) <= HUB_R
    hub = hub.astype(bool) | disc  # raios e miolo pelo contorno justo (o painel atrás não entra)
    wheel = (e_out & ~e_in) | (hub & e_out)
    wheel = cv2.morphologyEx(wheel.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    n, lab, st, _ = cv2.connectedComponentsWithStats(wheel.astype(np.uint8), 8)
    wheel = lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])

    # painel sem volante: inpainting em escala menor
    dash = art.copy()
    # arte sem volante (cab-nowheel.png, do Victor, alinhada): o painel de verdade atrás do volante
    nw_path = os.path.join(os.path.dirname(src), 'cab-nowheel.png')
    has_nw = os.path.exists(nw_path)
    if has_nw:
        dash = np.array(Image.open(nw_path).convert('RGB'))
    tx0, ty0, tx1, ty1 = TEXT
    for y in range(ty0, ty1):
        dash[y, tx0:tx1] = np.median(dash[y, tx0 - 40:tx0 - 8], axis=0).astype(np.uint8)
    hole = cv2.dilate(wheel.astype(np.uint8), np.ones((9, 9), np.uint8)) * (0 if has_nw else 1)
    k = 4
    small = cv2.resize(dash, (W // k, H // k), interpolation=cv2.INTER_AREA)
    hs = cv2.resize(hole, (W // k, H // k), interpolation=cv2.INTER_NEAREST)
    fill = cv2.inpaint(small, hs, 6, cv2.INPAINT_TELEA)
    fill = cv2.resize(fill, (W, H), interpolation=cv2.INTER_CUBIC)
    dash[hole > 0] = fill[hole > 0]
    # chaveiro: escudo da Fúria no lugar do cavalinho
    fx0, fy0, fx1, fy1 = FOB
    yel = (r_ > 170) & (g_ > 130) & (b_ < 90)
    box = np.zeros((H, W), bool)
    box[fy0:fy1, fx0:fx1] = True
    ys_, xs_ = np.nonzero(yel & box)
    if len(xs_):
        cx, cy = int(xs_.mean()), int(ys_.mean())
        sz = 30
        lg = logo(sz)
        dash[cy - 18:cy + 18, cx - 16:cx + 16] = (24, 24, 26)
        m = lg[..., 3] > 0
        dash[cy - sz // 2:cy - sz // 2 + sz, cx - sz // 2:cx - sz // 2 + sz][m] = lg[..., :3][m]

    y0d = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0d, ROWS)
    xr = np.clip(xs, 0, W - 1)
    d_rgb = sample(dash, xr, ys)
    d_al = ~sample(sky, xr, ys)
    Image.fromarray(np.dstack([d_rgb, d_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'f40-dash.png'))
    xs, ys = grid(y0d - EXT * PXH, EXT)
    xr = np.clip(xs, 0, W - 1)
    t_rgb = sample(dash, xr, ys)
    t_al = ~sample(sky, xr, ys)
    t_al[ys < 0, :] = False
    Image.fromarray(np.dstack([t_rgb, t_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'f40-top.png'))
    xs, ys = grid(y0d - WTOP * PXH, WROWS, 0, 256)
    w_rgb = sample(art, xs, ys)
    w_al = sample(wheel, xs, ys)
    Image.fromarray(np.dstack([w_rgb, w_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'f40-wheel.png'))
    nat = lambda p: (round(PIV_N[0] + (p[0] - PIV[0]) * S, 1), round((p[1] - y0d) / PXH, 1))
    print('velocímetro', nat((570, 340)), 'conta-giros', nat((720, 340)), 'água', nat((465, 392)), 'pressão', nat((820, 395)),
          'console', nat((1010, 400)), nat((1105, 400)), nat((1200, 400)))


if __name__ == '__main__':
    main()
