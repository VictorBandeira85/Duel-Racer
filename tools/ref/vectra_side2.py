"""Lateral do Vetor GSi a partir da arte nova do Victor em fundo magenta liso (1774 x 887, frente para a
direita: é espelhada). Substitui a lateral do vectra_sprites.py (a de cenário, que deixava restos de mato).
- fundo: magenta ligado às bordas; a franja rosada encostada nele também sai
- vidros: o magenta visto por dentro das janelas (buracos fechados pela carroceria) e a franja rosada em
  volta viram vidro azul escuro (mais claro em cima); bancos e colunas desenhados ficam
- marcas: a gravata dos miolos das rodas sai (miolo liso, como no resto do jogo); o adesivo do vidro sai;
  o "2.0 16V" da porta é espelhado no lugar antes do espelho geral (continua legível)
- redução: shrink do monza_sprites.py (miolo de cada bloco + paleta curta), 400 de largura
- lanterna: o miolo amarelo-claro (lâmpada acesa na arte) vira âmbar
- máscara de pintura: lataria clara e pouco colorida, sem lanternas, faróis, rodas e letreiro
Uso: python3 tools/ref/vectra_side2.py <side.png> <src/assets/cars>   (DBG=<pasta> grava a conferência)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink  # noqa: E402

ID = 'br-vectra'
HUBS = ((489, 645), (1380, 645))      # miolos das rodas (gravata), arte original
HUB_R = 21                            # o miolo com a gravata; o aro da capa (r 22-26) fica
WHEEL_R = 102                         # roda inteira (pneu), para tirar da máscara de pintura
TEXT = (1110, 525, 1234, 551)         # "2.0 16V"
STICKER = (916, 414, 956, 432)        # adesivo no vidro da porta
# lentes (polígonos justos: a lataria em volta tem de entrar na pintura)
LENSES = [
    [(176, 452), (211, 452), (211, 545), (176, 545)],                                 # lanterna
    [(1562, 506), (1600, 499), (1616, 506), (1623, 546), (1570, 549), (1561, 541)],    # farol
    [(1600, 621), (1629, 621), (1623, 653), (1596, 653)],                             # farol de neblina
]


def is_mag(a, loose=False):
    r, g, b = (a[..., i].astype(int) for i in range(3))
    if loose:
        return (r - g > 60) & (b - g > 60)
    return (r > 170) & (b > 170) & (g < 90)


def segment(a):
    H, W = a.shape[:2]
    mag = is_mag(a)
    n, lab = cv2.connectedComponents(mag.astype(np.uint8), connectivity=4)
    bg = np.isin(lab, np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    bg &= mag
    # franja rosada encostada no fundo
    pink = is_mag(a, loose=True)
    for _ in range(3):
        bg |= pink & (cv2.dilate(bg.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    car = ~bg
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(car.astype(np.uint8), 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    # janelas: magenta fechado dentro do carro, mais a franja rosada em volta
    win = mag & car
    win = cv2.morphologyEx(win.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    for _ in range(4):
        win |= pink & car & (cv2.dilate(win.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    stray = (pink | mag) & car & ~win                       # pontos rosados soltos: viram a cor do vizinho
    return car, win, stray


def glass(a, win):
    ys = np.nonzero(win)[0]
    y0, y1 = ys.min(), ys.max()
    yy = np.mgrid[0:a.shape[0], 0:a.shape[1]][0]
    t = np.clip((yy - y0) / max(1, y1 - y0), 0, 1)
    top, bot = np.array([70, 112, 178]), np.array([26, 46, 92])
    col = (top[None, None] * (1 - t[..., None]) + bot[None, None] * t[..., None]).astype(np.uint8)
    a[win] = col[win]


def fix_stray(a, stray):
    if stray.any():
        blur = cv2.medianBlur(a, 5)
        a[stray] = blur[stray]


def rowfill(a, x0, y0, x1, y1):
    for y in range(y0, y1):
        l, r = a[y, x0 - 6:x0 - 1].astype(float).mean(axis=0), a[y, x1 + 1:x1 + 6].astype(float).mean(axis=0)
        t = np.linspace(0, 1, x1 - x0)[:, None]
        a[y, x0:x1] = (l * (1 - t) + r * t).astype(np.uint8)


def debrand(a):
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    for cx, cy in HUBS:
        d = np.hypot(xx - cx, yy - cy)
        ring = (d > HUB_R - 6) & (d < HUB_R - 1)
        lum = a[ring].astype(int).mean(axis=1)
        cap = np.median(a[ring][lum > np.percentile(lum, 60)], axis=0).astype(np.uint8)
        a[d <= HUB_R - 1] = cap
    rowfill(a, *STICKER)
    # lanterna: nada aceso na arte (o miolo amarelo-claro da lâmpada vira o âmbar da lente)
    x0, y0, x1, y1 = 176, 452, 211, 545
    q = a[y0:y1, x0:x1].astype(int)
    lit = (q[..., 0] > 220) & (q[..., 1] > 170)
    q[lit] = (q[lit] * [0.9, 0.62, 0.25]).astype(int)
    a[y0:y1, x0:x1] = q.astype(np.uint8)
    x0, y0, x1, y1 = TEXT
    a[y0:y1, x0:x1] = a[y0:y1, x0:x1][:, ::-1].copy()   # espelhado no lugar: lê certo depois do espelho geral


def zone(shape):
    z = np.zeros(shape, np.uint8)
    for p in LENSES:
        cv2.fillPoly(z, [np.array(p, np.int32)], 1)
    z = z > 0
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]]
    for cx, cy in HUBS:
        z |= np.hypot(xx - cx, yy - cy) <= WHEEL_R
    return z


def paint_mask(a, car, win):
    rgb = a.astype(int)
    lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    ok = car & ~win & ~zone(car.shape)
    x0, y0, x1, y1 = TEXT
    txt = np.zeros_like(ok)
    txt[y0:y1, x0:x1] = lum[y0:y1, x0:x1] < 160
    ok &= ~txt
    m = ok & (lum > 120) & (sat < 60)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    for _ in range(6):
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= ok & near & (lum > 80) & (sat < 70)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    return np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 60])


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    a = np.array(Image.open(src).convert('RGB'))
    car, win, stray = segment(a)
    glass(a, win)
    fix_stray(a, stray)
    debrand(a)
    pm = paint_mask(a, car, win)
    a, car, pm = (np.ascontiguousarray(v[:, ::-1]) for v in (a, car, pm))
    s, (ox, oy, f) = shrink(a, car, 400)
    g8, _ = shrink(np.dstack([pm * 255] * 3).astype(np.uint8), car, 400, colors=0)
    m = (g8[..., 0] > 127) & (s[..., 3] > 0)
    Image.fromarray(s, 'RGBA').save(os.path.join(out, f'{ID}-side.png'), optimize=True)
    Image.fromarray((m * 255).astype(np.uint8), 'L').convert('RGBA').save(os.path.join(out, f'{ID}-side-mask.png'), optimize=True)
    W = a.shape[1]
    fr = lambda x, y: (round((W - 1 - x - ox) / f / s.shape[1], 4), round((y - oy) / f / s.shape[0], 4))  # noqa: E731
    print('side', s.shape[1], s.shape[0], 'fator', round(f, 3))
    print('  farol', fr(1592, 524), 'lanterna', fr(194, 498))
    if dbg:
        v = np.array(Image.fromarray(s).resize((s.shape[1] * 3, s.shape[0] * 3), Image.NEAREST))
        bg = np.zeros_like(v[..., :3]); bg[:] = (0, 160, 0)
        al = v[..., 3:] / 255
        mm = np.array(Image.fromarray((m * 255).astype(np.uint8)).resize((s.shape[1] * 3, s.shape[0] * 3), Image.NEAREST)) > 0
        lum = v[..., :3].astype(float).mean(axis=2)
        bl = v[..., :3].copy(); bl[mm] = np.stack([lum * .25, lum * .45, lum * 1.1], -1).clip(0, 255)[mm]
        Image.fromarray(np.concatenate([(v[..., :3] * al + bg * (1 - al)), (bl * al + bg * (1 - al))], 0).astype(np.uint8)).save(os.path.join(dbg, 'side-dbg.png'))


if __name__ == '__main__':
    main()
