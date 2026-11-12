"""Cabine do Jornada Sport (VW Voyage Sport 1.8 1992) a partir das duas artes do Victor (com e sem volante,
com cenário pelos vidros), no molde de voyage_cockpit.py (Jornada LS):
- painel e colunas da arte sem volante; volante (miolo largo com quatro botões redondos) da arte com
  volante: aro pela elipse medida, e os quatro vãos (o do quadro, os dois dos lados e o de baixo) por
  contorno. As duas artes estão alinhadas (1 px); o volante desce 21 px para o miolo não tapar o quadro
- vidros: o cenário é inundado a partir de sementes dentro de cada vidro (para-brisa, janela da porta,
  quebra-vento e os dois lados do vidro do retrovisor); o contorno preto do carro segura. Ilhas escuras
  do cenário (troncos, cerca) são fechadas; acima das palhetas o para-brisa é fechado linha a linha
  e coluna a coluna
- os limpadores da arte saem (o jogo desenha os dele, na chuva): o vidro desce até a borda de cima do
  painel (DASH_TOP, medida na arte: capô do quadro com o ressalto no meio), e o contorno escuro fica
- retrovisor interno e haste saem (o jogo desenha o dele)
- retrovisor externo esquerdo: moldura inteira na arte; a coluna do quebra-vento passa na frente do
  vidro e deixa uma lasca dele à esquerda. Uma fenda de 1 linha na coluna liga os dois lados (o jogo
  acha um vidro só) e o jogo repinta a fenda (voyageSportUnder em cockpit.ts)
- à esquerda da arte (telas largas) a porta é construída: cada linha continua na própria inclinação
  (ponto de fuga medido nas linhas da soleira), nunca espelhada nem esticada
- o emblema do miolo do volante vira o da Ipê (brand_badges.py)
- o quadro é refeito por tools/ref/voyagesport_gauges.py (cobre a placa inteira dos mostradores)
Escala 0,34 (pixel 8:7), volante ampliado 1,08x, pivô do volante em (128, 104).
Uso: python3 tools/ref/voyagesport_cockpit.py <pasta com cab-wheel.png e cab-nowheel.png> <src/assets/cockpit>
     (DBG=<pasta> grava as máscaras para conferência)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import brand_badges  # noqa: E402

S = 0.34
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV = (590.0, 580.0)            # onde o centro do aro fica na arte sem volante: centrado no quadro (x) e 21 px
                                # abaixo do lugar da arte (o miolo largo tapava o pé dos mostradores)
PIV_W = (550.5, 559.0)          # centro do aro na arte com volante
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 16, 240
F = 1.08                        # volante ampliado, como no Jornada LS
RIM_OUT = (550.5, 559.0, 256.0, 255.5)   # elipse de fora do aro (com o contorno): cx, cy, rx, ry
RIM_IN = (550.5, 564.0, 221.5, 226.5)       # a de dentro é mais funda embaixo (aro visto de cima)
# vãos do volante (arte com volante); o lado de fora de cada um é a elipse de dentro do aro
HOLES = [
    [(300, 300), (800, 300), (800, 495), (769, 500), (760, 512), (742, 521), (360, 521), (343, 512), (334, 500), (300, 495)],   # quadro
    [(300, 560), (412, 560), (420, 567), (420, 650), (383, 692), (300, 692)],                                                 # esquerdo
    [(801, 560), (694, 560), (686, 567), (686, 650), (722, 692), (801, 692)],                                                 # direito
    [(412, 830), (412, 724), (455, 692), (464, 685), (642, 685), (650, 692), (689, 724), (689, 830)],   # de baixo
]
# sementes de cada vidro na arte sem volante (x, y)
SEEDS = [(600, 250), (30, 250), (110, 330), (90, 485), (10, 500), (100, 410), (31, 380)]
WIPER_Y = 296                   # daqui para baixo ficam as palhetas da arte
# borda de cima do painel (x, y: a primeira linha do contorno preto), medida onde as palhetas não a cobrem:
# canto da coluna, capô do quadro (348), ressalto do meio (338) e o painel do passageiro (355)
DASH_TOP = [(262, 371), (270, 373), (290, 373), (300, 372), (310, 370), (340, 368), (346, 362), (350, 357), (360, 352), (370, 350),
            (380, 349), (390, 348), (497, 348), (500, 344), (504, 340), (507, 338), (672, 338), (680, 341), (686, 345), (692, 348),
            (800, 348), (810, 349), (820, 351), (830, 354), (840, 355), (1300, 355)]
IMIRROR = (680, 0, 1000, 185)   # retrovisor interno e haste
SLIT = (44, 380)                # ponto dentro da coluna do quebra-vento, na linha da fenda (alto do vidro do retrovisor)
LP = 150                        # folga construída à esquerda (px da arte)
VP = (550.0, 330.0)             # ponto de fuga das linhas da porta (medido nas linhas da soleira)
FACE = (412, 398, 768, 534)     # placa dos mostradores (coberta pelo quadro refeito)
EMB = (590.0, 600.0)            # emblema do miolo do volante (arte com volante)


def glass_mask(nw):
    H, W = nw.shape[:2]
    lum = nw.astype(int).mean(axis=2)
    n, lab = cv2.connectedComponents((lum >= 50).astype(np.uint8), connectivity=4)
    g = np.isin(lab, [lab[y, x] for x, y in SEEDS])
    ws = lab == lab[SEEDS[0][1], SEEDS[0][0]]
    # para-brisa acima das palhetas: fechado por linha e por coluna (o vidro não tem reentrâncias ali)
    rows = np.zeros_like(ws)
    cols = np.zeros_like(ws)
    for y in range(WIPER_Y):
        xs = np.nonzero(ws[y])[0]
        if len(xs):
            rows[y, xs.min():xs.max() + 1] = True
    for x in range(W):
        ys = np.nonzero(ws[:WIPER_Y, x])[0]
        if len(ys):
            cols[ys.min():WIPER_Y, x] = True
    g |= rows & cols
    x0, y0, x1, y1 = IMIRROR
    box = np.zeros_like(g)
    box[y0:y1, x0:x1] = True
    g |= box & (rows | (np.arange(H)[:, None] < 70))
    r_, g_, b_ = nw[..., 0].astype(int), nw[..., 1].astype(int), nw[..., 2].astype(int)
    yy, xx = np.mgrid[0:H, 0:W]
    # restos escuros do cenário grudados no contorno (verde/azul-petróleo; o carro é cinza-arroxeado)
    for _ in range(30):
        near = cv2.dilate(g.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        g |= near & ~g & (g_ > r_ + 10) & (g_ + b_ > 30)
    # limpadores da arte saem (o jogo desenha os dele): o vidro desce até a borda do painel, medida na arte
    px, py = zip(*DASH_TOP)
    top = np.interp(np.arange(W), px, py)
    g |= (xx >= px[0]) & (xx <= px[-1]) & (yy >= WIPER_Y - 40) & (yy < top[np.clip(xx, 0, W - 1)])
    g &= ~((xx >= px[0]) & (xx <= px[-1]) & (yy >= top[np.clip(xx, 0, W - 1)]) & (yy < top[np.clip(xx, 0, W - 1)] + 30))  # do contorno para baixo é painel
    # ilhas escuras do cenário dentro dos vidros (o que não se liga ao carro)
    n, lab, st, _ = cv2.connectedComponentsWithStats((~g).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 2500:
            g[lab == i] = True
    return g


def clean(nw):
    """borda de cima do painel: o contorno preto (4 linhas) é refeito onde as palhetas encostavam nele"""
    out = nw.copy()
    px, py = zip(*DASH_TOP)
    for x in range(px[0], min(px[-1], nw.shape[1])):
        y0 = int(round(np.interp(x, px, py)))
        seg = out[y0:y0 + 3, x]
        seg[seg.astype(int).mean(axis=1) > 30] = (8, 7, 11)
        seg = out[y0:y0 + 14, x]     # reflexo amarelo da faixa da pista que sobrou no ressalto: vira o cinza ao lado
        o = (seg[:, 0].astype(int) - seg[:, 2] > 50)
        seg[o] = out[y0:y0 + 14, x - 8][o]
    return out


def extend(nw, al):
    """folga à esquerda: cada linha da porta continua em direção oposta ao ponto de fuga"""
    H, W = nw.shape[:2]
    E = np.zeros((H, W + LP, 3), np.uint8)
    A = np.zeros((H, W + LP), bool)
    E[:, LP:], A[:, LP:] = nw, al
    base = nw[:, 0:3].astype(float).mean(axis=1)
    ys = np.arange(H)
    for X in range(1, LP + 1):
        y0 = VP[1] + (ys - VP[1]) * VP[0] / (VP[0] + X)
        yi = np.clip(np.round(y0).astype(int), 0, H - 1)
        E[:, LP - X] = base[yi].astype(np.uint8)
        A[:, LP - X] = al[yi, 0]
    return E, A


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD, piv=PIV):
    xs = piv[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys, ox=0):
    xi = np.clip((xs + ox).astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def main():
    d, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    nw = np.array(Image.open(os.path.join(d, 'cab-nowheel.png')).convert('RGB'))
    ww = np.array(Image.open(os.path.join(d, 'cab-wheel.png')).convert('RGB'))
    g = glass_mask(nw)
    nw = clean(nw)
    # placa dos mostradores: fundo escuro liso (o quadro refeito cobre)
    fx0, fy0, fx1, fy1 = FACE
    nw[fy0:fy1, fx0:fx1] = (14, 13, 16)
    E, A = extend(nw, ~g)
    if dbg:
        v = E.copy()
        v[~A] = (0, 255, 0)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-alpha.png'))
    y0d = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0d, ROWS)
    d_rgb, d_al = sample(E, xs, ys, LP), sample(A, xs, ys, LP)
    xs, yt = grid(y0d - EXT * PXH, EXT)
    t_rgb, t_al = sample(E, xs, yt, LP), sample(A, xs, yt, LP)
    st_al = np.concatenate([t_al, d_al], axis=0)
    st_rgb = np.concatenate([t_rgb, d_rgb], axis=0)
    nat = lambda p: (PIV_N[0] + (p[0] - PIV[0]) * S, (p[1] - y0d) / PXH)
    # farpas de 1 px espetadas no vidro (pontas de galho e de palheta presas ao contorno) saem
    for _ in range(6):
        nb = np.zeros(st_al.shape, int)
        nb[1:] += st_al[:-1]; nb[:-1] += st_al[1:]; nb[:, 1:] += st_al[:, :-1]; nb[:, :-1] += st_al[:, 1:]
        spur = st_al & (nb <= 1)
        spur[[0, -1]] = False; spur[:, [0, -1]] = False
        st_al &= ~spur
    # fenda na coluna do quebra-vento: liga os dois lados do vidro do retrovisor (uma linha)
    sx, sy = nat(SLIT)
    row = int(sy) + EXT
    a = int(round(sx)) + PAD
    while st_al[row, a - 1]:
        a -= 1
    b = a
    while st_al[row, b]:
        b += 1
    slit = [(int(c), [int(v) for v in st_rgb[row, c]]) for c in range(a, b)]
    st_al[row, a:b] = False
    # furinhos de até 12 px (sobras entre as palhetas e nas quinas): fecham com a cor do vizinho
    n, lab, stt, _ = cv2.connectedComponentsWithStats((~st_al).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        if stt[i, cv2.CC_STAT_AREA] <= 12:
            for y, x in zip(*np.nonzero(lab == i)):
                nb = [(yy_, xx_) for yy_ in range(y - 1, y + 2) for xx_ in range(x - 1, x + 2)
                      if 0 <= yy_ < st_al.shape[0] and 0 <= xx_ < st_al.shape[1] and st_al[yy_, xx_]]
                if nb:
                    st_rgb[y, x] = np.median([st_rgb[q] for q in nb], axis=0)
            st_al[lab == i] = True
    # ilhas opacas soltas no vidro (restos de palheta ou de cenário, até 40 px) somem
    n, lab, stt, _ = cv2.connectedComponentsWithStats(st_al.astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if stt[i, cv2.CC_STAT_AREA] <= 40:
            st_al[lab == i] = False
    t_al, d_al = st_al[:EXT], st_al[EXT:]
    t_rgb, d_rgb = st_rgb[:EXT], st_rgb[EXT:]
    for name, rgb, a_ in (('dash', d_rgb, d_al), ('top', t_rgb, t_al)):
        Image.fromarray(np.dstack([rgb, a_.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'br-voyagesport-{name}.png'), optimize=True)

    # volante (arte com volante)
    Hh, Wh = ww.shape[:2]
    y4, x4 = np.mgrid[0:Hh, 0:Wh]
    ell = lambda e: ((x4 - e[0]) / e[2]) ** 2 + ((y4 - e[1]) / e[3]) ** 2 <= 1
    outer, inner = ell(RIM_OUT), ell(RIM_IN)
    holes = np.zeros((Hh, Wh), np.uint8)
    for h in HOLES:
        cv2.fillPoly(holes, [np.array(h, np.int32)], 1)
    wheel = outer & ~(inner & holes.astype(bool))
    if dbg:
        v = ww.copy()
        v[~wheel] = (v[~wheel] * 0.35 + np.array([0, 160, 0]) * 0.65).astype(np.uint8)
        Image.fromarray(v[280:840, 270:840]).resize((1140, 1120), Image.NEAREST).save(os.path.join(dbg, 'wheel-mask.png'))
    wart = ww.copy()
    # emblema do miolo: sai (vira a textura do miolo ao lado); o da Ipê entra depois, já em pixels do jogo
    ex, ey, er = int(EMB[0]), int(EMB[1]), 21
    for x in range(ex - er, ex + er + 1):  # cada metade recebe a textura do miolo ao lado dela (refletida)
        sx = 2 * (ex - er - 1) - x if x < ex else 2 * (ex + er + 1) - x
        wart[ey - er:ey + er + 1, x] = ww[ey - er:ey + er + 1, sx]
    xs = PIV_W[0] + (np.arange(256) + 0.5 - PIV_N[0]) * PXW / F
    ys = PIV_W[1] + (np.arange(WROWS) + 0.5 - (PIV_N[1] + WTOP)) * PXH / F
    w_rgb, w_al = sample(wart, xs, ys), sample(wheel, xs, ys) & (ys < Hh)[:, None]
    wimg = np.dstack([w_rgb, w_al.astype(np.uint8) * 255])
    hub = (PIV_N[0] + (EMB[0] - PIV_W[0]) * S * F, PIV_N[1] + WTOP + (EMB[1] - PIV_W[1]) * F / PXH)
    brand_badges.stamp(wimg, None, 'ipe', (round(hub[0]), round(hub[1]), 13, 0))
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, 'br-voyagesport-wheel.png'), optimize=True)

    r1 = lambda p: tuple(round(float(v), 2) for v in p)
    print('y0d', round(y0d, 1), 'quadro', r1(nat((fx0, fy0))), r1(nat((fx1, fy1))))
    print('miolo do volante', r1(hub))
    gl = nat((100, 410))
    print('vidro do retrovisor (empilhado, com PAD)', (round(PAD + gl[0]), round(EXT + gl[1])))
    print('fenda: linha', row, 'colunas', a, b - 1, 'cores', slit)


if __name__ == '__main__':
    main()
