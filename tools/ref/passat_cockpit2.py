"""Cabine do Passeio GTS (VW Passat GTS Pointer 1985) a partir das duas artes novas do Victor (com e sem
volante, com cenário pelos vidros), no molde de santana_cockpit.py (Savana GLS):
- painel, colunas e porta da arte sem volante; volante de quatro raios da arte com volante: aro pela
  elipse medida e os quatro vãos (o do quadro, os dois dos lados e o de baixo) por contorno. As duas
  artes estão quase alinhadas (a com volante tem uma coluna a mais à direita, cortada); o volante é
  desenhado centrado no quadro (no carro de verdade o quadro fica no meio do aro): o painel é ancorado
  no meio da janela do quadro (x 720) e o volante, no centro do aro dele (x 686), anda 34 px para a direita
- altura: o painel é ancorado em y 500 (assim o topo de 76 linhas ainda pega a borda do forro e os
  quebra-sóis); o volante fica onde está na arte, 36 px abaixo (wheelDy 14 linhas)
- vidros: o cenário é inundado a partir de sementes dentro de cada vidro (para-brisa, janela da porta em
  cima e embaixo do retrovisor, vidro do retrovisor); o contorno preto do carro segura. Ilhas escuras do
  cenário são fechadas; acima das palhetas o para-brisa é fechado linha a linha e coluna a coluna
- os limpadores da arte saem (o jogo desenha os dele, na chuva), e o capô vermelho visto por cima do
  painel também (o carro pode ter outra cor): o vidro desce até a borda de cima do painel e do quadro
  (DASH_TOP, medida na arte: a primeira linha do contorno preto)
- retrovisor interno, haste e a base no forro saem (o jogo desenha o dele); a base vira forro
- retrovisor externo esquerdo: inteiro na arte (moldura preta fechada); o vidro dele (a vista desenhada)
  vira o vidro do jogo (glass.at)
- a janela do quadro (os mostradores pintados da arte, com números errados e ponteiros) vira a placa
  cinza lisa do quadro do Savana GLS: por decisão do Victor o Passeio usa o mesmo quadro
  (santana_gauges.py), desenhado pelo jogo por cima, escalado para a janela (passatCluster em cockpit.ts)
- o friso vermelho da coluna (moldura da porta, na cor da lataria) vai para a máscara de pintura; os
  frisos vermelhos do forro da porta são acabamento e ficam
- o emblema da almofada do volante vira o da Ipê (brand_badges.py), num botão escuro redondo
A arte cobre a folga inteira à esquerda (a coluna -102 do painel cai em x 20 da arte): nada construído.
Escala 0,34 (pixel 8:7), como no Savana; volante sem ampliar.
Uso: python3 tools/ref/passat_cockpit2.py <pasta com cab-wheel.png e cab-nowheel.png> <src/assets/cockpit>
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
PIV = (720.0, 500.0)            # ponto da arte sem volante que cai no pivô (128, 104): meio da janela do quadro
PIV_W = (686.0, 536.0)          # centro do aro na arte com volante
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 2, 210
WHEEL_DY = (PIV_W[1] - PIV[1]) / PXH          # o volante desce até onde está na arte
RIM_OUT = (686.0, 536.0, 255.0, 255.0)        # elipse de fora do aro (com o contorno): cx, cy, rx, ry
RIM_IN = (686.0, 538.0, 225.0, 223.0)         # a de dentro (aro um pouco mais grosso em cima)
HUB_Y = 481                                   # borda de cima da almofada (vão do quadro acima dela)
# vãos dos lados e de baixo (arte com volante); o lado de fora de cada um é a elipse de dentro do aro
HOLES = [
    [(440, 494), (528, 494), (552, 500), (566, 520), (568, 606), (556, 616), (522, 624), (440, 638)],
    [(932, 494), (850, 494), (822, 500), (806, 520), (804, 606), (816, 616), (850, 624), (932, 638)],
    [(440, 690), (470, 682), (540, 654), (600, 630), (686, 618), (772, 630), (832, 654), (902, 682), (932, 690), (932, 800), (440, 800)],
]
EMB = (690.0, 556.0, 36, 29)    # emblema da almofada: centro, raio do aro em relevo e do miolo
# vidros medidos na arte sem volante (x, y): borda direita da coluna (o para-brisa começa nela), janela da
# porta (a moldura vermelha entra no alto, a coluna à direita, a borda da porta embaixo) e a caixa do
# retrovisor externo com o braço (sólida; só o vidro dele, inundado a partir da semente, fica transparente)
PILLAR_R = [(342, 62), (331, 95), (334, 125), (338, 155), (345, 200), (352, 240), (360, 270), (368, 300), (375, 330), (383, 368)]
DOOR = [(0, 0), (148, 0), (174, 40), (200, 66), (210, 100), (225, 150), (243, 210), (260, 270), (266, 300), (272, 340),
        (280, 380), (285, 417), (249, 433), (0, 527)]
HOUSING = [(55, 299), (205, 299), (228, 310), (246, 328), (256, 345), (262, 372), (293, 372), (293, 446), (240, 433),
           (60, 432), (44, 423), (39, 405), (39, 318)]
MIRROR_SEED = (140, 365)
MIR_ROWS, MIR_K, MIR_M = (100, 153), 16, 40   # retrovisor no empilhado: linhas, quanto anda e até onde
# borda de cima do painel e do quadro (x, y: a primeira linha do contorno preto)
DASH_TOP = [(383, 368), (400, 372), (465, 372), (469, 362), (471, 348), (474, 337), (479, 328), (487, 321), (500, 317),
            (550, 313), (600, 312), (700, 310), (900, 310), (940, 312), (955, 316), (965, 321), (975, 330), (985, 340),
            (1000, 342), (1100, 340), (1200, 341), (1300, 343), (1400, 348), (1500, 355), (1600, 364), (1660, 370), (1671, 371)]
MOUNT = (1006, 18, 1100, 70)    # base do retrovisor no forro e haste (até o para-brisa)
MOUNT_GAP = 30                  # daqui para baixo, o vão entre os quebra-sóis
WIN = (543, 340, 897, 474)      # janela do quadro (dentro da moldura): vira a placa do quadro do Savana
PLATE = (38, 38, 40)            # cinza da placa (santana_gauges.py, DAY['plate'])
PAINT_X, PAINT_Y = 345, 440     # friso da coluna na cor da lataria: só à esquerda e acima disto


def glass_mask(nw):
    """vidros por geometria medida na arte: o cenário (galhos escuros, muro cinza) não serve para inundar"""
    H, W = nw.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    poly = lambda pts: cv2.fillPoly(np.zeros((H, W), np.uint8), [np.array(pts, np.int32)], 1) > 0
    # para-brisa: da borda do forro (primeira linha de cenário saturado em cada coluna, mediana corrida
    # para pular a haste do retrovisor) até a borda de cima do painel, à direita da coluna
    hsv = cv2.cvtColor(nw, cv2.COLOR_RGB2HSV).astype(int)
    red = nw[..., 0].astype(int) > nw[..., 1].astype(int) + 60
    sat = (hsv[..., 1] > 90) & (hsv[..., 2] > 60) & ~red
    roof = np.full(W, 64.0)
    for x in range(330, W):
        ys = np.nonzero(sat[40:130, x])[0]
        if len(ys):
            roof[x] = 40 + ys[0]
    roof = np.array([np.median(roof[max(330, x - 30):x + 31]) for x in range(W)])
    px, py = zip(*DASH_TOP)
    top = np.interp(np.arange(W), px, py)
    lx, ly = zip(*PILLAR_R)
    left = np.interp(np.arange(H), ly, lx)
    ws = (yy >= roof[xx]) & (yy < top[xx]) & (xx >= left[yy]) & (xx >= px[0] - 12) | \
         (yy >= roof[xx]) & (yy < ly[-1]) & (xx >= left[yy]) & (xx < px[0])
    # janela da porta, menos a caixa do retrovisor e o braço dele (o vidro do retrovisor volta embaixo)
    door = poly(DOOR) & ~poly(HOUSING)
    # vidro do retrovisor externo: a vista desenhada, inundada a partir da semente (a moldura preta segura)
    lum = nw.astype(int).mean(axis=2)
    n, lab = cv2.connectedComponents((lum >= 40).astype(np.uint8), connectivity=4)
    mir = (lab == lab[MIRROR_SEED[1], MIRROR_SEED[0]]) & poly(HOUSING)
    mir = cv2.morphologyEx(mir.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    g = ws | door
    # restos do cenário grudados no contorno (galhos, céu, grama: cores saturadas que não são o friso vermelho)
    scene = sat & ((hsv[..., 0] > 20) & (hsv[..., 0] < 140)) & ~poly(HOUSING)
    for _ in range(12):
        near = cv2.dilate(g.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        g |= near & scene
    # cantos arredondados da caixa do retrovisor: o cenário que sobrou dentro do polígono é janela
    r_, b_ = nw[..., 0].astype(int), nw[..., 2].astype(int)
    blue = (b_ > r_ + 14) & (nw.astype(int).mean(axis=2) > 60) & (np.arange(H)[:, None] > 425)  # asfalto azulado embaixo da caixa
    g |= poly(HOUSING) & ((sat & (hsv[..., 0] > 20) & (hsv[..., 0] < 140)) | blue) & ~(cv2.dilate(mir.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0)
    return g | mir, mir


def clean(nw):
    """borda de cima do painel: o contorno preto (3 linhas) é refeito onde as palhetas encostavam nele"""
    out = nw.copy()
    px, py = zip(*DASH_TOP)
    for x in range(px[0], min(px[-1], nw.shape[1])):
        y0 = int(round(np.interp(x, px, py)))
        seg = out[y0:y0 + 3, x]
        seg[seg.astype(int).mean(axis=1) > 30] = (8, 8, 10)
    # base do retrovisor interno no forro: vira forro. Em cima, a textura do forro 100 colunas à esquerda;
    # embaixo, o vão escuro entre os quebra-sóis continua com o perfil da coluna logo à esquerda da base
    x0, y0, x1, y1 = MOUNT
    out[y0:MOUNT_GAP, x0:x1] = nw[y0:MOUNT_GAP, x0 - 100:x1 - 100]
    out[MOUNT_GAP:y1, x0:x1] = nw[MOUNT_GAP:y1, x0 - 4:x0 - 3]
    return out


def plate(nw):
    """janela do quadro: placa cinza lisa (o quadro do Savana é desenhado por cima, centrado nela)"""
    x0, y0, x1, y1 = WIN
    m = np.zeros(nw.shape[:2], np.uint8)
    cv2.rectangle(m, (x0 + 6, y0), (x1 - 6, y1), 255, -1)
    cv2.rectangle(m, (x0, y0 + 6), (x1, y1 - 6), 255, -1)
    for cx, cy in ((x0 + 6, y0 + 6), (x1 - 6, y0 + 6), (x0 + 6, y1 - 6), (x1 - 6, y1 - 6)):
        cv2.circle(m, (cx, cy), 6, 255, -1)
    nw[m > 0] = PLATE


def red_mask(rgb, al):
    hsv = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    redh = (hue < 18) | (hue > 338)
    core = al & redh & (hsv[..., 1] > 110) & (hsv[..., 2] > 50)
    near = cv2.dilate(core.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    return core | (al & near & redh & (hsv[..., 1] > 40) & (hsv[..., 2] > 28))


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD, piv=PIV):
    xs = piv[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys):
    xi = np.clip(np.floor(xs).astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def main():
    d, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    nw = np.array(Image.open(os.path.join(d, 'cab-nowheel.png')).convert('RGB'))
    ww = np.array(Image.open(os.path.join(d, 'cab-wheel.png')).convert('RGB'))[:, :nw.shape[1]]
    g, mir = glass_mask(nw)
    nw = clean(nw)
    plate(nw)
    A = ~g
    if dbg:
        v = nw.copy()
        v[g] = (0, 255, 0)
        v[mir] = (255, 0, 255)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-alpha.png'))
    y0d = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0d, ROWS)
    d_rgb, d_al = sample(nw, xs, ys), sample(A, xs, ys)
    xs, yt = grid(y0d - EXT * PXH, EXT)
    t_rgb, t_al = sample(nw, xs, yt), sample(A, xs, yt)
    st_al = np.concatenate([t_al, d_al], axis=0)
    st_rgb = np.concatenate([t_rgb, d_rgb], axis=0)
    st_mir = np.concatenate([sample(mir, xs, yt), sample(mir, *grid(y0d, ROWS))], axis=0)
    nat = lambda p: (PIV_N[0] + (p[0] - PIV[0]) * S, (p[1] - y0d) / PXH)
    # farpas de 1 px espetadas no vidro (pontas de galho e de palheta presas ao contorno) saem
    for _ in range(6):
        nb = np.zeros(st_al.shape, int)
        nb[1:] += st_al[:-1]; nb[:-1] += st_al[1:]; nb[:, 1:] += st_al[:, :-1]; nb[:, :-1] += st_al[:, 1:]
        spur = st_al & (nb <= 1)
        spur[[0, -1]] = False; spur[:, [0, -1]] = False
        st_al &= ~spur
    # furinhos de até 12 px (sobras entre as palhetas e nas quinas): fecham com a cor do vizinho; o vidro
    # do retrovisor fica (é pequeno e tem de continuar transparente)
    n, lab, stt, _ = cv2.connectedComponentsWithStats((~st_al).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        if stt[i, cv2.CC_STAT_AREA] <= 12 and not st_mir[lab == i].any():
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
    # retrovisor externo: na tela de celular (932 x 430) só aparece da coluna 14 em diante (empilhado, com
    # PAD) e a moldura esquerda dele fica na coluna 0: como em mirror_complete.py shift, a moldura e o
    # começo do vidro andam MIR_K colunas para dentro (some esse tanto do meio do vidro) e o que sobra
    # à esquerda vira a janela da porta
    ya, yb = MIR_ROWS
    st_rgb[ya:yb + 1, MIR_K:MIR_M + 1] = st_rgb[ya:yb + 1, 0:MIR_M + 1 - MIR_K].copy()
    st_al[ya:yb + 1, MIR_K:MIR_M + 1] = st_al[ya:yb + 1, 0:MIR_M + 1 - MIR_K].copy()
    st_al[ya:yb + 1, :MIR_K] = False
    t_al, d_al = st_al[:EXT], st_al[EXT:]
    t_rgb, d_rgb = st_rgb[:EXT], st_rgb[EXT:]
    # máscara de pintura: o friso vermelho da coluna (moldura da porta); o forro da porta tem frisos
    # vermelhos de acabamento, que não são lataria
    lim = int(PAD + PIV_N[0] + (PAINT_X - PIV[0]) * S)
    dm = red_mask(d_rgb, d_al)
    dm[:, lim:] = False
    dm[max(0, int((PAINT_Y - y0d) / PXH)):] = False
    tm = red_mask(t_rgb, t_al)
    tm[:, lim:] = False
    for name, rgb, a_, m in (('dash', d_rgb, d_al, dm), ('top', t_rgb, t_al, tm)):
        Image.fromarray(np.dstack([rgb, a_.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'br-passat-{name}.png'), optimize=True)
        Image.fromarray((m * 255).astype(np.uint8), 'L').save(os.path.join(out, f'br-passat-{name}-mask.png'), optimize=True)

    # volante (arte com volante)
    Hh, Wh = ww.shape[:2]
    y4, x4 = np.mgrid[0:Hh, 0:Wh]
    ell = lambda e: ((x4 - e[0]) / e[2]) ** 2 + ((y4 - e[1]) / e[3]) ** 2 <= 1
    outer, inner = ell(RIM_OUT), ell(RIM_IN)
    up = (inner & (y4 < HUB_Y)).astype(np.uint8)  # vão do quadro, com as quinas arredondadas como na arte
    holes = cv2.morphologyEx(up, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61)))
    for h in HOLES:
        cv2.fillPoly(holes, [np.array(h, np.int32)], 1)
    wheel = outer & ~(inner & holes.astype(bool))
    if dbg:
        v = ww.copy()
        v[~wheel] = (v[~wheel] * 0.35 + np.array([0, 160, 0]) * 0.65).astype(np.uint8)
        Image.fromarray(v[260:810, 410:960]).resize((1100, 1100), Image.NEAREST).save(os.path.join(dbg, 'wheel-mask.png'))
    xs = PIV_W[0] + (np.arange(256) + 0.5 - PIV_N[0]) * PXW
    ys = PIV_W[1] + (np.arange(WROWS) + 0.5 - (PIV_N[1] + WTOP)) * PXH
    w_rgb, w_al = sample(ww, xs, ys), sample(wheel, xs, ys) & (ys < Hh)[:, None]
    wimg = np.dstack([w_rgb, w_al.astype(np.uint8) * 255])
    hub = (PIV_N[0] + (EMB[0] - PIV_W[0]) * S, PIV_N[1] + WTOP + (EMB[1] - PIV_W[1]) / PXH)
    # no lugar do emblema: o aro em relevo da arte fica e o miolo vira um botão escuro com a logo da Ipê
    yy, xx = np.mgrid[0:WROWS, 0:256]
    e = np.hypot(xx + 0.5 - hub[0], (yy + 0.5 - hub[1]) * (8 / 7))
    ring_r, core_r = EMB[2] * S, EMB[3] * S
    ring = (e <= ring_r) & (e > core_r)
    lum = wimg[..., :3].astype(int).mean(axis=2)
    wimg[ring & (lum > 70) & (yy + 0.5 > hub[1]), :3] = (70, 68, 78)     # metade de baixo do aro, na sombra
    wimg[e <= core_r, :3] = (24, 23, 28)                                   # miolo escuro
    wimg[(e <= core_r) & (e > core_r - 1.1) & (yy + 0.5 < hub[1]), :3] = (12, 12, 15)  # borda de cima, funda
    brand_badges.stamp(wimg, None, 'ipe', (round(hub[0]), round(hub[1]), 13, 0))
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, 'br-passat-wheel.png'), optimize=True)

    r1 = lambda p: tuple(round(float(v), 2) for v in p)
    print('y0d', round(y0d, 1), 'janela do quadro', r1(nat(WIN[:2])), r1(nat(WIN[2:])), 'wheelDy', round(WHEEL_DY, 2))
    print('miolo do volante', r1(hub))
    gl = nat(MIRROR_SEED)
    print('vidro do retrovisor (empilhado, com PAD)', (round(PAD + gl[0]), round(EXT + gl[1])))


if __name__ == '__main__':
    main()
