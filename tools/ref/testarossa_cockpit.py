"""Cabine da Furia TR (Ferrari Testarossa) a partir da arte do Victor (interior azul, com volante).
- para-brisa e janela da porta (a paisagem da arte) viram vidro transparente; as palhetas do
  limpador e o retrovisor interno saem (o jogo desenha o dele); o espelho do retrovisor externo
  esquerdo fica transparente (o jogo mostra nele a vista de trás)
- o volante é recortado pela geometria (aro, raios e miolo); o painel atrás dele vem da arte sem
  volante (cab-nowheel.png, na mesma pasta), ou é refeito por inpainting se ela não existir; o cavalinho do miolo vira o emblema da Fúria (brand_badges.py)
- o quadro de instrumentos (Veglia laranja) é desenhado por cima pelo jogo (tools/ref/testarossa_gauges.py)
Escala 0,34 (pixel 8:7), pivô do volante no centro da tela.

Uso: python3 tools/ref/testarossa_cockpit.py <cab.png> <src/assets/cockpit>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

S = 0.34
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV = (672.0, 492.0)
PIV_N = (128.0, 105.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 12, 240
RIM_OUT, RIM_IN = (277, 274), (229, 229)
# raios e miolo (coordenadas da arte)
HUB = [(436, 452), (520, 446), (600, 440), (744, 440), (824, 446), (906, 452), (906, 530), (812, 536),
       (712, 546), (712, 676), (735, 700), (735, 740), (610, 740), (610, 700), (632, 676), (632, 546),
       (532, 536), (436, 530)]
HUB_C, HUB_R = (672, 492), 66
CLUSTER = (474, 292, 888, 434)  # caixa do quadro (o jogo desenha por cima)


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD):
    xs = PIV[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys):
    xi = np.clip(xs.astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def main():
    src, out = sys.argv[1], sys.argv[2]
    art = np.array(Image.open(src).convert('RGB'))
    H, W = art.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    rgb = art.astype(int)
    r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # capô vermelho visto pelo para-brisa: o vidro vai até ele, coluna a coluna (onde o aro do
    # volante esconde o capô, a linha é interpolada entre os lados)
    red = (r_ > 140) & (g_ < 95) & (b_ < 95)
    tops = np.full(W, -1.0)
    for x in range(W):
        col = red[195:280, x].astype(np.uint8)
        run = np.convolve(col, np.ones(5, np.uint8), 'valid') >= 5  # 5 seguidos: capô (não nuvem)
        idx = np.nonzero(run)[0]
        if len(idx):
            tops[x] = 195 + idx[0]
    ok = tops >= 0
    tops = np.interp(np.arange(W), np.nonzero(ok)[0], tops[ok])
    sky = yy < tops[None, :].astype(int)
    # coluna da porta (à esquerda): em cada linha, o vidro começa depois do contorno preto dela
    mx = rgb.max(axis=2)
    for y in range(0, 260):
        xl, xr = int(185 + 0.3 * y), int(300 + 0.4 * y)
        row = mx[y, xl:xr]
        dark = np.nonzero(row < 45)[0]
        if len(dark):
            # fim do primeiro trecho escuro (o contorno da coluna)
            k = dark[0]
            while k + 1 < len(row) and row[k + 1] < 45:
                k += 1
            e = xl + k + 1
        else:
            e = int(205 + y * (84 / 245)) + 3
        sky[y, :e] = False
    # janela da porta: paisagem à esquerda da coluna, acima da porta e do retrovisor
    # janela da porta: o triângulo de paisagem abaixo da moldura diagonal da porta (a coluna e a
    # moldura em cima ficam), até o retrovisor (a carcaça vermelha fica)
    tri = np.zeros((H, W), np.uint8)
    cv2.fillPoly(tri, [np.array([(0, 54), (102, 192), (106, 216), (0, 216)], np.int32)], 1)
    side = tri.astype(bool) & ~((r_ > 120) & (r_ > g_ * 1.8) & (yy > 190))
    sky |= side
    sky &= yy < 300
    # espelho do retrovisor externo (azul dentro da carcaça vermelha)
    lum = rgb.mean(axis=2)
    glass = (xx < 64) & (yy > 214) & (yy < 334) & (b_ > r_ + 30) & (lum > 70)
    glass = cv2.morphologyEx(glass.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)).astype(bool)
    n, lab, st, _ = cv2.connectedComponentsWithStats(glass.astype(np.uint8), 8)
    if n > 1:
        glass = lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    sky |= glass

    # volante: aro (anel da elipse) + raios e miolo
    e_out = ((xx - PIV[0]) / RIM_OUT[0]) ** 2 + ((yy - PIV[1]) / RIM_OUT[1]) ** 2 <= 1
    e_in = ((xx - PIV[0]) / RIM_IN[0]) ** 2 + ((yy - PIV[1]) / RIM_IN[1]) ** 2 <= 1
    hub = np.zeros((H, W), np.uint8)
    cv2.fillPoly(hub, [np.array(HUB, np.int32)], 1)
    hub = hub.astype(bool) | (np.hypot(xx - HUB_C[0], yy - HUB_C[1]) <= HUB_R)
    wheel = (e_out & ~e_in) | (hub & e_out)
    # o que é escuro/cinza do volante (sem o azul do painel e dos tapetes que aparece nas bordas
    # do polígono): o aro inteiro fica, nos raios só o que não é azul
    blue = (b_ > r_ + 25) & (b_ > g_ + 8)
    wheel &= ~(blue & ~(e_out & ~e_in) & ~(np.hypot(xx - HUB_C[0], yy - HUB_C[1]) <= HUB_R))
    wheel = cv2.morphologyEx(wheel.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    n, lab, st, _ = cv2.connectedComponentsWithStats(wheel.astype(np.uint8), 8)
    if n > 1:
        wheel = lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    # painel sem o volante: refeito por inpainting (em escala menor, depois ampliado: mais liso)
    hole = cv2.dilate(wheel.astype(np.uint8), np.ones((9, 9), np.uint8))
    k = 4
    small = cv2.resize(art, (W // k, H // k), interpolation=cv2.INTER_AREA)
    hs = cv2.resize(hole, (W // k, H // k), interpolation=cv2.INTER_NEAREST)
    fill = cv2.inpaint(small, hs, 6, cv2.INPAINT_TELEA)
    fill = cv2.resize(fill, (W, H), interpolation=cv2.INTER_CUBIC)
    dash = art.copy()
    dash[hole > 0] = fill[hole > 0]
    # arte sem volante (cab-nowheel.png, do Victor): o painel de verdade atrás do volante; vem
    # deslocada ~1 px para cima e para a esquerda em relação à arte com volante
    nw_path = os.path.join(os.path.dirname(src), 'cab-nowheel.png')
    if os.path.exists(nw_path):
        nw = np.array(Image.open(nw_path).convert('RGB'))
        M = np.float32([[1, 0, 1.0], [0, 1, 1.5]])
        nw = cv2.warpAffine(nw, M, (W, H), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_REPLICATE)
        dash = nw

    y0d = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0d, ROWS)
    xr = np.clip(xs, 0, W - 1)
    d_rgb = sample(dash, xr, ys)
    d_al = ~sample(sky, xr, ys)
    d_al[:, xs < 0] = (ys[:, None] > 340).repeat((xs < 0).sum(), 1)
    Image.fromarray(np.dstack([d_rgb, d_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'testarossa-dash.png'))
    xs, ys = grid(y0d - EXT * PXH, EXT)
    xr = np.clip(xs, 0, W - 1)
    t_rgb = sample(dash, xr, ys)
    t_al = ~sample(sky, xr, ys)
    t_al[:, xs < 0] = False
    t_al[ys < 0, :] = False
    Image.fromarray(np.dstack([t_rgb, t_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'testarossa-top.png'))
    # volante
    xs, ys = grid(y0d - WTOP * PXH, WROWS, 0, 256)
    w_rgb = sample(art, xs, ys)
    w_al = sample(wheel, xs, ys)
    Image.fromarray(np.dstack([w_rgb, w_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'testarossa-wheel.png'))
    nat = lambda p: (round(PIV_N[0] + (p[0] - PIV[0]) * S, 1), round((p[1] - y0d) / PXH, 1))
    hubn = (round(PIV_N[0] + (HUB_C[0] - PIV[0]) * S, 1), round((HUB_C[1] - (y0d - WTOP * PXH)) / PXH, 1))
    mg = np.nonzero(glass)
    mn = (round(PAD + PIV_N[0] + (np.median(mg[1]) - PIV[0]) * S, 1), round(EXT + (np.median(mg[0]) - y0d) / PXH, 1))
    print('miolo (volante)', hubn, 'espelho', mn, 'quadro', nat(CLUSTER[:2]), nat(CLUSTER[2:]),
          'velocímetro', nat((572, 360)), 'conta-giros', nat((780, 360)), 'aux', nat((675, 330)), nat((675, 385)))


if __name__ == '__main__':
    main()
