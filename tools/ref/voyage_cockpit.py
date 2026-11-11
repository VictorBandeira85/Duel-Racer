"""Cabine do Jornada LS (VW Voyage LS 1986) a partir das duas artes do Victor (com e sem volante, com
cenário pelos vidros):
- painel e colunas da arte sem volante; volante da arte com volante (aro pela elipse medida, miolo e os
  quatro raios por contorno). Na arte com volante o painel está 13 px mais baixo: o pivô respeita isso
- vidros: o cenário é inundado a partir de sementes dentro de cada vidro (para-brisa, janela da porta,
  quebra-vento e os dois lados do vidro do retrovisor); o contorno preto do carro segura. Ilhas escuras
  do cenário (troncos, cerca) são fechadas; acima das palhetas o para-brisa é fechado linha a linha
  e coluna a coluna (bolsos de cenário presos entre a moldura e um tronco). As palhetas ficam
- retrovisor interno e haste saem (o jogo desenha o dele)
- retrovisor externo esquerdo: a arte mostra a moldura inteira; o vidro é cortado em dois pela coluna
  do quebra-vento, que passa na frente. Uma fenda de 1 linha na coluna liga os dois lados (assim o jogo
  acha um vidro só e a vista de trás continua de um lado para o outro); o jogo repinta a fenda
  (voyageSlit em cockpit.ts)
- à esquerda da arte (telas largas) a porta é construída: cada linha continua na própria inclinação
  (as linhas da porta apontam para um ponto de fuga medido), nunca espelhada nem esticada
- chaveiro com a marca: argola e medalha saem (fica a chave); o emblema do miolo do volante vira o da
  Ipê (brand_badges.py); o letreiro do painel do passageiro fica fora do enquadramento
- o quadro é refeito por tools/ref/voyage_gauges.py (cobre a janela inteira dos mostradores)
Escala 0,34 (pixel 8:7), pivô do volante em (128, 104).
Uso: python3 tools/ref/voyage_cockpit.py <pasta com cab-wheel.png e cab-nowheel.png> <src/assets/cockpit>
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
PIV = (540.0, 587.0)            # centro do aro levado para a arte sem volante (painel 13 px mais alto)
PIV_W = (540.0, 600.0)          # centro do aro na arte com volante
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 8, 240
RIM_OUT = (540.0, 600.0, 269.5, 278.5)   # elipse de fora do aro (com o contorno): cx, cy, rx, ry
RIM_IN = (539.0, 599.0, 222.0, 229.5)
HUB = [(495, 552), (605, 552), (626, 563), (634, 588), (634, 652), (624, 673), (602, 682), (498, 682),
       (476, 673), (466, 652), (466, 588), (474, 563)]
SPOKES = [
    [(300, 530), (360, 541), (398, 550), (474, 574), (474, 606), (400, 576), (360, 562), (300, 554)],
    [(800, 530), (742, 543), (702, 552), (626, 577), (626, 607), (700, 577), (742, 564), (800, 554)],
    [(470, 650), (508, 683), (503, 702), (436, 770), (420, 800), (350, 765), (372, 745), (397, 722), (455, 660)],
    [(630, 650), (592, 683), (597, 702), (664, 770), (680, 800), (750, 765), (728, 745), (703, 722), (645, 660)],
]
# sementes de cada vidro na arte sem volante (x, y)
SEEDS = [(840, 300), (30, 200), (125, 300), (40, 400), (110, 400), (100, 472)]
WIPER_Y = 316                   # daqui para baixo ficam as palhetas: o para-brisa não é fechado por linhas
IMIRROR = (690, 0, 990, 200)    # retrovisor interno e haste
SLIT_Y = 366                    # linha da fenda na coluna do quebra-vento (alto do vidro do retrovisor)
LP = 150                        # folga construída à esquerda (px da arte)
VP = (952.0, 20.0)              # ponto de fuga das linhas da porta (medido em 4 linhas da arte)
FACE = (354, 411, 778, 520)     # janela dos mostradores (coberta pelo quadro refeito)
KEY = (674, 606, 722, 678)      # argola e medalha do chaveiro
IGN = (690.0, 592.0, 30.0)      # miolo da ignição (o contorno é refeito onde a argola passava)
EMB = (549.0, 612.0)            # emblema do miolo do volante (arte com volante)


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
    # ilhas escuras do cenário dentro dos vidros (o que não se liga ao carro)
    n, lab, st, _ = cv2.connectedComponentsWithStats((~g).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 2500:
            g[lab == i] = True
    return g


def clean(nw):
    """chaveiro sem argola nem medalha: o painel de 60 px à esquerda entra no lugar"""
    out = nw.copy()
    x0, y0, x1, y1 = KEY
    yy, xx = np.mgrid[y0:y1, x0:x1]
    key = (yy < 613) & (xx > 694)     # a ponta da chave fica
    patch = nw[y0:y1, x0 - 60:x1 - 60].copy()
    d = np.hypot(xx - IGN[0], yy - IGN[1])
    patch[d < IGN[2]] = (9, 8, 12)    # contorno do miolo da ignição
    patch[d < IGN[2] - 4] = nw[y0:y1, x0:x1][d < IGN[2] - 4]
    reg = out[y0:y1, x0:x1]
    reg[~key] = patch[~key]
    # o que sobrou de amarelo/branco da argola junto da chave
    r, g, b = reg[..., 0].astype(int), reg[..., 1].astype(int), reg[..., 2].astype(int)
    ring = (r > 150) & (g > 120) & (b < 110)
    reg[ring] = (9, 8, 12)
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
    # janela dos mostradores: fundo escuro liso (o quadro refeito cobre)
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
    # fenda na coluna do quebra-vento: liga os dois lados do vidro do retrovisor (uma linha)
    sx, sy = nat((70, SLIT_Y))
    row = int(sy) + EXT
    c0 = int(round(sx)) + PAD
    a, b = c0, c0
    while st_al[row, a - 1]:
        a -= 1
    while not st_al[row, a]:
        a += 1
    b = a
    while st_al[row, b]:
        b += 1
    slit = [(int(c), [int(v) for v in st_rgb[row, c]]) for c in range(a, b)]
    st_al[row, a:b] = False
    t_al, d_al = st_al[:EXT], st_al[EXT:]
    for name, rgb, a_ in (('dash', d_rgb, d_al), ('top', t_rgb, t_al)):
        Image.fromarray(np.dstack([rgb, a_.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'br-voyage-{name}.png'), optimize=True)

    # volante (arte com volante)
    Hh, Wh = ww.shape[:2]
    y4, x4 = np.mgrid[0:Hh, 0:Wh]
    ell = lambda e: ((x4 - e[0]) / e[2]) ** 2 + ((y4 - e[1]) / e[3]) ** 2 <= 1
    outer, inner = ell(RIM_OUT), ell(RIM_IN)
    poly = np.zeros((Hh, Wh), np.uint8)
    cv2.fillPoly(poly, [np.array(HUB, np.int32)], 1)
    for sp in SPOKES:
        cv2.fillPoly(poly, [np.array(sp, np.int32)], 1)
    wheel = (outer & ~inner) | (poly.astype(bool) & outer)
    wart = ww.copy()
    # emblema do miolo: sai (vira a textura do miolo ao lado); o da Ipê entra depois, já em pixels do jogo
    ex, ey = EMB
    em = (np.abs(x4 - ex) < 30) & (np.abs(y4 - ey) < 32)
    src = ww[:, ::-1][:, :]  # a textura do miolo é simétrica: usa o lado esquerdo deslocado
    wart[em] = ww[y4[em], x4[em] - 62]
    xs, ys = grid(y0d - WTOP * PXH + (PIV_W[1] - PIV[1]), WROWS, 0, 256, PIV_W)
    w_rgb, w_al = sample(wart, xs, ys), sample(wheel, xs, ys) & (ys < Hh)[:, None]
    wimg = np.dstack([w_rgb, w_al.astype(np.uint8) * 255])
    y0w = y0d - WTOP * PXH + (PIV_W[1] - PIV[1])
    hub = (PIV_N[0] + (ex - PIV_W[0]) * S, (ey - y0w) / PXH)
    brand_badges.stamp(wimg, None, 'ipe', (round(hub[0]), round(hub[1]), 13, 0))
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, 'br-voyage-wheel.png'), optimize=True)

    r1 = lambda p: tuple(round(float(v), 2) for v in p)
    print('y0d', round(y0d, 1), 'quadro', r1(nat((fx0, fy0))), r1(nat((fx1, fy1))))
    print('miolo do volante', r1(hub))
    gl = nat((110, 400))
    print('vidro do retrovisor (empilhado, com PAD)', (round(PAD + gl[0]), round(EXT + gl[1])))
    print('fenda: linha', row, 'colunas', a, b - 1, 'cores', slit)


if __name__ == '__main__':
    main()
