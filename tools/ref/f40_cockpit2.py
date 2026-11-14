"""Cabine da Fúria F4 (Ferrari F40) a partir das duas artes novas do Victor (com e sem volante, com cenário
pelos vidros), no molde de passat_cockpit2.py, mantendo o quadro Veglia de hoje (f40_gauges.py: faces
f40-cluster e o console reespaçado aqui, luz verde à noite):
- escala 0,28 (pixel 8:7): a arte inteira (1672 px) cabe na largura empilhada (460 colunas); o centro do
  aro (819, 545,5 da arte sem volante) cai no pivô (128, 99) e a linha 0 do teto cai no alto da arte
- painel, colunas, porta e retrovisores da arte sem volante; volante da arte com volante (1 px mais
  baixa): aro por duas elipses medidas, raios e placa do miolo por polígonos medidos
- vidros por geometria medida: para-brisa entre a borda do forro (inundação a partir do céu, a haste do
  retrovisor interno interpolada), a coluna e a borda de cima do painel (DASH_TOP); a palheta do
  limpador e o retrovisor interno ficam dentro e somem (o jogo desenha os dele); a base do retrovisor
  interno no forro vira forro. Janela da porta por polígono, menos a carcaça e o braço do retrovisor
  externo; o vidro dele (retângulo de cantos redondos) fica transparente (glass.at)
- retrovisor externo: no celular (932 x 430) só aparece da coluna 18 em diante; como em
  passat_cockpit2.py a moldura esquerda e o começo do vidro andam MIR_K colunas para dentro
- quadro: o desenho da arte fica embaixo das faces de hoje (f40-cluster a 0,8 do tamanho, centrada nos
  dois mostradores da arte, que ela cobre inteiros); os três relógios do console da arte são apagados
  (vira o fundo da caixa) e o jogo desenha os três de hoje no lugar (f40-console a 0,7165: o passo
  dos relógios fica o da arte)
- máscara de pintura: moldura vermelha da janela, carcaça e braço do retrovisor, porta e os dois
  painéis vermelhos com saída de ar em cima do painel; estofado vermelho (banco) fica fora (nem entra)
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
PIV = (819.0, 545.5)            # centro do aro na arte sem volante (a com volante é 1 px mais baixa)
PIV_W = (819.0, 546.5)          # centro do aro na arte com volante
PIV_N = (128.0, 99.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 2, 200
RIM_OUT = (819.0, 546.5, 276.0, 258.0)
RIM_IN = (819.0, 547.0, 219.0, 201.0)
# raios e placa do miolo (arte com volante)
SPOKES = [
    [(594, 520), (717, 520), (717, 577), (594, 577)],
    [(944, 518), (1046, 518), (1046, 578), (944, 578)],
    [(712, 524), (949, 524), (949, 579), (925, 583), (900, 589), (880, 598), (867, 611), (861, 628), (861, 762),
     (804, 762), (804, 628), (798, 611), (786, 599), (765, 591), (740, 585), (712, 580)],
]
EMB = (833.0, 567.0, 41)        # cavalinho: centro e raio (com o aro preto)
# borda de cima do painel (primeira linha do contorno preto) e coluna (borda do para-brisa)
DASH_TOP = [(455, 353), (470, 350), (500, 345), (530, 336), (560, 330), (600, 327), (650, 325), (700, 320),
            (750, 317), (800, 316), (900, 316), (925, 320), (945, 328), (965, 338), (985, 346), (1000, 347),
            (1405, 347), (1415, 343), (1430, 336), (1450, 330), (1500, 327), (1600, 325), (1672, 322)]
PILLAR = [(432, 0), (432, 100), (436, 150), (444, 200), (450, 250), (457, 300), (466, 350), (466, 360)]
SKY_SEED = (700, 60)
STALK = (1212, 1302)            # colunas da haste do retrovisor interno (o forro é interpolado)
# janela da porta (até o contorno preto da moldura e da coluna) e o retrovisor externo
DOOR = [(0, 8), (50, 24), (100, 37), (150, 52), (185, 72), (210, 92), (230, 122), (250, 157), (265, 197),
        (282, 237), (295, 277), (306, 300), (315, 330), (321, 380), (326, 430), (318, 441), (240, 453),
        (200, 459), (150, 468), (100, 477), (50, 488), (0, 499)]
HOUSING = [(45, 270), (250, 270), (264, 284), (264, 416), (250, 431), (45, 431), (28, 416), (28, 284)]
DOOR_GROW = [(0, 8), (300, 260), (322, 282), (338, 350), (352, 430), (326, 447), (0, 505)]  # até onde o cenário pode crescer
# vãos entre o braço do retrovisor e a coluna (meio-fio e asfalto): janela, menos o contorno preto
POCKETS = [[(275, 305), (300, 300), (325, 305), (334, 330), (337, 372), (331, 372), (300, 338), (276, 314)],
           [(288, 410), (302, 410), (320, 431), (318, 434), (294, 434)]]
ARM = [(246, 279), (292, 298), (320, 328), (334, 370), (334, 412), (320, 442), (302, 457), (236, 457), (230, 424)]
GLASS = (62, 297, 232, 396, 16)  # vidro do retrovisor externo: retângulo de cantos redondos
MIR_K, MIR_M = 12, 40           # quanto a moldura esquerda anda para dentro e até que coluna
# relógios do console da arte (centro, raio com o aro) e a caixa onde ficam
CONSOLE = [(1170, 484), (1258, 486), (1344, 484)]
CONSOLE_R = 50
# máscara de pintura: tudo que é vermelho à esquerda da coluna e os dois painéis com saída de ar
PAINT_X = 470
VENTS = [[(468, 312), (722, 308), (722, 412), (468, 412)], [(1398, 312), (1672, 306), (1672, 404), (1398, 404)]]


def poly(shape, pts):
    return cv2.fillPoly(np.zeros(shape, np.uint8), [np.array(pts, np.int32)], 1) > 0


def rrect(shape, x0, y0, x1, y1, r):
    m = np.zeros(shape, np.uint8)
    cv2.rectangle(m, (x0 + r, y0), (x1 - r, y1), 1, -1)
    cv2.rectangle(m, (x0, y0 + r), (x1, y1 - r), 1, -1)
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
        cv2.circle(m, (cx, cy), r, 1, -1)
    return m > 0


def glass_mask(nw):
    H, W = nw.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    lum = nw.astype(int).mean(axis=2)
    # borda do forro: primeira linha do céu (inundado a partir de uma semente, o contorno preto segura)
    n, lab = cv2.connectedComponents((lum >= 45).astype(np.uint8), connectivity=4)
    sky = lab == lab[SKY_SEED[1], SKY_SEED[0]]
    roof = np.full(W, np.nan)
    for x in range(420, W):
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
    solid = poly((H, W), HOUSING) | poly((H, W), ARM)
    door = poly((H, W), DOOR) & ~solid
    mir = rrect((H, W), *GLASS)
    # cantos redondos da carcaça e borda do braço: o cenário que sobrou dentro dos polígonos (o que não
    # é vermelho nem contorno escuro, encostado na janela) também é janela
    hsv = cv2.cvtColor(nw, cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    redish = ((hue < 22) | (hue > 330)) & (hsv[..., 1] > 25)
    scene_dark = (hsv[..., 1] > 60) & (hue > 60) & (hue < 260)   # verde/azul escuro do cenário (o contorno é cinza)
    cand = poly((H, W), DOOR_GROW) & ~redish & ((lum >= 70) | scene_dark) & ~(cv2.dilate(mir.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0)
    for _ in range(20):
        door |= (cv2.dilate(door.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & cand
    for pk in POCKETS:
        door |= poly((H, W), pk) & (lum >= 45)
    return ws | door | mir, mir, roof


def clean(nw, roof):
    """base do retrovisor interno no forro: vira o forro de 100 colunas à esquerda; relógios do console
    apagados com o fundo da caixa em volta"""
    out = nw.copy()
    x0, x1 = STALK
    for x in range(x0, x1):
        y1 = int(np.ceil(roof[x])) + 2
        out[:y1, x] = nw[:y1, x - 100]
    H, W = nw.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    for cx, cy in CONSOLE:
        d = np.hypot(xx - cx, yy - cy)
        ring = (d >= CONSOLE_R + 2) & (d < CONSOLE_R + 7)
        col = np.median(nw[ring], axis=0)
        out[d <= CONSOLE_R] = col
    return out


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
    yi = np.clip(np.floor(ys).astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def main():
    d, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    nw = np.array(Image.open(os.path.join(d, 'cab-nowheel.png')).convert('RGB'))
    ww = np.array(Image.open(os.path.join(d, 'cab-wheel.png')).convert('RGB'))
    g, mir, roof = glass_mask(nw)
    nw = clean(nw, roof)
    A = ~g
    H, W = nw.shape[:2]
    paint_zone = np.zeros((H, W), bool)
    paint_zone[:, :PAINT_X] = True
    for v in VENTS:
        paint_zone |= poly((H, W), v)
    if dbg:
        v = nw.copy()
        v[g] = (0, 255, 0)
        v[mir] = (255, 0, 255)
        Image.fromarray(v).save(os.path.join(dbg, 'cab-alpha.png'))
    y0d = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0d, ROWS)
    xs, yt = grid(y0d - EXT * PXH, EXT)
    st_rgb = np.concatenate([sample(nw, xs, yt), sample(nw, xs, ys)], axis=0)
    st_al = np.concatenate([sample(A, xs, yt), sample(A, xs, ys)], axis=0)
    st_mir = np.concatenate([sample(mir, xs, yt), sample(mir, xs, ys)], axis=0)
    st_pz = np.concatenate([sample(paint_zone, xs, yt), sample(paint_zone, xs, ys)], axis=0)
    # farpas de 1 px espetadas no vidro saem
    for _ in range(6):
        nb = np.zeros(st_al.shape, int)
        nb[1:] += st_al[:-1]; nb[:-1] += st_al[1:]; nb[:, 1:] += st_al[:, :-1]; nb[:, :-1] += st_al[:, 1:]
        spur = st_al & (nb <= 1)
        spur[[0, -1]] = False; spur[:, [0, -1]] = False
        st_al &= ~spur
    # furinhos de até 12 px fecham com a cor do vizinho (o vidro do retrovisor fica)
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
    # retrovisor externo para dentro (celular): linhas da carcaça
    ya = int(EXT + (HOUSING[0][1] - y0d) / PXH) - 1
    yb = int(EXT + (HOUSING[4][1] - y0d) / PXH) + 1
    st_rgb[ya:yb + 1, MIR_K:MIR_M + 1] = st_rgb[ya:yb + 1, 0:MIR_M + 1 - MIR_K].copy()
    st_al[ya:yb + 1, MIR_K:MIR_M + 1] = st_al[ya:yb + 1, 0:MIR_M + 1 - MIR_K].copy()
    st_pz[ya:yb + 1, MIR_K:MIR_M + 1] = st_pz[ya:yb + 1, 0:MIR_M + 1 - MIR_K].copy()
    st_al[ya:yb + 1, :MIR_K] = False
    pm = red_mask(st_rgb, st_al) & st_pz
    for name, sl in (('top', slice(0, EXT)), ('dash', slice(EXT, None))):
        Image.fromarray(np.dstack([st_rgb[sl], st_al[sl].astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'f40-{name}.png'), optimize=True)
        Image.fromarray((pm[sl] * 255).astype(np.uint8), 'L').save(os.path.join(out, f'f40-{name}-mask.png'), optimize=True)

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
        Image.fromarray(v[270:820, 520:1120]).save(os.path.join(dbg, 'wheel-mask.png'))
    xs = PIV_W[0] + (np.arange(256) + 0.5 - PIV_N[0]) * PXW
    ys = PIV_W[1] + (np.arange(WROWS) + 0.5 - (PIV_N[1] + WTOP)) * PXH
    w_rgb, w_al = sample(ww, xs, ys), sample(wheel, xs, ys) & ((ys >= 0) & (ys < Hh))[:, None]
    wimg = np.dstack([w_rgb, w_al.astype(np.uint8) * 255])
    hub = (PIV_N[0] + (EMB[0] - PIV_W[0]) * S, PIV_N[1] + WTOP + (EMB[1] - PIV_W[1]) / PXH)
    yy, xx = np.mgrid[0:WROWS, 0:256]
    e = np.hypot(xx + 0.5 - hub[0], (yy + 0.5 - hub[1]) * (8 / 7))
    R = EMB[2] * S
    plate = np.median(wimg[(e > R + 1) & (e < R + 3) & (wimg[..., 3] > 0)][:, :3], axis=0)
    wimg[(e <= R + 0.6) & (wimg[..., 3] > 0), :3] = plate                       # cavalinho apagado
    wimg[(e <= R - 0.2) & (e > R - 1.3), :3] = (14, 13, 18)                    # aro do botão
    wimg[e <= R - 1.3, :3] = (30, 28, 36)                                     # botão escuro
    wimg[(e <= R - 1.3) & (e > R - 2.3) & (yy + 0.5 < hub[1]), :3] = (48, 46, 58)  # luz em cima
    brand_badges.stamp(wimg, None, 'furia', (round(hub[0]), round(hub[1]), 14, 0))
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, 'f40-wheel.png'), optimize=True)

    spacing = (CONSOLE[2][0] - CONSOLE[0][0]) / 2 * S
    nat = lambda p: (PIV_N[0] + (p[0] - PIV[0]) * S, PIV_N[1] + (p[1] - PIV[1]) / PXH)
    r2 = lambda p: tuple(round(float(v), 2) for v in p)
    print('y0d', round(y0d, 1), 'miolo do volante', r2(hub))
    print('mostradores da arte', [r2(nat(p)) for p in ((750, 464), (914, 464))])
    print('console', [r2(nat(p)) for p in CONSOLE], 'passo', round(spacing, 2))
    gl = nat(((GLASS[0] + GLASS[2]) / 2, (GLASS[1] + GLASS[3]) / 2))
    print('vidro do retrovisor (empilhado)', (round(PAD + gl[0]), round(EXT + gl[1])))


if __name__ == '__main__':
    main()
