"""Cabine do Silber 95 (Porsche 959) a partir da arte do Victor (por enquanto só a versão COM volante;
a sem volante vem depois), no molde de santana_cockpit.py:
- volante de quatro raios (aro, barra de cima, barra de baixo e a almofada) recortado da arte com volante:
  aro pela elipse medida e os quatro vãos (o do quadro, os dois dos lados da almofada e o de baixo) por
  contorno. O volante anda DX px para a direita para ficar centrado no conta-giros (como no carro de
  verdade: o aro emoldura os três mostradores do meio)
- "PORSCHE 959" da almofada sai (textura da própria almofada) e entra "SILBER 95" no mesmo baixo-relevo
- painel: se houver cab-nowheel.png na pasta, ele é usado direto (só falta medir de novo DASH_TOP e as
  sementes, se a arte nova vier deslocada). Sem ela, o que fica atrás do volante é RECONSTRUÍDO
  (rebuild): o aro de cima sobre o para-brisa vira vidro; no capuz do quadro e no painel cada linha
  continua a textura dos dois lados (bridge); a borda de baixo do capuz do quadro é refeita com o perfil
  medido embaixo do relógio da direita (LIP); embaixo do quadro, dentro do aro, o painel de baixo anda
  junto com o volante (a coluna de direção, as alavancas e o vão escuro da arte, deslocados DX), e atrás
  da almofada e das barras entra o vão escuro com a capa da coluna de direção
- vidros: o cenário (parede de tijolos e estacionamento) é inundado a partir de sementes dentro de cada
  vidro (para-brisa, janela da porta, vidro do retrovisor esquerdo); o contorno preto do carro segura.
  Ilhas do cenário (palhetas, rejunte) são fechadas
- os limpadores da arte saem (o jogo desenha os dele, na chuva): o vidro desce até a borda de cima do
  painel (DASH_TOP, medida na arte: o contorno preto acima do friso claro do painel)
- retrovisor interno e haste saem (o jogo desenha o dele); o forro e as duas luzes de teto ficam
- retrovisor externo esquerdo: a arte o corta na borda; a moldura arredondada da direita (sem a aba presa
  à porta) é refletida e vira a esquerda, fora da arte (área construída), e o meio continua igual
- à esquerda da arte (telas largas) a porta é construída: cada linha continua na própria inclinação
  (ponto de fuga medido no friso claro e na borda da janela), nunca espelhada nem esticada
- os cinco mostradores ficam com o fundo liso da arte: o quadro refeito (silber_gauges.py) cobre cada um
  (aro cromado + fundo), e o jogo desenha ponteiros, tambores e luzes
Escala 0,34 (pixel 8:7), volante na mesma escala, pivô do volante em (128, 104).
Uso: python3 tools/ref/silber_cockpit.py <pasta com cab-wheel.png [e cab-nowheel.png]> <src/assets/cockpit>
     (DBG=<pasta> grava as máscaras e o painel reconstruído para conferência)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

S = 0.34
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV_W = (520.0, 508.0)          # centro do aro na arte com volante
PIV = (563.0, 508.0)            # onde o centro do aro fica no painel: no eixo do conta-giros (x)
DX = int(PIV[0] - PIV_W[0])     # quanto o volante (e o que anda com a coluna) vai para a direita
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 16, 240
RIM_OUT = (520.0, 508.0, 287.0, 297.0)   # elipse de fora do aro (com o contorno): cx, cy, rx, ry
RIM_IN = (522.0, 496.0, 242.0, 264.0)    # a de dentro é mais funda embaixo (aro visto de cima)
# no vão do quadro a face de dentro do aro (escura, com a costura) é mais larga: o vão é o contorno de
# dentro dessa faixa, medido na arte (da barra de cima, à esquerda, até a barra, à direita)
TOP_IN = [(300, 453), (304, 440), (310, 420), (318, 400), (330, 380), (342, 360), (357, 340), (373, 320), (392, 300), (412, 284),
          (440, 270), (470, 262), (500, 259), (530, 258), (568, 262), (605, 280), (632, 299), (668, 316), (696, 339), (715, 362), (735, 391), (742, 420),
          (738, 440), (728, 456)]
# vãos do volante (arte com volante); o lado de fora de cada um é a elipse de dentro do aro
HOLES = [
    [(250, 150), (800, 150), (800, 437), (760, 441), (740, 444), (700, 450), (650, 453), (400, 453), (340, 449), (310, 438), (290, 428), (250, 420)],  # quadro
    [(294, 470), (330, 468), (347, 480), (347, 610), (294, 610)],                                         # esquerdo (sem a costura do aro)
    [(752, 474), (712, 474), (693, 480), (693, 612), (752, 612)],                                         # direito
    [(250, 642), (800, 642), (800, 800), (250, 800)],                                                     # de baixo
]
# sementes de cada vidro (x, y): para-brisa, janela da porta esquerda (em cima e embaixo do retrovisor),
# vidro do retrovisor esquerdo, janelas da direita
SEEDS = [(600, 150), (1300, 150), (60, 150), (60, 250), (20, 350), (1640, 150), (1625, 250)]
WIPER_Y = 205                   # daqui para baixo ficam as palhetas da arte
# borda de cima do painel (x, y: a primeira das 3 linhas do contorno preto acima do friso claro)
DASH_TOP = [(190, 323), (200, 320), (250, 308), (300, 299), (400, 291), (450, 285), (500, 283), (540, 281), (600, 280), (700, 279),
            (800, 278), (900, 278), (1000, 279), (1050, 280), (1100, 283), (1150, 284), (1200, 287), (1250, 290), (1300, 294),
            (1350, 300), (1400, 306), (1450, 316), (1482, 325)]
IMIRROR = (688, 56, 992, 172)   # retrovisor interno e haste (abaixo do forro)
LP = 125                        # folga construída à esquerda (px da arte)
VP = (444.0, 183.0)             # ponto de fuga das linhas da porta (friso claro e borda da janela)
# retrovisor externo esquerdo: linhas da moldura, faixa da moldura direita refletida (do começo da curva
# do canto até a borda de fora, sem a aba presa à porta), coluna do meio e a borda de fora da moldura nova
MIR_Y = (309, 401)
MIR_A, MIR_R, MIR_M, MIR_X0 = 34, 62, 22, -46
MIR_BOX = (0, 300, 100, 410)    # caixa do retrovisor esquerdo (moldura não é ilha do cenário)
# mostradores (centro, raio do aro na arte): o quadro refeito cobre cada um
DIALS = [(284, 399, 52), (426, 400, 64), (563, 399, 69), (709, 400, 68), (836, 404, 58)]
GAP = (770, 398, 786, 462)     # entre o velocímetro e o da direita: sobras da luz laranja da arte
G1_ART = (285, 398, 64, 53)   # o da esquerda na arte é uma elipse larga (pod inclinado): o miolo vira fundo do pod
# reconstrução (rebuild): borda de baixo do capuz do quadro (linhas) e de onde vem o perfil dela
LIP = (452, 490)
LIP_X = (226, 812)
# perfil da borda de baixo do capuz (linhas, cor de cima, cor de baixo, força do grão), como embaixo do
# relógio da direita
LIP_ROWS = [(452, 467, (10, 9, 12), (10, 9, 12), 0.25), (467, 470, (5, 4, 7), (5, 4, 7), 0.1), (470, 473, (104, 100, 114), (78, 74, 88), 0.4),
            (473, 485, (60, 57, 68), (40, 38, 47), 0.7), (485, 490, (9, 8, 11), (14, 13, 17), 0.3)]
BAND_TOP = 490                  # daqui para baixo, dentro do aro, o painel anda junto com a coluna
EMB_TXT = (392, 516, 636, 570)  # letreiro da almofada (arte com volante)


def ellipse(shape, e):
    H, W = shape
    y, x = np.mgrid[0:H, 0:W]
    return ((x - e[0]) / e[2]) ** 2 + ((y - e[1]) / e[3]) ** 2 <= 1


def wheel_mask(shape):
    top_in = np.zeros(shape, np.uint8)
    cv2.fillPoly(top_in, [np.array(TOP_IN, np.int32)], 1)
    top_in = top_in.astype(bool)
    hole = np.zeros(shape, bool)
    for i, h in enumerate(HOLES):
        m = np.zeros(shape, np.uint8)
        cv2.fillPoly(m, [np.array(h, np.int32)], 1)
        hole |= m.astype(bool) & (top_in if i == 0 else ellipse(shape, RIM_IN))
    return ellipse(shape, RIM_OUT) & ~hole


def dash_top(W):
    px, py = zip(*DASH_TOP)
    return np.interp(np.arange(W), px, py), px[0], px[-1]


def bridge(img, hole, bad=None, inward=None):
    """cada trecho de linha a refazer continua a textura dos dois lados: cópia deslocada da faixa da
    esquerda passando para a da direita (sem espelhar). `bad`: pixels que não servem de fonte (vidro):
    ali vale só o outro lado. `inward` (x do centro do volante): a textura vem do lado de dentro do aro
    (o capuz do quadro é reto ali; por fora ele faz a curva das pontas) e só o último quarto passa
    para o lado de fora, para não ficar emenda"""
    if bad is None:
        bad = np.zeros_like(hole)
    H, W = hole.shape
    out = img.astype(float)
    for y in range(H):
        row = hole[y]
        if not row.any():
            continue
        xs = np.nonzero(row)[0]
        runs = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
        for r in runs:
            a, b = r[0], r[-1]
            n = b - a + 1
            i = np.arange(n)
            okl = a > 0
            okr = b < W - 1
            lsrc = a - n + i
            lsrc = np.where(lsrc < 0, a - 1 - (i % max(1, a)), lsrc) if okl else None
            rsrc = b + 1 + i
            rsrc = np.where(rsrc > W - 1, b + 1 + (i % max(1, W - 1 - b)), rsrc) if okr else None
            t = ((i + 0.5) / n)[:, None]
            if inward is not None:
                if (a + b) / 2 < inward:   # aro à esquerda do centro: dentro = direita
                    t = 1 - np.clip(((1 - t) - 0.75) / 0.25, 0, 1)
                else:
                    t = np.clip((t - 0.75) / 0.25, 0, 1)
            if okl and okr:
                wl, wr = (1 - t) * ~bad[y, lsrc][:, None], t * ~bad[y, rsrc][:, None]
                sw = wl + wr
                wl, wr = np.where(sw > 0, wl / np.maximum(sw, 1e-9), 1 - t), np.where(sw > 0, wr / np.maximum(sw, 1e-9), t)
                v = out[y, lsrc] * wl + out[y, rsrc] * wr
            else:
                v = out[y, lsrc] if okl else out[y, rsrc]
            out[y, a:b + 1] = v
    return out.astype(np.uint8)


def grain(ww):
    """grão do couro para as partes refeitas: pontinhos claros e escuros soltos, como o pontilhado da arte
    (sem faixas nem repetição visível)"""
    rs = np.random.RandomState(959)
    n = rs.normal(0, 1, (128, 128))
    n = cv2.GaussianBlur(n, (3, 3), 0.7)
    n = n / n.std() * 7.5
    return np.repeat(n[..., None], 3, axis=2)


def put(out, m, base, det, k):
    """pinta a cor `base` (por pixel ou uma só) com o grão do couro repetido"""
    ys, xs = np.nonzero(m)
    gh, gw = det.shape[:2]
    b = base[ys, xs] if isinstance(base, np.ndarray) and base.ndim == 3 else np.array(base, float)
    out[ys, xs] = np.clip(b + det[ys % gh, xs % gw] * k, 0, 255).astype(np.uint8)


def smooth_rows(out, hole, det):
    """cada trecho de linha recebe a cor dos dois lados (mediana de 6 px), passando de uma para a outra,
    com o grão do couro por cima: as bordas e frisos continuam retos, sem copiar botões nem saídas de ar"""
    H, W = hole.shape
    base = np.zeros((H, W, 3))
    for y in range(H):
        if not hole[y].any():
            continue
        xs = np.nonzero(hole[y])[0]
        for r in np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1):
            a, b = r[0], r[-1]
            cl = np.median(out[y, max(0, a - 6):a], axis=0) if a > 0 else None
            cr = np.median(out[y, b + 1:b + 7], axis=0) if b < W - 1 else None
            cl = cr if cl is None else cl
            cr = cl if cr is None else cr
            t = ((np.arange(b - a + 1) + 0.5) / (b - a + 1))[:, None]
            base[y, a:b + 1] = cl * (1 - t) + cr * t
    put(out, hole, base, det, 0.7)


def rebuild(ww, wheel):
    """o painel atrás do volante, enquanto não chega a arte sem volante (ver o cabeçalho)"""
    H, W = wheel.shape
    out = ww.copy()
    det = grain(ww)
    top, _, _ = dash_top(W)
    yy, xx = np.mgrid[0:H, 0:W]
    hole = wheel.copy()
    # 1) aro sobre o para-brisa: vira vidro (cor qualquer, a máscara do vidro marca)
    above = hole & (yy < top[np.clip(xx, 0, W - 1)])
    hole &= ~above
    # 2) capuz e painel do quadro (acima da borda de baixo do capuz): cada linha continua a textura
    upper = hole & (yy < LIP[0])
    out = bridge(out, upper, yy < top[np.clip(xx, 0, W - 1)] + 2, PIV_W[0])
    hole &= ~upper
    # 3) dentro do aro, embaixo do quadro: o painel de baixo anda junto com a coluna de direção (DX)
    inner_new = ellipse((H, W), (RIM_IN[0] + DX, RIM_IN[1], RIM_IN[2] + 6, RIM_IN[3] + 6))
    band = inner_new & (yy >= BAND_TOP) & (xx >= DX)
    src_wheel = np.zeros_like(wheel)
    src_wheel[:, DX:] = wheel[:, :-DX]
    shifted = np.zeros_like(ww)
    shifted[:, DX:] = ww[:, :-DX]
    take = band & ~src_wheel
    out[take] = shifted[take]
    # atrás da almofada e das barras (na arte): vão escuro do painel de baixo e a capa da coluna
    dark = band & src_wheel
    put(out, dark, (17, 16, 21), det, 0.45)
    col = Image.fromarray(out)
    d = ImageDraw.Draw(col)
    cx = PIV[0]
    d.rounded_rectangle([cx - 78, 522, cx + 78, 720], radius=26, fill=(8, 7, 10))
    d.rounded_rectangle([cx - 74, 525, cx + 74, 720], radius=24, fill=(46, 44, 53))
    d.rounded_rectangle([cx - 70, 531, cx + 70, 720], radius=21, fill=(34, 32, 40))
    d.line([(cx - 52, 528), (cx + 52, 528)], fill=(84, 80, 94), width=2)
    shroud = np.array(col)
    m = dark & (yy >= 522) & (np.abs(xx - cx) <= 78)
    out[m] = shroud[m]
    put(out, m & (np.abs(xx - cx) <= 66) & (yy >= 534), shroud.astype(float), det, 0.4)
    hole &= ~band
    # 4) borda de baixo do capuz do quadro, entre os dois lados que a arte mostra: fundo preto do quadro,
    # contorno, friso claro, a aba de couro e a sombra
    lip = hole & (yy >= LIP[0]) & (yy < LIP[1]) & (xx >= LIP_X[0]) & (xx <= LIP_X[1])
    for y0, y1, c0, c1, k in LIP_ROWS:
        for y in range(y0, y1):
            t = (y - y0) / max(1, y1 - y0 - 1)
            c = tuple(c0[i] * (1 - t) + c1[i] * t for i in range(3))
            put(out, lip & (yy == y), c, det, k)
    hole &= ~lip
    # 5) o resto embaixo (fora do aro novo): a cor dos dois lados de cada linha, com o grão do couro
    smooth_rows(out, hole, det)
    return out, above


def glass_mask(img, forced):
    H, W = img.shape[:2]
    lum = img.astype(int).mean(axis=2)
    n, lab = cv2.connectedComponents((lum >= 12).astype(np.uint8), connectivity=4)
    g = np.isin(lab, [lab[y, x] for x, y in SEEDS])
    g |= forced
    yy, xx = np.mgrid[0:H, 0:W]
    # limpadores da arte saem: o vidro desce até a borda do painel, medida na arte
    top, x0, x1 = dash_top(W)
    span = (xx >= x0) & (xx <= x1)
    tt = top[np.clip(xx, 0, W - 1)]
    g |= span & (yy >= WIPER_Y) & (yy < tt)
    g &= ~(span & (yy >= tt))
    # retrovisor esquerdo: o cenário vaza pelas frestas do contorno para a moldura prateada; na caixa
    # dele vale a cor: vidro azul (vira o espelho do jogo) (verde-azulado) e cenário (asfalto, pouco azul); a caixa e a moldura são azul-acinzentadas
    x0, y0, x1, y1 = MIR_BOX
    rr, gg, bb = (img[y0:y1, x0:x1, i].astype(int) for i in range(3))
    lu = (rr + gg + bb) / 3
    vid = ((bb - rr > 35) & (gg - rr > 12)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(1 - vid, connectivity=4)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 60:   # pintinhas escuras dentro do vidro
            vid[lab == i] = 1
    vid = vid > 0
    g[y0:y1, x0:x1] = vid | (g[y0:y1, x0:x1] & (rr - bb > -8) & (lu < 165))
    # retrovisor interno e haste
    a0, b0, a1, b1 = IMIRROR
    g[b0:b1, a0:a1] = True
    # ilhas do cenário dentro dos vidros (rejunte, palhetas, sobras): o que não se liga ao carro
    n, lab, st, _ = cv2.connectedComponentsWithStats((~g).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        x, y, w, h = st[i, :4]
        if st[i, cv2.CC_STAT_AREA] < 2500 and not (x < MIR_BOX[2] and MIR_BOX[1] < y < MIR_BOX[3]):
            g[lab == i] = True
    return g


def clean(img):
    """borda de cima do painel: o contorno preto (3 linhas) é refeito onde as palhetas encostavam nele"""
    out = img.copy()
    px, py = zip(*DASH_TOP)
    for x in range(px[0], min(px[-1], img.shape[1])):
        y0 = int(round(np.interp(x, px, py)))
        seg = out[y0:y0 + 3, x]
        seg[seg.astype(int).mean(axis=1) > 30] = (8, 7, 11)
    return out


def dials(img):
    """fundo liso no lugar dos cinco mostradores da arte (o quadro refeito cobre com aro e fundo)"""
    im = Image.fromarray(img)
    d = ImageDraw.Draw(im)
    ex, ey, rx, ry = G1_ART
    d.ellipse([ex - rx, ey - ry, ex + rx, ey + ry], fill=(12, 11, 15))
    for cx, cy, r in DIALS:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(9, 9, 11))
    d.rectangle(GAP, fill=(9, 9, 11))
    img[:] = np.array(im)


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


def pad_text(ww):
    """'PORSCHE 959' sai da almofada: cada metade do letreiro recebe a textura lisa logo acima/abaixo"""
    x0, y0, x1, y1 = EMB_TXT
    out = ww.copy()
    mid = (y0 + y1) // 2
    h1, h2 = mid - y0, y1 - mid
    out[y0:mid, x0:x1] = ww[y0 - h1:y0, x0:x1]
    out[mid:y1, x0:x1] = ww[y1:y1 + h2, x0:x1]
    return out


def emboss(wimg, cx, cy):
    """'SILBER' e '95' embaixo, à direita (como o letreiro da fábrica), em baixo-relevo: letra escura
    com a borda de baixo clara, na resolução do jogo (feita em 6x e reduzida)"""
    K = 6
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 9 * K)
    def lay(s, w):
        bb = f.getbbox(s)
        im = Image.new('L', (bb[2] - bb[0] + 4, bb[3] - bb[1] + 4), 0)
        ImageDraw.Draw(im).text((2 - bb[0], 2 - bb[1]), s, font=f, fill=255)
        return im.resize((int(w * K), int(round(4.2 * K))), Image.LANCZOS)
    l1, l2 = lay('SILBER', 33), lay('95', 12)
    Wd, Hd = 40 * K, 12 * K
    m = Image.new('L', (Wd, Hd), 0)
    m.paste(l1, (int(1.5 * K), 0))
    m.paste(l2, (int(1.5 * K + 33 * K - 12 * K), int(5.4 * K)))
    m = m.resize((40, 12), Image.LANCZOS)
    mm = np.array(m).astype(float) / 255
    x0, y0 = int(round(cx - 20)), int(round(cy - 6))
    reg = wimg[y0:y0 + 12, x0:x0 + 40, :3].astype(float)
    hi = np.zeros_like(mm)
    hi[1:, :] = mm[:-1, :]
    hi = np.clip(hi - mm, 0, 1)
    reg = reg * (1 - mm[..., None] * 0.55)                       # fundo da letra (mais escuro)
    reg = reg + hi[..., None] * 34                               # borda de baixo, clara
    wimg[y0:y0 + 12, x0:x0 + 40, :3] = np.clip(reg, 0, 255).astype(np.uint8)


def main():
    d, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    ww = np.array(Image.open(os.path.join(d, 'cab-wheel.png')).convert('RGB'))
    H, W = ww.shape[:2]
    wheel = wheel_mask((H, W))
    nwp = os.path.join(d, 'cab-nowheel.png')
    if os.path.exists(nwp):
        nw = np.array(Image.open(nwp).convert('RGB'))
        forced = np.zeros((H, W), bool)
        print('painel da arte sem volante')
    else:
        nw, forced = rebuild(ww, wheel)
        print('painel reconstruído atrás do volante (falta a arte sem volante)')
    g = glass_mask(nw, forced)
    nw = clean(nw)
    dials(nw)
    if dbg:
        v = nw.copy()
        v[g] = (0, 255, 0)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-alpha.png'))
        Image.fromarray(nw).save(os.path.join(dbg, 'cab-rebuilt.png'))
    E, A = extend(nw, ~g)
    mirror(E, A)
    if dbg:
        v = E.copy()
        v[~A] = (0, 255, 0)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-ext.png'))
    y0d = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0d, ROWS)
    d_rgb, d_al = sample(E, xs, ys, LP), sample(A, xs, ys, LP)
    xs, yt = grid(y0d - EXT * PXH, EXT)
    t_rgb, t_al = sample(E, xs, yt, LP), sample(A, xs, yt, LP)
    st_al = np.concatenate([t_al, d_al], axis=0)
    st_rgb = np.concatenate([t_rgb, d_rgb], axis=0)
    nat = lambda p: (PIV_N[0] + (p[0] - PIV[0]) * S, (p[1] - y0d) / PXH)
    # farpas de 1 px espetadas no vidro saem
    for _ in range(6):
        nb = np.zeros(st_al.shape, int)
        nb[1:] += st_al[:-1]; nb[:-1] += st_al[1:]; nb[:, 1:] += st_al[:, :-1]; nb[:, :-1] += st_al[:, 1:]
        spur = st_al & (nb <= 1)
        spur[[0, -1]] = False; spur[:, [0, -1]] = False
        st_al &= ~spur
    # furinhos de até 12 px: fecham com a cor do vizinho
    n, lab, stt, _ = cv2.connectedComponentsWithStats((~st_al).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        if stt[i, cv2.CC_STAT_AREA] <= 12:
            for y, x in zip(*np.nonzero(lab == i)):
                nb = [(yy_, xx_) for yy_ in range(y - 1, y + 2) for xx_ in range(x - 1, x + 2)
                      if 0 <= yy_ < st_al.shape[0] and 0 <= xx_ < st_al.shape[1] and st_al[yy_, xx_]]
                if nb:
                    st_rgb[y, x] = np.median([st_rgb[q] for q in nb], axis=0)
            st_al[lab == i] = True
    # ilhas opacas soltas no vidro (até 40 px) somem
    n, lab, stt, _ = cv2.connectedComponentsWithStats(st_al.astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if stt[i, cv2.CC_STAT_AREA] <= 40:
            st_al[lab == i] = False
    t_al, d_al = st_al[:EXT], st_al[EXT:]
    t_rgb, d_rgb = st_rgb[:EXT], st_rgb[EXT:]
    for name, rgb, a_ in (('dash', d_rgb, d_al), ('top', t_rgb, t_al)):
        Image.fromarray(np.dstack([rgb, a_.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'959-{name}.png'), optimize=True)

    # volante (arte com volante), na mesma escala do painel
    if dbg:
        v = ww.copy()
        v[~wheel] = (v[~wheel] * 0.35 + np.array([0, 160, 0]) * 0.65).astype(np.uint8)
        Image.fromarray(v[190:820, 210:830]).save(os.path.join(dbg, 'wheel-mask.png'))
    wart = pad_text(ww)
    xs = PIV_W[0] + (np.arange(256) + 0.5 - PIV_N[0]) * PXW
    ys = PIV_W[1] + (np.arange(WROWS) + 0.5 - (PIV_N[1] + WTOP)) * PXH
    w_rgb, w_al = sample(wart, xs, ys), sample(wheel, xs, ys) & (ys < H)[:, None]
    wimg = np.dstack([w_rgb, w_al.astype(np.uint8) * 255])
    tx = PIV_N[0] + ((EMB_TXT[0] + EMB_TXT[2]) / 2 - PIV_W[0]) * S
    ty = PIV_N[1] + WTOP + ((EMB_TXT[1] + EMB_TXT[3]) / 2 - PIV_W[1]) / PXH
    emboss(wimg, tx, ty)
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, '959-wheel.png'), optimize=True)

    r1 = lambda p: tuple(round(float(v), 2) for v in p)
    print('y0d', round(y0d, 2))
    for cx, cy, r in DIALS:
        print('mostrador', r1(nat((cx, cy))), 'raio', round(r * S, 2))
    gl = nat((MIR_X0 + 30, 355))
    print('vidro do retrovisor (empilhado, com PAD)', (round(PAD + gl[0]), round(EXT + gl[1])))


if __name__ == '__main__':
    main()
