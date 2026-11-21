"""Cabine do Vetor GSi (Chevrolet Vectra GSi 2.0 16v) a partir das duas artes novas do Victor (com e sem volante,
cenário pelos vidros), no molde do Corsário (corsa_cockpit2.py) e do Cadete (kadett_cockpit.py):
- painel, colunas e portas da arte SEM volante; volante de quatro raios da arte COM volante (aro pelas elipses
  medidas; almofada e raios = o couro (mais claro que os vãos) dentro do aro, abaixo do quadro; as artes não
  estão alinhadas ao pixel)
- vidros: no para-brisa (acima da linha do painel, à direita da coluna) e na janela da porta, o que é cenário
  (céu, nuvem, mato, grade, asfalto) vira vidro; coluna, borracha e retrovisor ficam; o vidro do retrovisor
  esquerdo também vira vidro (o jogo põe a vista de trás)
- limpadores (fiozinhos na base do para-brisa) saem com o resto do cenário
- quadro: o miolo dos quatro mostradores vira preto liso (fica o recorte do painel); o quadro da FOTO do carro
  real (vectra_gauges.py) cobre tudo
- buzina: a gravata vira botão liso com o emblema da Vanguarda
O volante fica centrado no quadro (x 860), como no carro. Acima da arte (o topo da cabine passa do alto da
imagem) a linha de cima continua deslocada na inclinação da coluna A.
Uso: python3 tools/ref/vectra_cockpit.py <pasta com cockwheel.png e cockdash.png> <src/assets/cockpit>  (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import brand_badges  # noqa: E402

ID = 'br-vectra'
S = 0.25   # a arte é mais aberta (volante e retrovisor maiores na imagem): escala menor que a dos outros
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV_X = 820.0   # retrovisor esquerdo inteiro na tela de celular; as bordas que a arte não cobre são construídas (edge_build)
WHEEL_C = (860.0, 467.0)
Y0D = 150.0
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
WROWS = 190
RIM_OUT = (860.0, 467.0, 293.0, 293.0)
RIM_IN = (860.0, 467.0, 242.0, 239.0)
EMB = (853.0, 482.0, 32.0)
MIRROR_SEED = (150, 280)
CLUSTER = [(612, 262), (1100, 262), (1100, 418), (612, 418)]    # moldura do quadro (miolo vira preto)
WIND_X = lambda y: 455 + (y / 240.0) * 65                         # borda direita da coluna A
DOOR_Y = lambda x: 375 - x * 0.125                                # borda de cima da porta (janela acima)
HOUSING = [(28, 178), (150, 166), (314, 170), (332, 300), (334, 348), (268, 348), (40, 332), (24, 262)]


def scene_mask(nw):
    H, W = nw.shape[:2]
    a = nw.astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = a.mean(axis=2)
    hsv = cv2.cvtColor(nw, cv2.COLOR_RGB2HSV).astype(int)
    sat = hsv[..., 1]
    sky = (b > r + 30) & (b > 100)
    leaf = (g > r + 10) & (g > b - 20) & (g > 50)
    cloud = (lum > 170) & (sat < 60)
    road = (lum > 70) & (sat < 70) & (b >= r - 4)
    return sky | leaf | cloud | road


def dash_line(nw):
    """borda de cima do painel: em cada coluna, a primeira linha (a partir de 150) com 16 linhas seguidas de
    painel (escuro, sem verde nem céu); alisada"""
    a = nw.astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = a.mean(axis=2)
    dk = (lum < 58) & ~(g > r + 8) & ~((b > r + 30) & (b > 100))
    W = nw.shape[1]
    d = np.full(W, 210.0)
    for x in range(W):
        col = dk[175:330, x]
        for k in range(len(col) - 7):
            if col[k:k + 7].sum() >= 6:
                d[x] = 175 + k
                break
    d = np.array([np.median(d[max(0, x - 20):x + 21]) for x in range(W)])
    # linha lisa (a borda do painel é uma curva suave): polinômio de 3º grau à direita da coluna A
    xs = np.arange(560, W)
    cf = np.polyfit(xs, d[560:], 3)
    d[560:] = np.polyval(cf, xs)
    return d


def glass_mask(nw):
    H, W = nw.shape[:2]
    sc = scene_mask(nw)
    yy, xx = np.mgrid[0:H, 0:W]
    dl = dash_line(nw)
    wind = (xx > WIND_X(yy)) & (yy < dl[xx])
    # janela da porta: à esquerda da coluna, acima da porta
    house = cv2.fillPoly(np.zeros((H, W), np.uint8), [np.array(HOUSING, np.int32)], 1) > 0
    win = (xx < 300 + yy * 0.15) & (yy < DOOR_Y(xx)) & ~house
    # vidro do retrovisor esquerdo (o cenário dentro da moldura escura)
    n, lab = cv2.connectedComponents((sc & house).astype(np.uint8), connectivity=8)
    mir = lab == lab[MIRROR_SEED[1], MIRROR_SEED[0]]
    ys, xs = np.nonzero(mir)
    hull = cv2.convexHull(np.stack([xs, ys], 1).astype(np.int32))
    mir = cv2.fillPoly(np.zeros((H, W), np.uint8), [hull], 1) > 0
    frame = house & ~mir & ~sc        # moldura do retrovisor fica
    # rente à linha do painel: o que ainda é cenário (pé da grade, mato, céu) também é vidro
    band = (xx > WIND_X(yy)) & (yy >= dl[xx] - 2) & (yy < dl[xx] + 3)
    g = (wind | win | mir | (band & sc)) & ~frame
    g = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0
    # postes da grade em pé sobre o painel (estreitos): saem numa abertura horizontal
    near = (xx > WIND_X(yy) + 20) & (yy >= dl[xx] - 25) & (yy < dl[xx] + 6)
    op = ~g & near
    wide = cv2.morphologyEx(op.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, 41), np.uint8)) > 0
    g |= op & ~wide
    # limpador e friso finos deitados sobre o painel (menos de 9 linhas de altura): também saem
    op = ~g & (xx > WIND_X(yy) + 20) & (yy >= dl[xx] - 25) & (yy < dl[xx] + 10)
    tall = cv2.morphologyEx(op.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 1), np.uint8)) > 0
    tall |= (cv2.dilate(tall.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & op & (yy >= dl[xx] + 4)
    g |= op & ~tall & (yy < dl[xx] + 6)
    # ilhas opacas pequenas no vidro (folhas escuras, poste) somem
    n, lab, st, _ = cv2.connectedComponentsWithStats(((xx > WIND_X(yy)) & (yy < dl[xx]) & ~g).astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 400:
            g[lab == i] = True
    return g, mir


def clean(nw):
    out = nw.copy()
    m = cv2.fillPoly(np.zeros(nw.shape[:2], np.uint8), [np.array(CLUSTER, np.int32)], 1) > 0
    lum = nw.astype(int).mean(axis=2)
    # mostradores: o que é claro (números, marcas, ponteiros) e colorido (laranja, vermelho) dentro da moldura
    a = nw.astype(int)
    loud = (lum > 70) | ((a[..., 0] > a[..., 2] + 40) & (a[..., 0] > 90))
    loud = cv2.dilate((m & loud).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    out[loud & m] = (12, 11, 16)
    return out


def extend_up(img, n):
    """n linhas acima do alto da arte: a linha 0 deslocada na inclinação da coluna A (0,25 px por linha)"""
    rows = [np.roll(img[0], -int(round(0.25 * (n - i))), axis=0) for i in range(n)]
    return np.concatenate([np.stack(rows), img], axis=0)


UP = 140


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
    inner = ell(RIM_IN)
    lum = ww.astype(int).mean(axis=2)
    pad = inner & (y4 > 404) & (lum > 36)
    pad = cv2.morphologyEx(pad.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    pad = cv2.morphologyEx(pad, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(pad, connectivity=4)
    pad = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    n, lab = cv2.connectedComponents((~pad).astype(np.uint8), connectivity=4)
    pad |= (lab != lab[0, 0]) & (np.hypot(x4 - EMB[0], y4 - EMB[1]) < EMB[2] + 8)
    pad = cv2.dilate(pad.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    return ell(RIM_OUT) & (~inner | (pad & inner))


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
    nw, A, mir = extend_up(nw, UP), extend_up(A, UP), extend_up(mir, UP)
    global Y0D
    Y0D += UP
    xs, ys = grid(Y0D, ROWS)
    d_rgb, d_al = sample(nw, xs, ys), sample(A, xs, ys)
    xs, yt = grid(Y0D - EXT * PXH, EXT)
    t_rgb, t_al = sample(nw, xs, yt), sample(A, xs, yt)
    st_al = np.concatenate([t_al, d_al], axis=0)
    st_rgb = np.concatenate([t_rgb, d_rgb], axis=0)
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
    wheel = wheel_mask(ww)
    if dbg:
        v = ww.copy(); v[~wheel] = (v[~wheel] * 0.35 + np.array([0, 160, 0]) * 0.65).astype(np.uint8)
        Image.fromarray(v[160:780, 550:1170]).save(os.path.join(dbg, 'wheel-mask.png'))
    Y0D -= UP
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
    wimg[e <= core_r, :3] = (22, 20, 26)
    wimg[(e <= core_r) & (e > core_r - 1.1), :3] = (padc * 1.2).clip(0, 255).astype(np.uint8)
    brand_badges.stamp(wimg, None, 'vanguarda', (round(hub[0]), round(hub[1]), 8, 0))
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, f'{ID}-wheel.png'), optimize=True)
    nat = lambda p: (round(PIV_N[0] + (p[0] - PIV_X) * S, 2), round((p[1] - Y0D) / PXH, 2))  # noqa: E731
    wr = (WHEEL_C[1] - Y0D) / PXH
    print('wheelTop', round(piv_y - 104, 2), 'wheelDy', round(wr * 128 / 124 - 104, 2), 'wheelDx', round((WHEEL_C[0] - PIV_X) * S, 2))
    print('quadro', nat(CLUSTER[0]), nat(CLUSTER[2]))
    gl = (PIV_N[0] + (MIRROR_SEED[0] - PIV_X) * S, (MIRROR_SEED[1] - Y0D) / PXH)
    print('vidro do retrovisor (empilhado, com PAD)', (round(PAD + gl[0]), round(EXT + gl[1])))


if __name__ == '__main__':
    main()
