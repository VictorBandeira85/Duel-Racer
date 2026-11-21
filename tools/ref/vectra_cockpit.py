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
O volante fica à esquerda do centro da tela, como na arte. 3ª arte: vidros em magenta (corte direto pela cor); a
alça do teto e a haste do retrovisor interno viram forro. Acima da arte (o topo da cabine passa do alto da
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
from cockpit_reduce import core, palette  # noqa: E402

ID = 'br-vectra'
S = 0.29   # arte nova (2ª): um pouco mais aberta que a dos outros carros
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV_X = 760.0   # retrovisor esquerdo inteiro na tela de celular; as bordas que a arte não cobre são construídas (edge_build)
WHEEL_C = (843.0, 528.0)
Y0D = 226.0
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
WROWS = 200
RIM_OUT = (843.0, 528.0, 260.0, 256.0)
RIM_IN = (843.0, 528.0, 218.0, 214.0)
EMB = (842.0, 541.0, 31.0)
MIRROR_SEED = (150, 350)
CLUSTER = [(640, 345), (1050, 345), (1050, 488), (640, 488)]    # moldura do quadro (miolo vira preto)
WIND_X = lambda y: 405 + y * 0.17                                # borda direita da coluna A (medida)
PILLAR_L = lambda y: 232 + y * 0.34                              # borda esquerda da coluna A
DOOR_Y = lambda x: 520 - x * 0.27                                # borda de cima da porta (janela acima)
HOUSING = [(30, 290), (150, 276), (296, 272), (306, 380), (300, 436), (240, 432), (40, 420), (28, 360)]


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
    d = np.full(W, 300.0)
    for x in range(W):
        col = dk[240:400, x]
        for k in range(len(col) - 7):
            if col[k:k + 7].sum() >= 6:
                d[x] = 240 + k
                break
    d = np.array([np.median(d[max(0, x - 20):x + 21]) for x in range(W)])
    # linha lisa (a borda do painel é uma curva suave): polinômio de 3º grau à direita da coluna A
    xs = np.arange(560, W)
    cf = np.polyfit(xs, d[560:], 3)
    d[560:] = np.polyval(cf, xs)
    return d


def magenta(nw):
    """vidros da arte em magenta (3ª arte): os blocos grandes de magenta e a franja rosada encostada"""
    a = nw.astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (r - g > 90) & (b - g > 90) & (r > 170) & (b > 170)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=4)
    m = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 3000])
    fringe = (r - g > 40) & (b - g > 40) & (r > 110) & (b > 110)
    near = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    return m | (near & fringe)


IMIR = (995, 84, 1320, 198)      # retrovisor interno (vira vidro: o jogo desenha o dele)
STALK = (1108, 62, 1202, 86)     # haste do retrovisor interno no forro
HANDLE = (340, 2, 536, 80)       # alça do teto (sai: vira forro)


def glass_mask(nw):
    H, W = nw.shape[:2]
    g = magenta(nw)
    x0, y0, x1, y1 = IMIR
    g[y0:y1, x0:x1] = True
    n, lab = cv2.connectedComponents(g.astype(np.uint8), connectivity=4)
    mir = lab == lab[MIRROR_SEED[1], MIRROR_SEED[0]]
    # ilhas opacas pequenas soltas no vidro somem
    n, lab, st, _ = cv2.connectedComponentsWithStats((~g).astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 300:
            g[lab == i] = True
    return g, mir


def fill_rows(out, nw, box, lx, rx):
    """apaga uma peça do forro: cada linha vira a passagem da cor do forro à esquerda para a da direita"""
    x0, y0, x1, y1 = box
    mg = magenta(nw)
    l = r = None
    for y in range(y0, y1):
        ls, rs = nw[y, lx[0]:lx[1]][~mg[y, lx[0]:lx[1]]], nw[y, rx[0]:rx[1]][~mg[y, rx[0]:rx[1]]]
        l = np.median(ls, axis=0) if len(ls) > 2 else l       # (vidro ao lado: fica a cor da linha de cima)
        r = np.median(rs, axis=0) if len(rs) > 2 else r
        t = np.linspace(0, 1, x1 - x0)[:, None]
        out[y, x0:x1] = (l * (1 - t) + r * t).astype(np.uint8)


def clean(nw):
    out = nw.copy()
    fill_rows(out, nw, HANDLE, (326, 338), (538, 550))
    fill_rows(out, nw, STALK, (1094, 1104), (1206, 1216))
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
    pad = inner & (y4 > 470) & (lum > 36)
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
    nwc = core(nw, PXW)
    d_rgb, d_al = sample(nwc, xs, ys), sample(A, xs, ys)
    xs, yt = grid(Y0D - EXT * PXH, EXT)
    t_rgb, t_al = sample(nwc, xs, yt), sample(A, xs, yt)
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
        Image.fromarray(palette(np.dstack([rgb, a_.astype(np.uint8) * 255])), 'RGBA').save(os.path.join(out, f'{ID}-{name}.png'), optimize=True)
    wheel = wheel_mask(ww)
    if dbg:
        v = ww.copy(); v[~wheel] = (v[~wheel] * 0.35 + np.array([0, 160, 0]) * 0.65).astype(np.uint8)
        Image.fromarray(v[260:800, 570:1120]).save(os.path.join(dbg, 'wheel-mask.png'))
    Y0D -= UP
    top = WHEEL_C[1] - RIM_OUT[3] - 4
    xs = WHEEL_C[0] + (np.arange(256) + 0.5 - 128) * PXW
    ys = top + (np.arange(WROWS) + 0.5) * PXH
    w_rgb, w_al = sample(core(ww, PXW), xs, ys), sample(wheel, xs, ys) & (ys < ww.shape[0])[:, None]
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
    wimg = palette(wimg, 64)
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, f'{ID}-wheel.png'), optimize=True)
    nat = lambda p: (round(PIV_N[0] + (p[0] - PIV_X) * S, 2), round((p[1] - Y0D) / PXH, 2))  # noqa: E731
    wr = (WHEEL_C[1] - Y0D) / PXH
    print('wheelTop', round(piv_y - 104, 2), 'wheelDy', round(wr * 128 / 124 - 104, 2), 'wheelDx', round((WHEEL_C[0] - PIV_X) * S, 2))
    print('quadro', nat(CLUSTER[0]), nat(CLUSTER[2]))
    gl = (PIV_N[0] + (MIRROR_SEED[0] - PIV_X) * S, (MIRROR_SEED[1] - Y0D) / PXH)
    print('vidro do retrovisor (empilhado, com PAD)', (round(PAD + gl[0]), round(EXT + gl[1])))


if __name__ == '__main__':
    main()
