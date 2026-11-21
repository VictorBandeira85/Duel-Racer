"""Cabine do Cadete GSi (Chevrolet Kadett GSi) a partir das duas artes novas do Victor (com e sem volante,
vidros em magenta), no molde do Corsário (corsa_cockpit2.py):
- painel, colunas, forro e portas da arte SEM volante; volante de três raios da arte COM volante (aro pelas
  elipses medidas, raios e almofada por polígono; as artes não estão alinhadas ao pixel, então nada de diferença)
- vidros: o magenta (e a franja rosada) vira vidro; o vidro azul do retrovisor esquerdo também (o jogo põe a
  vista de trás); o direito fica como está
- retrovisor interno e a haste saem (o jogo desenha o dele): espelho vira para-brisa, a haste vira forro
- limpadores da arte saem: na faixa deles, o que é fino (sumiu numa abertura vertical) vira vidro
- quadro: o miolo do LCD fica preto liso (a moldura fica); o jogo desenha o quadro digital do Kadett de
  verdade por cima (kadettCluster em cockpit.ts, foto do Victor)
- buzina: a gravata vira botão liso com o emblema da Vanguarda
O volante fica à esquerda do centro (wheelDx), como no carro; o painel é centrado em x 605.
Uso: python3 tools/ref/kadett_cockpit.py <pasta com cockwheel.png e cockdash.png> <src/assets/cockpit>  (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import brand_badges  # noqa: E402

ID = 'br-kadett'
S = 0.38
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV_X = 605.0
WHEEL_C = (549.5, 533.0)
Y0D = 245.0
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
WROWS = 230
RIM_OUT = (549.5, 533.0, 186.0, 186.0)
RIM_IN = (549.5, 533.0, 165.0, 164.0)
PADPOLY = [(380, 504), (447, 521), (495, 499), (552, 494), (610, 499), (655, 521), (720, 505), (728, 570),
           (655, 580), (583, 615), (590, 694), (510, 694), (517, 615), (457, 580), (382, 578)]
EMB = (551.5, 542.5, 27.0)
MIRROR_SEED = (150, 395)
IMIR = (712, 112, 962, 235)          # retrovisor interno (vira vidro)
STALK = (800, 101, 872, 114)         # haste no forro
WIPER_BAND = (380, 286, 1320, 358)   # faixa dos limpadores
LCD = (440, 412, 697, 504)           # miolo do LCD (vira preto liso)
LCD_COL = (14, 10, 8)


def magenta(nw):
    """o magenta das janelas: só os blocos grandes (o tecido roxo/rosa dos bancos e portas não) e a franja"""
    a = nw.astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r - g > 90) & (b - g > 90) & (r > 170) & (b > 170)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=4)
    m = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 5000])
    fringe = (r - g > 50) & (b - g > 50) & (r > 120) & (b > 120)
    near = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    return m | (near & fringe)


def glass_mask(nw):
    H, W = nw.shape[:2]
    g = magenta(nw)
    # retrovisor interno e haste: vidro (a haste no forro vira forro em clean)
    x0, y0, x1, y1 = IMIR
    g[y0:y1, x0:x1] = True
    # limpadores: fino na faixa vira vidro
    x0, y0, x1, y1 = WIPER_BAND
    band = np.zeros((H, W), bool)
    band[y0:y1, x0:x1] = True
    solid = (~g).astype(np.uint8)
    thick = cv2.morphologyEx(solid, cv2.MORPH_OPEN, np.ones((70, 1), np.uint8)) > 0
    g |= band & ~thick
    # vidro azul do retrovisor esquerdo
    a = nw.astype(int)
    blue = (a[..., 2] > a[..., 0] + 40) & (a[..., 2] > 120)
    n, lab = cv2.connectedComponents(blue.astype(np.uint8), connectivity=4)
    mir = lab == lab[MIRROR_SEED[1], MIRROR_SEED[0]]
    ys, xs = np.nonzero(mir)
    hull = cv2.convexHull(np.stack([xs, ys], 1).astype(np.int32))
    mir = cv2.fillPoly(np.zeros((H, W), np.uint8), [hull], 1) > 0
    g |= mir
    g = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0
    return g, mir


def clean(nw):
    out = nw.copy()
    x0, y0, x1, y1 = STALK
    for y in range(y0, y1):  # cada linha com o forro dela (entre a luz de teto e o quebra-sol da direita)
        out[y, x0:x1] = np.median(nw[y, 910:945], axis=0).astype(np.uint8)
    x0, y0, x1, y1 = LCD
    out[y0:y1, x0:x1] = LCD_COL
    return out


def grid(y0, rows, cols=256 + 2 * PAD):
    xs = PIV_X + (np.arange(cols) - PAD + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys):
    xi = np.clip(np.floor(xs).astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def wheel_mask(ww):
    H, W = ww.shape[:2]
    y4, x4 = np.mgrid[0:H, 0:W]
    ell = lambda e: ((x4 - e[0]) / e[2]) ** 2 + ((y4 - e[1]) / e[3]) ** 2 <= 1  # noqa: E731
    sp = cv2.fillPoly(np.zeros((H, W), np.uint8), [np.array(PADPOLY, np.int32)], 1) > 0
    sp = cv2.dilate(sp.astype(np.uint8), np.ones((25, 25), np.uint8)) > 0   # polígono folgado...
    lum = ww.astype(int).mean(axis=2)
    gray = sp & (lum > 62)                                                  # ...e só o cinza claro dos raios
    gray = cv2.morphologyEx(gray.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    gray = cv2.morphologyEx(gray, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(gray, connectivity=4)
    gray = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    # contorno escuro dos raios encostado no cinza
    gray |= (cv2.dilate(gray.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & sp
    n, lab = cv2.connectedComponents((~gray).astype(np.uint8), connectivity=4)  # furos (emblema) entram
    ell_in = ell(RIM_IN)
    holes = (lab != lab[int(WHEEL_C[1]) - 150, int(WHEEL_C[0])]) & ell_in
    return ell(RIM_OUT) & (~ell_in | gray | holes)


def main():
    d, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    nw = np.array(Image.open(os.path.join(d, 'cockdash.png')).convert('RGB').resize((1672, 941), Image.NEAREST))
    ww = np.array(Image.open(os.path.join(d, 'cockwheel.png')).convert('RGB'))
    g, mir = glass_mask(nw)
    nw = clean(nw)
    A = ~g
    if dbg:
        v = nw.copy(); v[g] = (0, 255, 0); v[mir] = (255, 0, 255)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-alpha.png'))
    xs, ys = grid(Y0D, ROWS)
    d_rgb, d_al = sample(nw, xs, ys), sample(A, xs, ys)
    xs, yt = grid(Y0D - EXT * PXH, EXT)
    t_rgb, t_al = sample(nw, xs, yt), sample(A, xs, yt)
    st_al = np.concatenate([t_al, d_al], axis=0)
    st_rgb = np.concatenate([t_rgb, d_rgb], axis=0)
    # ilhas opacas soltas no vidro (até 40 px) somem; furinhos fecham
    n, lab, stt, _ = cv2.connectedComponentsWithStats(st_al.astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if stt[i, cv2.CC_STAT_AREA] <= 40:
            st_al[lab == i] = False
    st_mir = np.concatenate([sample(mir, *grid(Y0D - EXT * PXH, EXT)), sample(mir, *grid(Y0D, ROWS))], axis=0)
    n, lab, stt, _ = cv2.connectedComponentsWithStats((~st_al).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        if stt[i, cv2.CC_STAT_AREA] <= 12 and not st_mir[lab == i].any():
            st_al[lab == i] = True
    t_al, d_al = st_al[:EXT], st_al[EXT:]
    t_rgb, d_rgb = st_rgb[:EXT], st_rgb[EXT:]
    for name, rgb, a_ in (('dash', d_rgb, d_al), ('top', t_rgb, t_al)):
        Image.fromarray(np.dstack([rgb, a_.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'{ID}-{name}.png'), optimize=True)
    # volante
    wheel = wheel_mask(ww)
    if dbg:
        v = ww.copy(); v[~wheel] = (v[~wheel] * 0.35 + np.array([0, 160, 0]) * 0.65).astype(np.uint8)
        Image.fromarray(v[320:740, 340:760]).resize((840, 840), Image.NEAREST).save(os.path.join(dbg, 'wheel-mask.png'))
    top = WHEEL_C[1] - RIM_OUT[3] - 4
    xs = WHEEL_C[0] + (np.arange(256) + 0.5 - 128) * PXW
    ys = top + (np.arange(WROWS) + 0.5) * PXH
    w_rgb, w_al = sample(ww, xs, ys), sample(wheel, xs, ys) & (ys < ww.shape[0])[:, None]
    wimg = np.dstack([w_rgb, w_al.astype(np.uint8) * 255])
    piv_y = (WHEEL_C[1] - top) / PXH
    hub = (128 + (EMB[0] - WHEEL_C[0]) * S, piv_y + (EMB[1] - WHEEL_C[1]) / PXH)
    yy, xx = np.mgrid[0:WROWS, 0:256]
    e = np.hypot(xx + 0.5 - hub[0], (yy + 0.5 - hub[1]) * (8 / 7))
    core_r = EMB[2] * S
    padc = np.median(wimg[(e > core_r + 2) & (e < core_r + 5) & (wimg[..., 3] > 0)][:, :3], axis=0).astype(np.uint8)
    wimg[e <= core_r, :3] = padc
    wimg[(e <= core_r) & (e > core_r - 1.1), :3] = (padc * 0.7).astype(np.uint8)
    brand_badges.stamp(wimg, None, 'vanguarda', (round(hub[0]), round(hub[1]), 8, 0))
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, f'{ID}-wheel.png'), optimize=True)
    nat = lambda p: (round(PIV_N[0] + (p[0] - PIV_X) * S, 2), round((p[1] - Y0D) / PXH * 128 / 124, 2))  # noqa: E731
    print('pivô do volante na arte do volante (linha)', round(piv_y, 2), 'wheelDx', round((WHEEL_C[0] - PIV_X) * S, 2))
    print('centro do aro no painel (linha esticada)', nat(WHEEL_C))
    print('LCD', nat(LCD[:2]), nat(LCD[2:]))
    gl = (PIV_N[0] + (MIRROR_SEED[0] - PIV_X) * S, (MIRROR_SEED[1] - Y0D) / PXH)
    print('vidro do retrovisor (empilhado, com PAD)', (round(PAD + gl[0]), round(EXT + gl[1])))


if __name__ == '__main__':
    main()
