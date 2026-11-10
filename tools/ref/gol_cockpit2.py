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
    """lataria vermelha vista de dentro; inclui as bordas e reflexos avermelhados (pouca cor) que
    ficam em volta dela (senão sobram pixels vermelhos com outra cor, no retrovisor)"""
    hsv = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    redh = (hue < 18) | (hue > 338)
    core = al & redh & (hsv[..., 1] > 110) & (hsv[..., 2] > 50)
    near = cv2.dilate(core.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    return core | (al & near & redh & (hsv[..., 1] > 40) & (hsv[..., 2] > 28))


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
    # janela da porta (embaixo do retrovisor até a soleira): é tudo paisagem, menos a carcaça vermelha
    jan = (xx < 250) & (yy > 250) & (yy < 475 - 0.27 * xx) & ((lum > 95) | (yy < 462 - 0.27 * xx)) & ~cv2.dilate(red.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    # do retrovisor fica só a carcaça (moldura vermelha) e o vidro que ela cerca (o jogo põe a vista
    # de trás nele); a estrada pintada em volta, até a coluna, é janela
    box = np.zeros((H, W), bool)
    box[262:410, 0:200] = True
    fr = cv2.dilate((red & box).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    n4, lab4 = cv2.connectedComponents((box & ~fr).astype(np.uint8), connectivity=4)
    keep = fr | ((lab4 == lab4[340, 95]) & (lab4 > 0))
    sky |= jan & ~keep
    # palhetas do limpador e o que sobe acima do painel: o painel termina numa linha limpa
    sky |= (yy < 297) & (xx > 330) & (xx < 1625)
    # faixa lilás (o vidro da porta visto de lado) acima da borracha da soleira: também é janela
    lil = (xx < 320) & (yy > 360) & (yy < 505 - 0.27 * xx) & (rgb[..., 2] > rgb[..., 0] + 4) & (lum > 88) & ~red
    sky |= lil
    # coluna da porta: a moldura cinza-azulada entre a borracha preta (à esquerda) e o friso
    # vermelho é peça do carro, não paisagem (o azulado dela enganava a detecção do vidro)
    for y in range(0, 330):
        rx = np.nonzero(red[y, 120:300])[0]
        if not len(rx):
            continue
        r0 = 120 + rx[0]
        dk = np.nonzero(lum[y, 100:r0] < 45)[0]
        l0 = 100 + dk[0] if len(dk) else r0 - 40
        sky[y, l0:r0 + 1] = False
        # e o acabamento cinza à direita do friso, até a borracha preta do para-brisa
        r1 = 120 + rx[-1]
        dk2 = np.nonzero(lum[y, r1 + 6:r1 + 140] < 40)[0]
        if len(dk2):
            sky[y, r1:r1 + 6 + dk2[-1] + 1] = False if dk2[-1] < 110 else sky[y, r1:r1 + 6 + dk2[-1] + 1]
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
    # à esquerda da arte (telas largas) a porta continua: cada ponto segue a diagonal do forro (as
    # linhas da soleira, do apoio de braço e do friso vermelho sobem para a direita, 0,48 px por px)
    # até cair numa faixa de 60 px da borda da arte, espelhada a cada volta (sem emenda e sem
    # esticar); o retrovisor não se repete (o vidro da janela fica transparente)
    SL, BAND = 0.48, 60.0
    left = np.nonzero(xs < 0)[0]
    if len(left):
        X = xs[left][None, :]
        Y = ys[:, None]
        t = np.mod(-X, 2 * BAND)
        sx = np.where(t < BAND, t, 2 * BAND - t)
        sy = Y - SL * (sx - X)  # mesma diagonal: y sobe 0,48 a cada px para a direita
        xi = np.clip(sx.astype(int), 0, W - 1)
        yi = np.clip(sy.astype(int), 0, H - 1)
        mir = (xi < 200) & (yi > 255) & (yi < 415)
        d_rgb[:, left] = nw[yi, xi]
        d_al[:, left] = ~sky[yi, xi] & ~mir & (sy < H) & ~(sky[yi, xi])  # acima da soleira: janela
    Image.fromarray(np.dstack([d_rgb, d_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'br-golgti-dash.png'))
    Image.fromarray((red_mask(d_rgb, d_al) * 255).astype(np.uint8), 'L').save(os.path.join(out, 'br-golgti-dash-mask.png'))
    xs, ys = grid(y0d - EXT * PXH, EXT)
    xr = np.clip(xs, 0, W - 1)
    t_rgb = sample(nw, xr, ys)
    t_al = ~sample(sky, xr, ys)
    # a arte corta o teto no alto: acima dela entra o forro (cinza do painel, mais escuro no alto) e as
    # colunas continuam subindo até ele; embaixo do forro, a borracha escura do para-brisa
    roof = ys < 12
    top_row = np.argmax(ys >= 12)
    for c in range(t_al.shape[1]):
        if t_al[top_row, c]:
            t_rgb[:top_row, c] = t_rgb[top_row, c]
            t_al[:top_row, c] = True
    rows = np.nonzero(roof)[0]
    if len(rows):
        y1 = rows.max()
        n = max(1, y1 - max(0, y1 - 14))
        for k, r in enumerate(range(max(0, y1 - 14), y1 + 1)):
            t = k / n
            col = np.array([34, 34, 38]) * (1 - t) + np.array([66, 66, 72]) * t
            t_rgb[r, :] = col.astype(np.uint8)
            t_al[r, :] = True
        t_rgb[:max(0, y1 - 14), :] = (30, 30, 34)
        t_al[:max(0, y1 - 14), :] = True
        t_rgb[y1 + 1:y1 + 3, :] = (14, 14, 16)  # borracha do para-brisa
        t_al[y1 + 1:y1 + 3, :] = True
        for c in range(0, t_al.shape[1], 3):  # textura do forro
            t_rgb[max(0, y1 - 13):y1 - 1:4, c] = (48, 48, 54)
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
