"""Cabine do Ímola Classic SE (Monza Classic sedã) a partir das artes do Victor (mesmo enquadramento):
- painel da arte sem volante; volante da arte com volante (aro pela geometria, miolo e raios por
  contorno); a plaqueta "MONZA SL/E" do miolo vira "CLASSIC"
- vidros pela cor (a arte tem céu azul liso): o azul vira transparente (para-brisa, janela e o vidro do
  retrovisor esquerdo, que o jogo preenche: glass em COCKPIT_ART); o retrovisor interno e as palhetas
  saem (o painel termina numa linha limpa: a do pé do para-brisa, medida coluna a coluna)
- à esquerda da arte a porta é construída continuando cada linha na inclinação da soleira (nunca
  espelhada nem esticada); no alto a coluna continua subindo e entra o forro do teto
- o quadro é refeito por tools/ref/monza_gauges.py classic
Escala 0,27 (pixel 8:7), pivô do volante em (128, 112).
Uso: python3 tools/ref/monzasedan_cockpit.py <pasta com cab.png e cab-nowheel.png> <src/assets/cockpit>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

S = 0.27
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV = (775.0, 591.0)
PIV_N = (128.0, 112.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 8, 240
R_OUT, R_IN = 324, 281
HUB = [(640, 540), (910, 540), (926, 556), (896, 692), (880, 706), (670, 706), (654, 692), (624, 556)]
SPOKES = [
    [(500, 586), (632, 586), (645, 648), (500, 648)],
    [(1050, 586), (918, 586), (905, 648), (1050, 648)],
    [(655, 688), (738, 700), (652, 806), (580, 778)],
    [(895, 688), (812, 700), (898, 806), (970, 778)],
]
MIRROR_IN = (1020, 0, 1420, 165)  # retrovisor interno (some)
LP, TP = 150, 60
SILL = 0.32   # quanto as linhas da porta descem a cada px indo para a borda esquerda
LEAN = 0.37   # quanto a coluna anda para a esquerda a cada px subindo
NAME = 'br-monzasedan'


def opaque(nw):
    H, W = nw.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    rgb = nw.astype(int)
    blue = (rgb[..., 2] - rgb[..., 0] > 40) & (rgb[..., 2] > 120)
    blue &= yy < 560
    x0, y0, x1, y1 = MIRROR_IN
    blue[y0:y1, x0:x1] = True
    # pé do para-brisa: último azul de cada coluna (as palhetas baixam a medida: vale o maior vizinho)
    top = np.full(W, -1.0)
    for x in range(385, W):
        ys = np.nonzero(blue[150:330, x])[0]
        if len(ys):
            top[x] = 150 + ys.max() + 1
    good = np.nonzero(top > 0)[0]
    top[385:] = np.interp(np.arange(385, W), good, top[good])
    t2 = top.copy()
    for x in range(385, W):
        t2[x] = top[max(385, x - 40):x + 41].max()
    k = np.ones(41) / 41
    t2[385:] = np.convolve(np.pad(t2[385:], 20, mode='edge'), k, mode='valid')
    blue |= (xx >= 385) & (yy < t2[np.clip(xx, 0, W - 1)]) & (yy > 150)
    blue |= (xx >= 385) & (yy <= 150)
    al = ~blue
    # brilhos do vidro (riscos claros) e restos soltos dentro dos vidros: saem
    n, lab, st, _ = cv2.connectedComponentsWithStats(al.astype(np.uint8), 4)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 2500:
            al[lab == i] = False
    # furinhos azulados dentro das peças: fecham
    n, lab, st, _ = cv2.connectedComponentsWithStats((~al).astype(np.uint8), 4)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 60:
            al[lab == i] = True
    return al


def extend(nw, al):
    H, W = nw.shape[:2]
    E = np.zeros((H + TP, W + LP, 3), np.uint8)
    A = np.zeros((H + TP, W + LP), bool)
    E[TP:, LP:], A[TP:, LP:] = nw, al
    ys = np.arange(H)
    base = nw[:, 0:3].astype(float).mean(axis=1)
    edge_ok = al[:, 0].copy()
    edge_ok[:440] = False  # acima da soleira, à esquerda da arte, é janela (o retrovisor não se repete)
    for X in range(1, LP + 1):
        yb = np.round(ys - SILL * X).astype(int)
        ok = yb >= 0
        ybc = np.clip(yb, 0, H - 1)
        E[TP:, LP - X] = base[ybc].astype(np.uint8)
        A[TP:, LP - X] = ok & edge_ok[ybc]
    for Y in range(1, TP + 1):
        sh = int(round(LEAN * Y))
        E[TP - Y, :E.shape[1] - sh] = E[TP, sh:]
        A[TP - Y, :A.shape[1] - sh] = A[TP, sh:]
    return E, A


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD):
    xs = PIV[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys, ox=0, oy=0):
    xi = np.clip((xs + ox).astype(int), 0, img.shape[1] - 1)
    yi = np.clip((ys + oy).astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def main():
    d, out = sys.argv[1], sys.argv[2]
    nw = np.array(Image.open(os.path.join(d, 'cab-nowheel.png')).convert('RGB'))
    ww = np.array(Image.open(os.path.join(d, 'cab.png')).convert('RGB'))
    al = opaque(nw)
    E, A = extend(nw, al)
    if os.environ.get('DBG'):
        v = E.copy()
        v[~A] = (0, 255, 0)
        Image.fromarray(v).save(os.path.join(os.environ['DBG'], 'cab-alpha.png'))
    y0d = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0d, ROWS)
    d_rgb, d_al = sample(E, xs, ys, LP, TP), sample(A, xs, ys, LP, TP)
    xs, yt = grid(y0d - EXT * PXH, EXT)
    t_rgb, t_al = sample(E, xs, yt, LP, TP), sample(A, xs, yt, LP, TP)
    roof = np.nonzero(yt < -8)[0]
    y1 = roof.max()
    for k, r in enumerate(range(0, y1 + 1)):
        t = k / max(1, y1)
        t_rgb[r, :] = (np.array([30, 30, 34]) * (1 - t) + np.array([62, 62, 70]) * t).astype(np.uint8)
        t_al[r, :] = True
    for c in range(0, t_al.shape[1], 3):
        t_rgb[1:y1 - 1:4, c] = (46, 46, 52)
    t_rgb[y1 + 1:y1 + 3, :] = (14, 14, 16)
    t_al[y1 + 1:y1 + 3, :] = True
    for name, rgb, a_ in (('dash', d_rgb, d_al), ('top', t_rgb, t_al)):
        Image.fromarray(np.dstack([rgb, a_.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'{NAME}-{name}.png'), optimize=True)
    # volante
    w2 = ww.copy()
    lum = w2[592:650, 715:880].astype(int).mean(axis=2)
    plate = np.median(w2[592:650, 715:880][lum < np.percentile(lum, 40)], axis=0).astype(np.uint8)
    w2[602:642, 722:872] = plate
    im = Image.fromarray(w2)
    ImageDraw.Draw(im).text((797, 622), 'CLASSIC', font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 24), fill=(226, 226, 230), anchor='mm')
    w2 = np.array(im)
    Hh, Wh = ww.shape[:2]
    y4, x4 = np.mgrid[0:Hh, 0:Wh]
    rr = np.hypot(x4 - PIV[0], y4 - PIV[1])
    poly = np.zeros((Hh, Wh), np.uint8)
    for sp in [HUB] + SPOKES:
        cv2.fillPoly(poly, [np.array(sp, np.int32)], 1)
    wheel = ((rr <= R_OUT) & (rr >= R_IN)) | (poly.astype(bool) & (rr <= R_OUT))
    xs, ys = grid(y0d - WTOP * PXH, WROWS, 0, 256)
    w_rgb, w_al = sample(w2, xs, ys), sample(wheel, xs, ys) & (ys < Hh)[:, None]
    Image.fromarray(np.dstack([w_rgb, w_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'{NAME}-wheel.png'), optimize=True)
    nat = lambda p: (round(PIV_N[0] + (p[0] - PIV[0]) * S, 2), round((p[1] - y0d) / PXH, 2))
    print('y0d', round(y0d, 1), 'quadro', nat((548, 366)), nat((1038, 528)), 'vidro do retrovisor (empilhado, com PAD)',
          (round(PAD + nat((115, 340))[0]), round(EXT + nat((115, 340))[1])))


if __name__ == '__main__':
    main()
