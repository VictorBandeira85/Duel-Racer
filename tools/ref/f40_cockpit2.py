"""Cabine da Fúria F4 (Ferrari F40) a partir das duas artes novas do Victor (com e sem volante, com cenário
pelos vidros; segunda versão, mais fiel ao carro), no molde de passat_cockpit2.py, mantendo o quadro
Veglia de antes (f40_gauges.py: faces f40-cluster e f40-console, luz verde à noite):
- escala 0,28 (pixel 8:7): a arte inteira (1672 px) cobre as 460 colunas empilhadas sem esticar nada
  (x 0 da arte cai na coluna 0); o centro do aro (790, 612) cai no pivô (119,2; 120): o volante fica
  à esquerda do meio, como na arte, e a linha 0 da arte cai no alto do teto empilhado
- painel, colunas, porta, retrovisores, console e pedais da arte sem volante; volante da arte com volante
  (as duas estão alinhadas): aro por duas elipses medidas, raios, placa e raio de baixo por polígonos
- vidros: para-brisa por geometria (borda do forro pela inundação do céu, coluna e borda de cima do
  painel medidas); limpador e retrovisor interno ficam dentro e somem (o jogo desenha os dele) e a base
  do retrovisor interno no forro vira forro. Janelas da porta (o triângulo entre a coluna e a moldura,
  o vidro à esquerda da moldura e o vão embaixo do retrovisor) por inundação a partir de sementes (o
  contorno preto segura), com as ilhas escuras do cenário fechadas
- retrovisor externo: a arte o corta na borda esquerda (sem a moldura esquerda). Como em
  mirror_complete.py flip, a moldura direita (do começo da curva dos cantos até a borda de fora) é
  refletida e vira a moldura esquerda com a borda de fora na coluna MIR_X0 (no celular, 932 x 430, a
  tela começa na coluna 18); o vidro entre as duas continua o da arte (transparente: glass.at); à esquerda
  da moldura nova vira janela, menos a barra escura da moldura da porta
- quadro: o miolo preto do capuz é limpo (mostradores, números, ponteiros e luzes pintados da arte saem)
  e o jogo desenha por cima a face de antes (f40-cluster) a 0,72, centrada entre os dois mostradores da
  arte, com o alto no alto do miolo; nos três relógios do console da arte fica o aro preto e o mostrador
  de dentro vira fundo preto: o jogo desenha os de antes (f40-console) a 0,7765, no passo dos da arte
- máscara de pintura: porta, retrovisor e braço (tudo que é vermelho à esquerda da coluna), os dois
  painéis vermelhos com saída de ar e a faixa vermelha entre eles no alto do painel; bancos ficam fora
- o cavalinho do miolo do volante vira o escudo da Fúria (brand_badges.py) num botão escuro
Uso: python3 tools/ref/f40_cockpit2.py <pasta com cab-wheel.png e cab-nowheel.png> <src/assets/cockpit>
     (DBG=<pasta> grava as máscaras para conferência)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import brand_badges  # noqa: E402

S = 0.28
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV = (790.0, 612.0)            # centro do aro (as duas artes estão alinhadas)
PIV_N = (790.0 * S - 102.0, 120.0)  # x 0 da arte na coluna 0 do empilhado
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 0, 212
RIM_OUT = (790.0, 612.0, 281.0, 276.0)
RIM_IN = (790.0, 610.0, 246.0, 243.0)
SPOKES = [
    [(505, 578), (662, 578), (662, 642), (505, 642)],
    [(923, 578), (1078, 578), (1078, 642), (923, 642)],
    [(655, 575), (700, 567), (760, 560), (793, 557), (830, 560), (885, 567), (932, 575), (932, 640),
     (902, 648), (872, 662), (847, 682), (832, 705), (826, 730), (828, 880), (758, 880), (762, 730),
     (757, 705), (742, 682), (715, 662), (685, 648), (655, 640)],
]
EMB = (792.5, 622.5, 42)        # cavalinho: centro e raio (com o aro preto)
# borda de cima do painel (primeira linha do contorno preto) e coluna (borda do para-brisa)
DASH_TOP = [(300, 392), (310, 388), (350, 370), (400, 357), (450, 350), (500, 347), (600, 347), (650, 350),
            (690, 352), (720, 344), (900, 344), (930, 348), (955, 356), (1390, 356), (1400, 357), (1425, 346),
            (1450, 342), (1500, 339), (1550, 340), (1600, 344), (1672, 348)]
PILLAR = [(286, 0), (284, 100), (288, 200), (298, 300), (306, 350), (312, 392)]
SKY_SEED = (700, 60)
STALK = (1190, 1305)            # colunas da haste do retrovisor interno (o forro é interpolado)
WIN_SEEDS = [(112, 120), (95, 170), (100, 230), (100, 265), (150, 280), (15, 150), (20, 250), (100, 470), (40, 470)]  # janelas da porta
TRI = [(115, 50), (122, 100), (153, 200), (178, 290), (52, 290), (63, 250), (75, 200), (98, 100)]  # triângulo da porta (por dentro dos contornos)
FAR = [(0, 0), (70, 0), (48, 100), (26, 200), (5, 300), (0, 300)]  # vidro à esquerda da moldura da porta
MIR_SEED = (100, 370)           # vidro do retrovisor externo
MIR_GLASS = (25, 322, 171, 427, 12)  # o vidro (cantos redondos), medido
OLD_MIR_AT = (100, 7)           # canto do recorte (linha, coluna do empilhado): moldura esquerda na col 19, a de baixo encostando no canto da coluna com a porta
MIR_FRONT = os.environ.get('MIR_BEHIND') is None  # o retrovisor inteiro na frente da parte de baixo da coluna
MIR_MAX_COL = 100                # não passa daqui (à direita da coluna é o para-brisa)
WS_PROBE = (200, 60)            # um ponto do para-brisa (col, linha)
MIR_ERASE_TOP = 288             # o retrovisor da arte nova começa aqui (arte)
MIR_TOP_SEED = (100, 306)       # um ponto da moldura de cima do retrovisor da arte nova
PILLAR_EDGE = [(190, 290), (196, 340), (202, 400), (207, 450), (211, 495)]  # borda esquerda da coluna (arte)
MIR_ROWS = (95, 143)            # retrovisor no empilhado (do contorno de cima ao de baixo)
MIR_FRAME_B = 141               # última linha vermelha da moldura de baixo (abaixo é o braço)
MIR_A, MIR_R = 44, 52           # moldura direita: do começo da curva dos cantos (a) à borda de fora (R)
MIR_X0 = 20                     # borda de fora da moldura nova (no celular a tela começa na coluna 18)
BAR = [(52, 280), (45, 300), (32, 375), (18, 450), (10, 470), (4, 520)]  # borda direita da barra escura da moldura da porta (arte)
# miolo preto do capuz do quadro e os relógios do console
HOOD = [(600, 428), (630, 418), (975, 418), (1000, 428), (1015, 440), (1030, 470), (1040, 500), (1040, 565),
        (1032, 581), (568, 581), (558, 568), (555, 500), (565, 470), (585, 440)]
CONSOLE = [(1152, 518), (1246, 518), (1340, 520)]
CONSOLE_R = 33
# máscara de pintura: vermelho à esquerda da coluna, os dois painéis com saída de ar e a faixa entre eles
PAINT_X = 305
REDTOP = [[(305, 330), (700, 330), (700, 420), (305, 420)], [(955, 345), (1672, 320), (1672, 410), (955, 392)]]


def poly(shape, pts):
    return cv2.fillPoly(np.zeros(shape, np.uint8), [np.array(pts, np.int32)], 1) > 0


def flood(lum, seeds, thr=45):
    n, lab = cv2.connectedComponents((lum >= thr).astype(np.uint8), connectivity=4)
    out = np.zeros(lum.shape, bool)
    for x, y in seeds:
        if lab[y, x]:
            out |= lab == lab[y, x]
    return out


def fill_islands(m, limit):
    """buracos (ilhas escuras do cenário) fechados por dentro de m, até limit px, entram em m"""
    n, lab, st, _ = cv2.connectedComponentsWithStats((~m).astype(np.uint8), connectivity=4)
    H, W = m.shape
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a <= limit and x > 0 and y > 0 and x + w < W and y + h < H:
            m |= lab == i
    return m


def glass_mask(nw):
    H, W = nw.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    lum = nw.astype(int).mean(axis=2)
    sky = flood(lum, [SKY_SEED])
    roof = np.full(W, np.nan)
    for x in range(280, W):
        ys = np.nonzero(sky[:200, x])[0]
        if len(ys):
            roof[x] = ys[0]
    roof[STALK[0]:STALK[1]] = np.nan
    ok = ~np.isnan(roof)
    xs = np.arange(W)
    roof = np.interp(xs, xs[ok], roof[ok])
    px, py = zip(*DASH_TOP)
    top = np.interp(xs, px, py)
    lx, ly = zip(*PILLAR)
    left = np.interp(np.arange(H), ly, lx)
    ws = (yy >= roof[xx]) & (yy < top[xx]) & (xx >= left[yy])
    win = flood(lum, WIN_SEEDS) & (xx < 330)
    win = fill_islands(win, 3000) | poly((H, W), TRI) | poly((H, W), FAR)
    x0, y0, x1, y1, r = MIR_GLASS
    mm = np.zeros((H, W), np.uint8)
    cv2.rectangle(mm, (x0, y0 + r), (x1, y1 - r), 1, -1)
    cv2.rectangle(mm, (x0, y0), (x1 - r, y1), 1, -1)
    for cx, cy in ((x1 - r, y0 + r), (x1 - r, y1 - r)):
        cv2.circle(mm, (cx, cy), r, 1, -1)
    mir = mm > 0
    g = ws | win | mir
    # restos do cenário grudados nos contornos (galhos, céu, grama, cerca): cores saturadas que não são
    # o vermelho da lataria, encostadas no vidro, à esquerda do painel
    hsv = cv2.cvtColor(nw, cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    scene = (hsv[..., 1] > 70) & (hsv[..., 2] > 50) & (hue > 25) & (hue < 260) & (yy < top[xx] + 2) & (xx < 340)
    for _ in range(12):
        g |= (cv2.dilate(g.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & scene
    return g, mir, roof


def erase_mirror(nw, g):
    """o retrovisor da arte nova (carcaça, vidro, braço e pé) sai: o que fica à esquerda da borda da coluna
    vira janela; o que o braço cobria da borda da coluna vira o contorno preto dela"""
    H, W = nw.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    # tudo entre a barra escura da moldura da porta, a borda da coluna, o alto do retrovisor e a soleira
    sill = np.interp(xx, [0, 150, 260, 400], [512, 498, 486, 470])
    bx, by = zip(*BAR)
    bar = np.interp(yy, by, bx)
    er = (yy > MIR_ERASE_TOP) & (yy < sill - 2) & (xx > bar + 1) & (xx < 260)
    px, py = zip(*PILLAR_EDGE)
    edge = np.interp(yy, py, px)
    out = nw.copy()
    win = er & (xx < edge)
    rim = er & (xx >= edge) & (xx < edge + 9)
    out[rim] = (14, 13, 17)
    g = (g | win) & ~rim
    return out, g


def mir_glass(H, W):
    x0, y0, x1, y1, r = MIR_GLASS
    mm = np.zeros((H, W), np.uint8)
    cv2.rectangle(mm, (x0, y0 + r), (x1, y1 - r), 1, -1)
    cv2.rectangle(mm, (x0, y0), (x1 - r, y1), 1, -1)
    for cx, cy in ((x1 - r, y0 + r), (x1 - r, y1 - r)):
        cv2.circle(mm, (cx, cy), r, 1, -1)
    return mm > 0


def clean(nw, roof):
    out = nw.copy()
    x0, x1 = STALK
    for x in range(x0, x1):
        y1 = int(np.ceil(roof[x])) + 2
        out[:y1, x] = nw[:y1, x - 80]
    H, W = nw.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    # miolo do capuz: preto liso (a face do quadro é desenhada por cima)
    hood = poly((H, W), HOOD)
    inner = cv2.erode(hood.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0
    lum = nw.astype(int).mean(axis=2)
    col = np.median(nw[inner & (lum < 30)], axis=0)
    out[hood] = col
    for cx, cy in CONSOLE:  # o aro preto da arte fica; o mostrador de dentro vira fundo preto
        d = np.hypot(xx - cx, yy - cy)
        face = d <= CONSOLE_R
        out[face] = np.median(nw[face & (lum < 30)], axis=0)
    return out


def red_mask(rgb, al):
    hsv = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    redh = (hue < 18) | (hue > 338)
    core = al & redh & (hsv[..., 1] > 110) & (hsv[..., 2] > 50)
    near = cv2.dilate(core.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    return core | (al & near & redh & (hsv[..., 1] > 40) & (hsv[..., 2] > 28))


def grid(y0, rows, cols=256 + 2 * PAD):
    xs = PIV[0] + (np.arange(cols) - PAD + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys):
    xi = np.clip(np.floor(xs).astype(int), 0, img.shape[1] - 1)
    yi = np.clip(np.floor(ys).astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def main():
    d, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    nw = np.array(Image.open(os.path.join(d, 'cab-nowheel.png')).convert('RGB'))
    ww = np.array(Image.open(os.path.join(d, 'cab-wheel.png')).convert('RGB'))
    g, mir, roof = glass_mask(nw)
    nw = clean(nw, roof)
    nw, g = erase_mirror(nw, g)
    A = ~g
    H, W = nw.shape[:2]
    paint_zone = np.zeros((H, W), bool)
    paint_zone[:, :PAINT_X] = True
    for v in REDTOP:
        paint_zone |= poly((H, W), v)
    if dbg:
        v = nw.copy()
        v[g] = (0, 255, 0)
        v[mir] = (255, 0, 255)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-alpha.png'))
    y0d = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0d, ROWS)
    _, yt = grid(y0d - EXT * PXH, EXT)
    st_rgb = np.concatenate([sample(nw, xs, yt), sample(nw, xs, ys)], axis=0)
    st_al = np.concatenate([sample(A, xs, yt), sample(A, xs, ys)], axis=0)
    st_mir = np.concatenate([sample(mir, xs, yt), sample(mir, xs, ys)], axis=0)
    st_pz = np.concatenate([sample(paint_zone, xs, yt), sample(paint_zone, xs, ys)], axis=0)
    for _ in range(6):  # farpas de 1 px espetadas no vidro
        nb = np.zeros(st_al.shape, int)
        nb[1:] += st_al[:-1]; nb[:-1] += st_al[1:]; nb[:, 1:] += st_al[:, :-1]; nb[:, :-1] += st_al[:, 1:]
        spur = st_al & (nb <= 1)
        spur[[0, -1]] = False; spur[:, [0, -1]] = False
        st_al &= ~spur
    n, lab, stt, _ = cv2.connectedComponentsWithStats((~st_al).astype(np.uint8), connectivity=4)
    for i in range(1, n):  # furinhos de até 12 px fecham com a cor do vizinho (o vidro do retrovisor fica)
        if stt[i, cv2.CC_STAT_AREA] <= 12 and not st_mir[lab == i].any():
            for y, x in zip(*np.nonzero(lab == i)):
                nb = [(yy_, xx_) for yy_ in range(y - 1, y + 2) for xx_ in range(x - 1, x + 2)
                      if 0 <= yy_ < st_al.shape[0] and 0 <= xx_ < st_al.shape[1] and st_al[yy_, xx_]]
                if nb:
                    st_rgb[y, x] = np.median([st_rgb[q] for q in nb], axis=0)
            st_al[lab == i] = True
    n, lab, stt, _ = cv2.connectedComponentsWithStats(st_al.astype(np.uint8), connectivity=8)
    for i in range(1, n):  # ilhas opacas soltas no vidro (até 40 px)
        if stt[i, cv2.CC_STAT_AREA] <= 40:
            st_al[lab == i] = False
    # retrovisor externo: o da cabine anterior (arte ca1dd71f, v0.53.7), na mesma escala, recortado em
    # f40_old_mirror.png (alfa 255 = peça, 1 = vidro); colado só sobre a janela da porta (a coluna e a porta
    # ficam na frente dele, como no carro: ele é preso por fora, atrás da coluna)
    om = np.array(Image.open(os.path.join(os.path.dirname(__file__), 'f40_old_mirror.png')).convert('RGBA'))
    n, lab = cv2.connectedComponents((~st_al).astype(np.uint8), connectivity=4)
    winreg = (lab > 0) & (lab != lab[WS_PROBE[1], WS_PROBE[0]])   # janelas da porta (não o para-brisa)
    oy, ox = OLD_MIR_AT
    for j in range(om.shape[0]):
        for i in range(om.shape[1]):
            y, x = oy + j, ox + i
            if om[j, i, 3] == 0 or not (0 <= y < st_al.shape[0] and 0 <= x < MIR_MAX_COL):
                continue
            if not (MIR_FRONT or winreg[y, x]):
                continue
            if om[j, i, 3] == 255:
                st_rgb[y, x], st_al[y, x], st_pz[y, x] = om[j, i, :3], True, True
            else:  # vidro
                st_al[y, x], st_pz[y, x] = False, False
    # máscara de pintura: só o vermelho da peça colada (o contorno escuro não)
    pm = red_mask(st_rgb, st_al) & st_pz
    for name, sl in (('top', slice(0, EXT)), ('dash', slice(EXT, None))):
        Image.fromarray(np.dstack([st_rgb[sl], st_al[sl].astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'f40-{name}.png'), optimize=True)
        Image.fromarray((pm[sl] * 255).astype(np.uint8), 'L').save(os.path.join(out, f'f40-{name}-mask.png'), optimize=True)
    if dbg:
        v = np.dstack([st_rgb, st_al.astype(np.uint8) * 255])
        bg = Image.new('RGBA', (v.shape[1], v.shape[0]), (0, 160, 255, 255))
        bg.alpha_composite(Image.fromarray(v, 'RGBA'))
        bg.resize((v.shape[1] * 3, v.shape[0] * 3), Image.NEAREST).save(os.path.join(dbg, 'stacked.png'))

    # volante (arte com volante)
    Hh, Wh = ww.shape[:2]
    y4, x4 = np.mgrid[0:Hh, 0:Wh]
    ell = lambda e: ((x4 - e[0]) / e[2]) ** 2 + ((y4 - e[1]) / e[3]) ** 2 <= 1
    wheel = ell(RIM_OUT) & ~ell(RIM_IN)
    for p in SPOKES:
        wheel |= poly((Hh, Wh), p) & ell(RIM_OUT)
    if dbg:
        v = ww.copy()
        v[~wheel] = (v[~wheel] * 0.35 + np.array([0, 160, 0]) * 0.65).astype(np.uint8)
        Image.fromarray(v[300:920, 480:1100]).save(os.path.join(dbg, 'wheel-mask.png'))
    wx = PIV[0] + (np.arange(256) + 0.5 - PIV_N[0]) * PXW
    wy = PIV[1] + (np.arange(WROWS) + 0.5 - (PIV_N[1] + WTOP)) * PXH
    w_rgb, w_al = sample(ww, wx, wy), sample(wheel, wx, wy) & ((wy >= 0) & (wy < Hh))[:, None]
    wimg = np.dstack([w_rgb, w_al.astype(np.uint8) * 255])
    hub = (PIV_N[0] + (EMB[0] - PIV[0]) * S, PIV_N[1] + WTOP + (EMB[1] - PIV[1]) / PXH)
    yy, xx = np.mgrid[0:WROWS, 0:256]
    e = np.hypot(xx + 0.5 - hub[0], (yy + 0.5 - hub[1]) * (8 / 7))
    R = EMB[2] * S
    wimg[(e <= R - 0.2) & (e > R - 1.3), :3] = (14, 13, 18)                    # aro do botão
    wimg[e <= R - 1.3, :3] = (30, 28, 36)                                     # botão escuro
    wimg[(e <= R - 1.3) & (e > R - 2.3) & (yy + 0.5 < hub[1]), :3] = (48, 46, 58)  # luz em cima
    brand_badges.stamp(wimg, None, 'furia', (round(hub[0]), round(hub[1]), 14, 0))
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, 'f40-wheel.png'), optimize=True)

    nat = lambda p: (PIV_N[0] + (p[0] - PIV[0]) * S, PIV_N[1] + (p[1] - PIV[1]) / PXH)
    r2 = lambda p: tuple(round(float(v), 2) for v in p)
    print('pivô', r2(PIV_N), 'y0d', round(y0d, 1), 'miolo do volante', r2(hub))
    print('mostradores da arte', [r2(nat(p)) for p in ((700, 512), (902, 512))], 'alto do miolo', r2(nat((801, 421))))
    print('console', [r2(nat(p)) for p in CONSOLE], 'passo', round((CONSOLE[2][0] - CONSOLE[0][0]) / 2 * S, 2))
    print('vidro do retrovisor (empilhado): coluna', (MIR_X0 + MIR_A) // 2, 'linha', round(EXT + nat(MIR_SEED)[1]))


if __name__ == '__main__':
    main()
