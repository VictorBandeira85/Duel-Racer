"""Cabine do Corsário GSi (Chevrolet Corsa GSi) a partir das duas artes novas do Victor (com e sem volante,
cenário pelos vidros), no molde da Onça GTB (pumagtb_cockpit.py):
- painel, colunas, forro e portas da arte SEM volante; volante de três raios da arte COM volante (aro pelas
  elipses medidas, raios por polígonos, almofada por círculo; a chave pendurada fica de fora); as duas artes
  estão alinhadas
- vidros: dentro dos polígonos do para-brisa e das janelas, o que é cenário (saturado, céu, nuvem, asfalto)
  vira vidro; forro bege, colunas, frisos pretos e a carcaça vermelha do retrovisor ficam
- retrovisor interno e a haste saem (o jogo desenha o dele): o espelho vira para-brisa, a haste vira forro
- limpadores da arte saem: a faixa deles acima do painel vira vidro
- mostradores: o miolo dos quatro vira fundo preto liso (o aro da arte fica); o quadro (corsa_gauges.py)
  cobre cada um; as luzes-espia vermelhas acesas na arte ficam apagadas (o jogo acende)
- buzina: a gravata vira botão escuro com o emblema da Vanguarda
O volante fica centrado no quadro (x 602): com a escala 0,38 a coluna -102 cai na borda esquerda da arte.
Uso: python3 tools/ref/corsa_cockpit2.py <pasta com cockwheel.png e cockdash.png> <src/assets/cockpit>  (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import brand_badges  # noqa: E402

ID = 'br-corsa'
S = 0.38
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV_X = 602.0
WHEEL_C = (602.0, 497.0)
Y0D = 232.0
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 4, 210
RIM_OUT = (602.0, 496.0, 166.0, 160.0)
RIM_IN = (602.0, 498.0, 141.0, 133.0)
HUB = (600.0, 505.0, 50.0)
SPOKES = [
    [(458, 486), (520, 484), (560, 488), (560, 528), (520, 528), (458, 530)],
    [(1200 - x, y) for x, y in [(458, 486), (520, 484), (560, 488), (560, 528), (520, 528), (458, 530)]],
    [(578, 540), (624, 540), (622, 600), (628, 640), (574, 640), (580, 600)],
]
EMB = (600.0, 505.0, 30.0)
WIND = [(320, 100), (1430, 100), (1330, 352), (400, 362)]
WIN_L = [(0, 40), (215, 80), (262, 140), (310, 260), (334, 345), (336, 412), (0, 470)]
WIN_R = [(1675, 50), (1460, 80), (1410, 160), (1360, 280), (1338, 360), (1345, 400), (1675, 462)]
MIRROR_SEED = (190, 395)
IMIR = (748, 148, 992, 242)          # retrovisor interno (vira vidro)
STALK = (842, 92, 900, 150)          # haste no forro (vira forro de 90 px à esquerda)
WIPER_BAND = (680, 312, 1270, 354)   # faixa dos limpadores (vira vidro)
DIALS = [(563, 425, 45.0), (652, 425, 45.0), (505, 466, 22.0), (716, 466, 22.0)]
FACE = (11, 11, 13)
LAMPBOX = (440, 360, 780, 500)


def poly(shape, pts):
    return cv2.fillPoly(np.zeros(shape, np.uint8), [np.array(pts, np.int32)], 1) > 0


HOUSING_L = [(112, 352), (130, 340), (270, 338), (300, 360), (306, 420), (290, 446), (130, 448), (112, 430)]


def roof_line(nw, scene):
    """borda de baixo do forro sobre o para-brisa: primeira linha de cenário (céu) em cada coluna, alisada"""
    W = nw.shape[1]
    r = np.full(W, 125.0)
    for x in range(330, 1420):
        ys = np.nonzero(scene[95:200, x])[0]
        if len(ys):
            r[x] = 95 + ys[0]
    r = np.array([np.median(r[max(0, x - 30):x + 31]) for x in range(W)])
    return r


def dash_line(nw, scene):
    """borda de cima do painel: em cada coluna, a primeira linha escura (4 seguidas) abaixo da faixa dos
    limpadores; alisada"""
    W = nw.shape[1]
    lum = nw.astype(int).mean(axis=2)
    d = np.full(W, 356.0)
    for x in range(380, 1350):
        y0 = 356 if WIPER_BAND[0] <= x < WIPER_BAND[2] else 300
        col = (lum[y0:420, x] < 55) & ~scene[y0:420, x]
        for k in range(len(col) - 4):
            if col[k:k + 4].all():
                d[x] = y0 + k
                break
    return np.array([np.median(d[max(0, x - 15):x + 16]) for x in range(W)])


def glass_mask(nw):
    H, W = nw.shape[:2]
    a = nw.astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = a.mean(axis=2)
    hsv = cv2.cvtColor(nw, cv2.COLOR_RGB2HSV).astype(int)
    red = (r > g + 60) & (r > 90)
    beige = (r > b + 8) & (hsv[..., 1] < 110) & (lum > 70)          # forro e colunas
    hue_ok = (hsv[..., 0] >= 30) & (hsv[..., 0] <= 130)              # verde e azul (mato escuro também)
    scene = (((hsv[..., 1] > 50) & (hsv[..., 2] > 22) & hue_ok) | ((lum > 80) & (b >= r - 6))) & ~red & ~beige
    yy, xx = np.mgrid[0:H, 0:W]
    roof, dash = roof_line(nw, scene), dash_line(nw, scene)
    wind = poly((H, W), WIND) & (yy >= roof[xx]) & (yy < dash[xx])
    sat = hsv[..., 1]
    road = (lum > 45) & (sat < 60) & (b >= r - 10)                   # asfalto e acostamento cinzentos
    shoulder = (r > b + 20) & (lum > 80) & (xx < 335) & (yy > 300) & (yy < 372)   # areia da beira da estrada                       # areia da beira da estrada, na janela
    side = (poly((H, W), WIN_L) | poly((H, W), WIN_R)) & (scene | road | shoulder) & ~red
    side = cv2.morphologyEx(side.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    side &= poly((H, W), WIN_L) | poly((H, W), WIN_R)
    house = poly((H, W), HOUSING_L)
    frame = house & (red | (lum < 60))      # carcaça: só a moldura vermelha e o contorno escuro ficam
    frame = cv2.morphologyEx(frame.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    side &= ~frame
    # a vista da estrada do jogo acaba na linha do painel (y 343 da arte, a altura do topo do retrovisor): abaixo dela a janela fica com a
    # estrada da própria arte (senão aparece o fundo cinza do jogo)
    side &= yy < 343
    gl = wind | side
    # vidro do retrovisor externo: o cenário dentro da moldura vermelha
    n, lab = cv2.connectedComponents((scene & house & ~cv2.dilate(red.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)).astype(np.uint8), connectivity=4)
    mir = lab == lab[MIRROR_SEED[1], MIRROR_SEED[0]]
    ys, xs = np.nonzero(mir)
    hull = cv2.convexHull(np.stack([xs, ys], 1).astype(np.int32))
    mir = cv2.fillPoly(np.zeros((H, W), np.uint8), [hull], 1) > 0
    gl |= mir
    # ilhas opacas pequenas dentro das janelas (mato escuro, poste) somem
    reg = poly((H, W), WIN_L) | poly((H, W), WIN_R)
    n, lab, st, _ = cv2.connectedComponentsWithStats((reg & ~gl & ~frame).astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 400:
            gl[lab == i] = True
    halo = np.zeros((H, W), bool)
    return gl, mir, halo


def clean(nw):
    out = nw.copy()
    H, W = nw.shape[:2]
    x0, y0, x1, y1 = STALK
    out[y0:y1, x0:x1] = nw[y0:y1, x0 - 90:x1 - 90]
    yy, xx = np.mgrid[0:H, 0:W]
    for cx, cy, r in DIALS:
        out[np.hypot(xx - cx, yy - cy) <= r + 0.5] = FACE
    x0, y0, x1, y1 = LAMPBOX
    reg = out[y0:y1, x0:x1].astype(int)
    lit = (reg[..., 0] > reg[..., 1] + 22) & (reg[..., 0] > 48)     # luzes-espia vermelhas acesas da arte
    lit = cv2.dilate(lit.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    reg[lit] = np.array([30, 26, 30])
    out[y0:y1, x0:x1] = reg.astype(np.uint8)
    return out


def red_mask(rgb, al):
    hsv = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    redh = (hue < 18) | (hue > 338)
    core = al & redh & (hsv[..., 1] > 110) & (hsv[..., 2] > 50)
    near = cv2.dilate(core.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    # reflexos claros da lataria (riscos brancos dos para-lamas) e bordas escuras da cor do carro
    light = al & near & (hsv[..., 1] < 70) & (hsv[..., 2] > 150)
    orange = al & near & (hue >= 18) & (hue < 34) & (hsv[..., 1] > 110)   # pontinhos alaranjados do brilho da lataria
    return core | (al & near & redh & (hsv[..., 1] > 40) & (hsv[..., 2] > 28)) | light | orange


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
    ell = lambda e: ((x4 - e[0]) / e[2]) ** 2 + ((y4 - e[1]) / e[3]) ** 2 <= 1
    outer, inner = ell(RIM_OUT), ell(RIM_IN)
    sp = np.zeros((H, W), np.uint8)
    for p in SPOKES:
        cv2.fillPoly(sp, [np.array(p, np.int32)], 1)
    hub = np.hypot(x4 - HUB[0], y4 - HUB[1]) <= HUB[2] - 3
    return outer & (~inner | (sp > 0) | hub)


def main():
    d, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    nw = np.array(Image.open(os.path.join(d, 'cockdash.png')).convert('RGB'))
    ww = np.array(Image.open(os.path.join(d, 'cockwheel.png')).convert('RGB'))
    g, mir, halo = glass_mask(nw)
    nw = clean(nw)
    hl = nw[halo].astype(int)
    nw[halo] = np.where(hl.mean(axis=1, keepdims=True) < 40, hl, np.array([16, 9, 11])).astype(np.uint8)
    A = ~g
    if dbg:
        v = nw.copy()
        v[g] = (0, 255, 0)
        v[mir] = (255, 0, 255)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-alpha.png'))
        v = nw.copy()
        v[~A] = (0, 255, 0)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-alpha2.png'))
    xs, ys = grid(Y0D, ROWS)
    d_rgb, d_al = sample(nw, xs, ys), sample(A, xs, ys)
    xs, yt = grid(Y0D - EXT * PXH, EXT)
    t_rgb, t_al = sample(nw, xs, yt), sample(A, xs, yt)
    st_al = np.concatenate([t_al, d_al], axis=0)
    st_rgb = np.concatenate([t_rgb, d_rgb], axis=0)
    st_mir = np.concatenate([sample(mir, xs, yt), sample(mir, *grid(Y0D, ROWS))], axis=0)
    nat = lambda p: (PIV_N[0] + (p[0] - PIV_X) * S, (p[1] - Y0D) / PXH)
    # farpas de 1 px espetadas no vidro saem
    for _ in range(6):
        nb = np.zeros(st_al.shape, int)
        nb[1:] += st_al[:-1]; nb[:-1] += st_al[1:]; nb[:, 1:] += st_al[:, :-1]; nb[:, :-1] += st_al[:, 1:]
        spur = st_al & (nb <= 1)
        spur[[0, -1]] = False; spur[:, [0, -1]] = False
        st_al &= ~spur
    # furinhos de até 12 px: fecham com a cor do vizinho; o vidro do retrovisor fica
    n, lab, stt, _ = cv2.connectedComponentsWithStats((~st_al).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        if stt[i, cv2.CC_STAT_AREA] <= 12 and not st_mir[lab == i].any():
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
        m = red_mask(rgb, a_)
        Image.fromarray(np.dstack([rgb, a_.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'{ID}-{name}.png'), optimize=True)
        Image.fromarray((m * 255).astype(np.uint8), 'L').save(os.path.join(out, f'{ID}-{name}-mask.png'), optimize=True)
        print(name, 'máscara de pintura', int(m.sum()))

    # volante (arte com volante)
    wheel = wheel_mask(ww)
    if dbg:
        v = ww.copy()
        v[~wheel] = (v[~wheel] * 0.35 + np.array([0, 160, 0]) * 0.65).astype(np.uint8)
        Image.fromarray(v[230:760, 470:1000]).resize((1060, 1060), Image.NEAREST).save(os.path.join(dbg, 'wheel-mask.png'))
    wart = ww.copy()
    # "momo" (marca real) está escrito no raio direito: o raio direito vira o esquerdo refletido (o volante
    # é simétrico; o rasgo e o bloco da emenda com o aro são iguais dos dois lados)
    rm = np.zeros(ww.shape[:2], np.uint8)
    cv2.fillPoly(rm, [np.array(SPOKES[1], np.int32)], 1)
    ys_, xs_ = np.nonzero(rm)
    pass
    xs = WHEEL_C[0] + (np.arange(256) + 0.5 - PIV_N[0]) * PXW
    ys = WHEEL_C[1] + (np.arange(WROWS) + 0.5 - (PIV_N[1] + WTOP)) * PXH
    w_rgb, w_al = sample(wart, xs, ys), sample(wheel, xs, ys) & (ys < ww.shape[0])[:, None]
    wimg = np.dstack([w_rgb, w_al.astype(np.uint8) * 255])
    hub = (PIV_N[0] + (EMB[0] - WHEEL_C[0]) * S, PIV_N[1] + WTOP + (EMB[1] - WHEEL_C[1]) / PXH)
    # buzina: o logotipo da arte sai; botão preto liso com aro fino e a logo da Onça no meio
    yy, xx = np.mgrid[0:WROWS, 0:256]
    e = np.hypot(xx + 0.5 - hub[0], (yy + 0.5 - hub[1]) * (8 / 7))
    core_r = EMB[2] * S
    wimg[e <= core_r, :3] = (20, 19, 23)
    wimg[(e <= core_r) & (e > core_r - 1.1), :3] = (58, 57, 64)
    wimg[(e <= core_r) & (e > core_r - 1.1) & (yy + 0.5 > hub[1]), :3] = (10, 10, 12)
    brand_badges.stamp(wimg, None, 'vanguarda', (round(hub[0]), round(hub[1]), 9, 0))
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, f'{ID}-wheel.png'), optimize=True)

    r1 = lambda p: tuple(round(float(v), 2) for v in p)
    print('topo começa na linha da arte', round(Y0D - EXT * PXH, 1))
    wr = (WHEEL_C[1] - Y0D) / PXH
    print('centro do aro na linha', round(wr, 2), 'do painel; wheelDy (painel esticado 128/124)', round(wr * 128 / 124 - PIV_N[1], 2))
    for cx, cy, r in DIALS:
        print('mostrador', r1(nat((cx, cy))), 'raio do miolo', round(r * S, 2))
    print('miolo do volante', r1(hub))
    gl = nat((195, 395))
    print('vidro do retrovisor (empilhado, com PAD)', (round(PAD + gl[0]), round(EXT + gl[1])))


if __name__ == '__main__':
    main()
