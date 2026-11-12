"""Cabine do Savana GLS (VW Santana GLS 2.0 1990) a partir das duas artes do Victor (com e sem volante,
com cenário pelos vidros), no molde de voyagesport_cockpit.py (Jornada Sport):
- painel e colunas da arte sem volante; volante de quatro raios da arte com volante: aro pela elipse
  medida e os quatro vãos (o do quadro, os dois dos lados e o de baixo) por contorno. As duas artes estão
  alinhadas; o volante anda 21 px para a direita para ficar centrado no quadro (como no carro de verdade)
- vidros: o cenário é inundado a partir de sementes dentro de cada vidro (para-brisa, janela da porta em
  cima e embaixo do retrovisor, vidro do retrovisor); o contorno preto do carro segura. Ilhas escuras do
  cenário são fechadas; acima das palhetas o para-brisa é fechado linha a linha e coluna a coluna
- os limpadores da arte saem (o jogo desenha os dele, na chuva): o vidro desce até a borda de cima do
  painel (DASH_TOP, medida na arte: 3 linhas de contorno preto acima do friso claro do painel)
- retrovisor interno e haste saem (o jogo desenha o dele)
- retrovisor externo esquerdo: a arte o corta na borda; a moldura direita (canto e friso, sem a caixa)
  é refletida e vira a esquerda, fora da arte (área construída), e o meio continua igual (mirror_complete)
- à esquerda da arte (telas largas) a porta é construída: cada linha continua na própria inclinação
  (ponto de fuga medido nas linhas da soleira e da borracha da janela), nunca espelhada nem esticada
- as duas luzes vermelhas soltas à esquerda do quadro (interruptores do desembaçador traseiro e do farol
  de neblina) saem da arte: o quadro refeito (santana_gauges.py) as desenha apagadas e o jogo acende
- o emblema do miolo do volante vira o da Ipê (brand_badges.py)
- o letreiro do painel do passageiro ("SANTANA GLS") vira "SAVANA GLS" no mesmo estilo (fica fora da
  área que o jogo usa, mas não sobra marca real em lugar nenhum)
- a caixinha à direita do quadro (na arte um mostrador ilegível, com ponteiro e marcas acesos) vira o
  botão do reostato da luz do painel e uma tecla, apagados
- o quadro é refeito por tools/ref/santana_gauges.py (cobre a placa inteira dos mostradores)
Escala 0,34 (pixel 8:7), volante ampliado 1,08x, pivô do volante em (128, 104).
Uso: python3 tools/ref/santana_cockpit.py <pasta com cab-wheel.png e cab-nowheel.png> <src/assets/cockpit>
     (DBG=<pasta> grava as máscaras para conferência)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
import brand_badges  # noqa: E402

S = 0.34
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV = (532.0, 465.5)            # onde o centro do aro fica na arte sem volante: centrado no quadro (x)
PIV_W = (511.0, 465.5)          # centro do aro na arte com volante
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 16, 240
F = 1.08                        # volante ampliado, como nos Jornadas
RIM_OUT = (511.0, 465.5, 256.0, 255.5)   # elipse de fora do aro (com o contorno): cx, cy, rx, ry
RIM_IN = (510.5, 471.0, 218.0, 222.0)    # a de dentro é mais funda embaixo (aro visto de cima)
# vãos do volante (arte com volante); o lado de fora de cada um é a elipse de dentro do aro
HOLES = [
    [(280, 240), (745, 240), (745, 414), (722, 420), (700, 425), (684, 431), (343, 431), (322, 425), (300, 420), (280, 414)],  # quadro
    [(280, 469), (393, 469), (402, 478), (407, 545), (400, 556), (366, 575), (330, 585), (280, 585)],                    # esquerdo
    [(745, 473), (624, 473), (617, 482), (616, 540), (622, 553), (655, 575), (690, 590), (745, 590)],                    # direito
    [(366, 590), (384, 598), (642, 598), (658, 590), (740, 640), (740, 730), (290, 730), (290, 640)],                   # de baixo
]
# sementes de cada vidro na arte sem volante (x, y)
SEEDS = [(600, 150), (300, 120), (30, 150), (30, 300), (40, 385), (1640, 150), (1630, 300)]
WIPER_Y = 200                   # daqui para baixo ficam as palhetas da arte
# borda de cima do painel (x, y: a primeira das 3 linhas do contorno preto acima do friso claro)
DASH_TOP = [(222, 268), (240, 261), (262, 254), (300, 253), (350, 251), (400, 252), (450, 249), (500, 247), (560, 245), (620, 245),
            (680, 247), (760, 247), (800, 246), (1000, 246), (1080, 247), (1120, 249), (1160, 250), (1200, 252), (1240, 254),
            (1300, 258), (1360, 264), (1410, 268), (1445, 272)]
IMIRROR = (700, 8, 975, 135)    # retrovisor interno e haste
LP = 150                        # folga construída à esquerda (px da arte)
VP = (400.0, 210.0)             # ponto de fuga das linhas da porta (medido na soleira e na borracha da janela)
FACE = (377, 298, 687, 422)     # placa dos mostradores (coberta pelo quadro refeito)
SWITCH = (326, 377, 373, 421)   # caixa das duas luzes vermelhas à esquerda do quadro (o quadro refeito desenha)
EMB = (512.5, 498.0, 40)        # emblema do miolo do volante (arte com volante): centro e raio (com a sombra)
# retrovisor externo esquerdo (arte sem volante): linhas da moldura, faixa da moldura direita (do começo
# da curva do canto até a borda de fora, sem a caixa), coluna do meio e a borda de fora da moldura nova
MIR_Y = (236, 360)
MIR_A, MIR_R, MIR_M, MIR_X0 = 54, 74, 30, -34
POD = (697, 376, 744, 434)      # caixinha à direita do quadro (na arte, um relógio sem sentido, com ponteiro aceso)
LETTER = (1265, 442, 1402, 460)  # miolo da placa do letreiro do painel do passageiro


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
    g |= box & rows
    r_, g_, b_ = nw[..., 0].astype(int), nw[..., 1].astype(int), nw[..., 2].astype(int)
    yy, xx = np.mgrid[0:H, 0:W]
    # restos escuros do cenário grudados no contorno (verde das árvores; o carro é cinza-arroxeado)
    for _ in range(30):
        near = cv2.dilate(g.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        g |= near & ~g & (g_ > r_ + 10) & (g_ + b_ > 30)
    # limpadores da arte saem (o jogo desenha os dele): o vidro desce até a borda do painel, medida na arte
    px, py = zip(*DASH_TOP)
    top = np.interp(np.arange(W), px, py)
    span = (xx >= px[0]) & (xx <= px[-1])
    g |= span & (yy >= WIPER_Y - 40) & (yy < top[np.clip(xx, 0, W - 1)])
    g &= ~(span & (yy >= top[np.clip(xx, 0, W - 1)]) & (yy < top[np.clip(xx, 0, W - 1)] + 30))  # do contorno para baixo é painel
    # ilhas escuras do cenário dentro dos vidros (o que não se liga ao carro)
    n, lab, st, _ = cv2.connectedComponentsWithStats((~g).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 2500:
            g[lab == i] = True
    return g


def clean(nw):
    """borda de cima do painel: o contorno preto (3 linhas) é refeito onde as palhetas encostavam nele"""
    out = nw.copy()
    px, py = zip(*DASH_TOP)
    for x in range(px[0], min(px[-1], nw.shape[1])):
        y0 = int(round(np.interp(x, px, py)))
        seg = out[y0:y0 + 3, x]
        seg[seg.astype(int).mean(axis=1) > 30] = (8, 7, 11)
    return out


def letreiro(nw):
    """'SANTANA GLS' -> 'SAVANA GLS': mesma placa escura com o friso, branco + laranja, mesma altura de letra"""
    x0, y0, x1, y1 = LETTER      # miolo da placa (o friso claro em volta fica)
    reg = nw[y0:y1, x0:x1].astype(int)
    bg = np.median(reg[reg.mean(axis=2) < 30], axis=0).astype(np.uint8)
    nw[y0:y1, x0:x1] = bg
    cap = 10                      # altura das maiúsculas na arte
    W, H = (x1 - x0) * 4, (y1 - y0) * 4
    lay = Image.new('RGB', (W, H), tuple(int(v) for v in bg))
    d = ImageDraw.Draw(lay)
    fr = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 10)
    fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 10)
    k = cap * 4 / (fr.getbbox('S')[3] - fr.getbbox('S')[1])
    fr = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', int(10 * k))
    fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(10 * k))
    w1, w2 = d.textlength('SAVANA ', font=fr), d.textlength('GLS', font=fb)
    bb = fr.getbbox('S')
    sx = (W - (w1 + w2)) / 2
    ty = (H - (bb[3] - bb[1])) / 2 - bb[1]
    d.text((sx, ty), 'SAVANA ', font=fr, fill=(238, 236, 240))
    d.text((sx + w1, ty), 'GLS', font=fb, fill=(236, 74, 30))
    nw[y0:y1, x0:x1] = np.array(lay.resize((x1 - x0, y1 - y0), Image.LANCZOS))


def pod(nw):
    """caixinha à direita do quadro: fundo escuro, botão redondo do reostato e uma tecla, sem nada aceso"""
    x0, y0, x1, y1 = POD
    im = Image.fromarray(nw)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([x0, y0, x1, y1], radius=5, fill=(15, 14, 18), outline=(40, 38, 46), width=2)
    cx, cy = (x0 + x1) / 2, y0 + 19
    d.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], fill=(8, 8, 10))
    d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=(58, 56, 64))
    d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(44, 42, 50))
    d.arc([cx - 9, cy - 9, cx + 9, cy + 9], 200, 290, fill=(110, 106, 118), width=2)
    d.line([(cx, cy - 7), (cx, cy - 2)], fill=(196, 192, 200), width=2)
    d.rounded_rectangle([cx - 13, y1 - 22, cx + 13, y1 - 8], radius=3, fill=(8, 8, 10))
    d.rounded_rectangle([cx - 11, y1 - 20, cx + 11, y1 - 10], radius=2, fill=(48, 46, 54))
    d.line([(cx - 11, y1 - 19), (cx + 11, y1 - 19)], fill=(82, 80, 90), width=1)
    nw[:] = np.array(im)


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
        # o que vem das linhas do retrovisor é janela (o retrovisor é refeito à parte, sem inclinação)
        A[:, LP - X] = al[yi, 0] & ~((yi >= MIR_Y[0] - 2) & (yi <= MIR_Y[1] + 9))
    return E, A


def mirror(E, A):
    """retrovisor esquerdo completo: moldura direita refletida vira a esquerda (em MIR_X0, fora da arte)"""
    ya, yb = MIR_Y
    old, olda = E.copy(), A.copy()
    c = lambda x: x + LP
    A[ya:yb + 1, :c(MIR_X0)] = False
    for x in range(MIR_A, MIR_R + 1):
        E[ya:yb + 1, c(MIR_X0 + (MIR_R - x))] = old[ya:yb + 1, c(x)]
        A[ya:yb + 1, c(MIR_X0 + (MIR_R - x))] = olda[ya:yb + 1, c(x)]
    for x in range(MIR_X0 + MIR_R - MIR_A + 1, MIR_M):
        E[ya:yb + 1, c(x)] = old[ya:yb + 1, c(MIR_M)]
        A[ya:yb + 1, c(x)] = olda[ya:yb + 1, c(MIR_M)]


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD, piv=PIV):
    xs = piv[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys, ox=0):
    xi = np.clip(np.floor(xs + ox).astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def main():
    d, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    nw = np.array(Image.open(os.path.join(d, 'cab-nowheel.png')).convert('RGB'))
    ww = np.array(Image.open(os.path.join(d, 'cab-wheel.png')).convert('RGB'))
    g = glass_mask(nw)
    nw = clean(nw)
    letreiro(nw)
    # placa dos mostradores e caixa das luzes vermelhas: fundo escuro liso (o quadro refeito cobre)
    fx0, fy0, fx1, fy1 = FACE
    nw[fy0:fy1, fx0:fx1] = (14, 13, 16)
    sx0, sy0, sx1, sy1 = SWITCH
    nw[sy0:sy1, sx0:sx1] = (14, 13, 16)
    pod(nw)
    E, A = extend(nw, ~g)
    mirror(E, A)
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
        Image.fromarray(np.dstack([rgb, a_.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'br-santana-{name}.png'), optimize=True)

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
        Image.fromarray(v[190:740, 240:790]).resize((1100, 1100), Image.NEAREST).save(os.path.join(dbg, 'wheel-mask.png'))
    wart = ww.copy()
    # emblema do miolo: sai (vira a textura do miolo ao lado, refletida); o da Ipê entra depois, já em pixels do jogo
    ex, ey, er = int(EMB[0]), int(EMB[1]), EMB[2]
    for x in range(ex - er, ex + er + 1):
        sx = 2 * (ex - er - 1) - x if x < ex else 2 * (ex + er + 1) - x
        wart[ey - er:ey + er + 1, x] = ww[ey - er:ey + er + 1, sx]
    xs = PIV_W[0] + (np.arange(256) + 0.5 - PIV_N[0]) * PXW / F
    ys = PIV_W[1] + (np.arange(WROWS) + 0.5 - (PIV_N[1] + WTOP)) * PXH / F
    w_rgb, w_al = sample(wart, xs, ys), sample(wheel, xs, ys) & (ys < Hh)[:, None]
    wimg = np.dstack([w_rgb, w_al.astype(np.uint8) * 255])
    hub = (PIV_N[0] + (EMB[0] - PIV_W[0]) * S * F, PIV_N[1] + WTOP + (EMB[1] - PIV_W[1]) * F / PXH)
    # no lugar do emblema redondo grande: um botão escuro de borda clara (o do carro) com a logo da Ipê
    yy, xx = np.mgrid[0:WROWS, 0:256]
    e = np.hypot((xx + 0.5 - hub[0]) / 1.0, (yy + 0.5 - hub[1]) / (8 / 7))
    wimg[(e <= 11.6) & (wimg[..., 3] > 0), :3] = (14, 13, 17)          # sombra em volta
    wimg[e <= 10.6, :3] = (92, 88, 100)                                  # borda (aro do botão)
    wimg[(e <= 10.6) & (yy + 0.5 > hub[1] + 2), :3] = (60, 57, 67)      # metade de baixo da borda, na sombra
    wimg[e <= 9.4, :3] = (30, 29, 35)                                    # miolo escuro
    brand_badges.stamp(wimg, None, 'ipe', (round(hub[0]), round(hub[1]), 15, 0))
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, 'br-santana-wheel.png'), optimize=True)

    r1 = lambda p: tuple(round(float(v), 2) for v in p)
    print('y0d', round(y0d, 1), 'quadro', r1(nat((fx0, fy0))), r1(nat((fx1, fy1))), 'luzes', r1(nat((sx0, sy0))), r1(nat((sx1, sy1))))
    print('miolo do volante', r1(hub))
    gl = nat((20, 300))
    print('vidro do retrovisor (empilhado, com PAD)', (round(PAD + gl[0]), round(EXT + gl[1])))


if __name__ == '__main__':
    main()
