"""Cabine do Toro V12 (Lamborghini Diablo) a partir das duas artes do Victor (com e sem volante).
- painel e teto da arte sem volante (alinhada à com volante); o volante sai da arte com volante
  (aro pela geometria, raios e airbag por um contorno justo); o emblema do miolo vira o da Toro
- vidro: a paisagem ligada ao alto da arte vira transparente; o retrovisor interno sai
- o quadro VDO é desenhado por cima (tools/ref/diablo_gauges.py)
Escala 0,24 (pixel 8:7), pivô do volante no centro da tela.
Uso: python3 tools/ref/diablo_cockpit.py <pasta com cab.png e cab-nowheel.png> <src/assets/cockpit>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

S = 0.24
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV = (765.0, 690.0)
PIV_N = (128.0, 112.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 8, 240
R_OUT, R_IN = 443, 384
HUB = [(326, 613), (560, 590), (640, 577), (890, 577), (975, 590), (1204, 613), (1204, 700), (975, 706),
       (965, 790), (920, 860), (820, 895), (710, 895), (610, 860), (565, 790), (555, 706), (326, 700)]
MIRROR = (1190, 0, 1620, 245)


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD):
    xs = PIV[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys):
    xi = np.clip(xs.astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def side_mirror(rgb, al):
    """retrovisor esquerdo completo (a arte só mostra a ponta dele, cortada na borda): carcaça na cor
    da carroceria com luz em cima, moldura escura e o vidro transparente (o jogo põe a vista de trás
    nele: glass em COCKPIT_ART.diablo), e o braço até a porta. Colunas do painel (com as 102 extras)."""
    rgb, al = rgb.copy(), al.copy()
    # tons da lataria roxa da arte (coluna e capô): claro, médio e escuro
    light, mid, dark = (np.array(c, np.uint8) for c in ((214, 64, 214), (150, 20, 150), (78, 8, 84)))
    h, w = al.shape
    yy, xx = np.mgrid[0:h, 0:w]
    # janela livre onde a borda da arte esticava a ponta do retrovisor
    clear = ((xx < 58) & (yy < 31)) | ((xx < 50) & (yy < 44))
    al[clear] = False

    def rrect(x0, y0, x1, y1, r):
        cx = np.clip(xx, x0 + r, x1 - r)
        cy = np.clip(yy, y0 + r, y1 - r)
        return ((xx - cx) ** 2 + ((yy - cy) * 8 / 7) ** 2 <= r * r) & (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
    arm = np.zeros_like(al)
    for y in range(30, 45):
        t = (y - 30) / 14
        arm[y, int(46 + 5 * t):int(54 + 3 * t)] = True
    body = rrect(12, 3, 60, 34, 10)
    glass = rrect(19, 8, 53, 27, 6)
    ring = rrect(18, 7, 54, 28, 7) & ~glass
    t = np.clip((yy - 30) / 14, 0, 1)[..., None]
    rgb[arm] = (mid * (1 - t) + dark * t).astype(np.uint8)[arm]
    al[arm] = True
    t = np.clip((yy - 3) / 31, 0, 1)[..., None]
    shade = np.where(t < 0.5, light * (1 - 2 * t) + mid * 2 * t, mid * (2 - 2 * t) + dark * (2 * t - 1)).astype(np.uint8)
    rgb[body] = shade[body]
    edge = body & ~cv2.erode(body.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    rgb[edge] = (24, 14, 30)
    rgb[ring] = (18, 14, 22)
    al[body] = True
    al[glass] = False
    print('vidro do retrovisor: colunas 19-53, linhas 8-27 do painel; semente', (36, 76 + 17))
    return rgb, al


def main():
    d, out = sys.argv[1], sys.argv[2]
    ww = np.array(Image.open(os.path.join(d, 'cab.png')).convert('RGB'))
    H, W = ww.shape[:2]
    nw = np.array(Image.open(os.path.join(d, 'cab-nowheel.png')).convert('RGB'))
    nw = np.pad(nw, ((0, max(0, H - nw.shape[0])), (0, max(0, W - nw.shape[1])), (0, 0)), mode='edge')[:H, :W]
    nw = cv2.warpAffine(nw, np.float32([[1, 0, 1.1], [0, 1, 0.7]]), (W, H), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_REPLICATE)
    yy, xx = np.mgrid[0:H, 0:W]
    rgb = nw.astype(int)
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    hsv = cv2.cvtColor(nw, cv2.COLOR_RGB2HSV_FULL).astype(int)
    purple = (hsv[..., 0] * 360 / 256 > 262) & (hsv[..., 0] * 360 / 256 < 338) & (hsv[..., 1] > 80)
    # vidro: paisagem (clara ou colorida, sem a lataria roxa) ligada ao alto da arte
    land = ((lum > 80) | (sat > 50)) & ~purple & (yy < 330)
    n, lab = cv2.connectedComponents(land.astype(np.uint8), connectivity=4)
    seeds = set(np.unique(lab[0])) | set(np.unique(lab[:300, -1]))
    sky = np.isin(lab, list(seeds - {0}))
    sky = cv2.morphologyEx(sky.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool)
    x0, y0, x1, y1 = MIRROR
    sky[y0:y1, x0:x1] |= ~purple[y0:y1, x0:x1] & (yy[y0:y1, x0:x1] < 250)  # retrovisor interno
    inv = (~sky & (yy < 300)).astype(np.uint8)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n2):
        if st2[i, cv2.CC_STAT_AREA] < 500:
            sky[lab2 == i] = True

    y0d = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0d, ROWS)
    xr = np.clip(xs, 0, W - 1)  # à esquerda da arte: a porta continua (só embaixo)
    d_rgb = sample(nw, xr, ys)
    d_al = ~sample(sky, xr, ys)
    d_al[:, xs < 0] = (ys[:, None] > 330).repeat((xs < 0).sum(), 1)
    d_rgb, d_al = side_mirror(d_rgb, d_al)
    Image.fromarray(np.dstack([d_rgb, d_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'diablo-dash.png'))
    xs, ys = grid(y0d - EXT * PXH, EXT)
    xr = np.clip(xs, 0, W - 1)
    t_rgb = sample(nw, xr, ys)
    t_al = ~sample(sky, xr, ys)
    t_al[ys < 0, :] = False
    t_al[:, xs < 0] = False
    Image.fromarray(np.dstack([t_rgb, t_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'diablo-top.png'))

    # volante
    rr = np.hypot(xx - PIV[0], yy - PIV[1])
    hub = np.zeros((H, W), np.uint8)
    cv2.fillPoly(hub, [np.array(HUB, np.int32)], 1)
    wheel = ((rr <= R_OUT) & (rr >= R_IN)) | (hub.astype(bool) & (rr <= R_OUT))
    # nas bordas do aro, pedaços dos mostradores da arte (números laranja, fundo): ficam fora
    wr = ww.astype(int)
    warm = (wr[..., 0] > 150) & (wr[..., 0] > wr[..., 2] + 60)
    warm = cv2.dilate(warm.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    wheel &= ~(warm & (rr > R_IN - 6))
    xs, ys = grid(y0d - WTOP * PXH, WROWS, 0, 256)
    w_rgb = sample(ww, xs, ys)
    w_al = sample(wheel, xs, ys)
    # a arte corta o aro embaixo: abaixo dela o aro é o de cima espelhado (círculo inteiro ao girar,
    # sem as duas hastes retas), um pouco mais escuro
    low = ys >= H - 2
    if low.any():
        ym = 2 * PIV[1] - ys[low]
        ring = (rr <= R_OUT) & (rr >= R_IN)
        w_rgb[low] = (sample(ww, xs, ym).astype(int) * 0.82).astype(np.uint8)
        w_al[low] = sample(ring, xs, ym)
    Image.fromarray(np.dstack([w_rgb, w_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'diablo-wheel.png'))
    nat = lambda p: (round(PIV_N[0] + (p[0] - PIV[0]) * S, 1), round((p[1] - y0d) / PXH, 1))
    print('emblema volante', (round(PIV_N[0] + (768 - PIV[0]) * S, 1), round((745 - (y0d - WTOP * PXH)) / PXH, 1)),
          'óleo T', nat((415.6, 505)), 'comb', nat((525, 505)), 'vel', nat((675, 449)), 'giro', nat((872, 449)), 'óleo P', nat((1015.6, 502)),
          'canto quadro', nat((300, 330)), nat((1150, 580)))


if __name__ == '__main__':
    main()
