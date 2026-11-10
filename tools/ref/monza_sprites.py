"""Sprites do Monção S/R (Monza S/R hatch 1987, pixel art do Victor). A arte vem com cenário: o carro
é recortado por inundação do fundo a partir das bordas (o contorno preto do carro segura), fica só a
maior mancha e a sombra azulada do chão sai. A lateral vem com a frente para a direita: é espelhada.
Marcas reais somem: gravata na grade e nas rodas, "CHEVROLET" na tampa e a placa "MONZA" da frente;
o letreiro da lateral fica só "S/R". Reduz por área (lateral 300, traseira e frente 200), alfa binário.
Máscara de pintura: o vermelho da lataria (sem lanternas, piscas e filetes do para-choque).
Emblemas da marca: brand_badges.py.
Uso: python3 tools/ref/monza_sprites.py <pasta com src-*.png> <src/assets/cars>   (DBG=<pasta> grava o recorte)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

WIDTH = {'side': 300, 'rear': 200, 'front': 200}
# caixa do carro na arte (folga em volta), para a inundação não gastar tempo com o cenário
BOX = {'front': (330, 170, 1330, 880), 'rear': (320, 160, 1350, 880), 'side': (30, 280, 1650, 850)}


def segment(a, k):
    rgb = a.astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    # contorno/peças escuras do carro: quase preto e sem o azulado da sombra do chão
    dark = (lum < 62) & ~((b > r + 18) & (b > 38))
    red = (r > 120) & (r > g * 1.9) & (r > b * 1.9)
    H, W = lum.shape
    x0, y0, x1, y1 = BOX[k]
    can = ~dark & ~red  # por onde o fundo pode passar
    can[:y0], can[y1:], can[:, :x0], can[:, x1:] = True, True, True, True
    n, lab = cv2.connectedComponents(can.astype(np.uint8), connectivity=4)
    bg = lab == lab[0, 0]
    car = ~bg
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(car, 8)
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    core = (lab == big).astype(np.uint8)
    car = (cv2.dilate(core, np.ones((11, 11), np.uint8)) > 0) & ~bg
    n, lab, st, _ = cv2.connectedComponentsWithStats(car.astype(np.uint8), 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    return car


def rowfill(a, x0, y0, x1, y1):
    """apaga um letreiro: cada linha recebe a cor da lataria logo à esquerda e à direita dele"""
    for y in range(y0, y1):
        l, r = a[y, x0 - 6:x0 - 1].mean(axis=0), a[y, x1 + 1:x1 + 6].mean(axis=0)
        t = np.linspace(0, 1, x1 - x0)[:, None]
        a[y, x0:x1] = (l * (1 - t) + r * t).astype(np.uint8)


def debrand(a, k):
    if k == 'front':
        a[566:606, 786:882] = a[566:606, 676:772]  # gravata: a grade ao lado por cima
        sr = a[690:746, 862:948].copy()
        a[686:750, 718:948] = (12, 12, 16)
        a[690:746, 790:876] = sr  # placa: só "S/R", centrado
    elif k == 'rear':
        rowfill(a, 420, 502, 596, 540)
        rowfill(a, 1042, 500, 1252, 542)
    else:
        rowfill(a, 1008, 632, 1112, 668)  # "MONZA" (fica o S/R)
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        for cx, cy in ((383, 717), (1343, 717)):
            d = np.hypot(xx - cx, yy - cy)
            ring = (d > 30) & (d < 36)
            lum = a[ring].mean(axis=1)
            a[d <= 30] = np.median(a[ring][lum > np.percentile(lum, 50)], axis=0).astype(np.uint8)


def ground(car, a, k):
    """tira a sombra e o asfalto embaixo do carro, e os tufos de grama grudados na borda"""
    H, W = car.shape
    yy, xx = np.mgrid[0:H, 0:W]
    rgb = a.astype(int)
    green = (rgb[..., 1] > rgb[..., 0] + 12) & (rgb[..., 1] > rgb[..., 2] + 6)
    car &= ~green
    if k == 'side':
        wheels = np.zeros_like(car)
        for cx, cy in ((383, 717), (1343, 717)):
            wheels |= np.hypot(xx - cx, yy - cy) <= 116
        car &= (yy <= 748) | wheels
    elif k == 'front':
        car &= (yy <= 803) | ((xx >= 378) & (xx <= 526)) | ((xx >= 1130) & (xx <= 1278))
    else:
        car &= (yy <= 800) | ((xx >= 358) & (xx <= 520)) | ((xx >= 1150) & (xx <= 1312))
    n, lab, st, _ = cv2.connectedComponentsWithStats(car.astype(np.uint8), 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    # o verde de dentro (paisagem vista pelos vidros) volta, com cor de vidro
    n, lab = cv2.connectedComponents((~car).astype(np.uint8), connectivity=4)
    hole = ~car & (lab != lab[0, 0])
    lum = rgb.mean(axis=2)
    g2 = hole & green
    a[g2] = np.clip(np.dstack([lum * 0.3, lum * 0.62, lum * 1.15 + 30]), 0, 255).astype(np.uint8)[g2]
    return car | hole


def shrink(a, car, tw):
    ys, xs = np.nonzero(car)
    rgb = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.float32)
    al = car[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    th = round(rgb.shape[0] * tw / rgb.shape[1])
    pm = np.dstack([rgb * al[..., None], al * 255.0]).astype(np.float32)
    sm = cv2.resize(pm, (tw, th), interpolation=cv2.INTER_AREA)
    a8 = sm[..., 3]
    col = np.clip(sm[..., :3] / np.maximum(a8[..., None] / 255, 1e-3), 0, 255)
    return np.dstack([col, np.where(a8 >= 128, 255, 0)]).astype(np.uint8), (xs.min(), ys.min(), rgb.shape[1] / tw)


def paint_mask(s):
    hsv = cv2.cvtColor(np.ascontiguousarray(s[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    al = s[..., 3] > 0
    core = al & ((hue < 12) | (hue > 340)) & (hsv[..., 1] > 120) & (hsv[..., 2] > 60)
    near = cv2.dilate(core.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    m = core | (al & near & ((hue < 16) | (hue > 335)) & (hsv[..., 1] > 60) & (hsv[..., 2] > 40))
    for _ in range(4):  # reflexos claros/rosados encostados na pintura (senão ficam rosa com outra cor)
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= al & near & (hsv[..., 2] > 150) & (hsv[..., 1] > 15) & ((hue < 30) | (hue > 325))
    return m


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    for k, tw in WIDTH.items():
        a = np.array(Image.open(os.path.join(src, f'src-{k}.png')).convert('RGB'))
        car = ground(segment(a, k), a, k)
        debrand(a, k)
        if k == 'side':  # frente para a esquerda
            a, car = a[:, ::-1], car[:, ::-1]
        s, (ox, oy, f) = shrink(np.ascontiguousarray(a), np.ascontiguousarray(car), tw)
        m = paint_mask(s)
        sy = lambda y: int(round((y - oy) / f))
        if k == 'front':
            m[sy(640):] = False  # filete vermelho do para-choque
            for sl in (slice(0, 21), slice(179, 200)):  # piscas âmbar
                m[sy(515):, sl] = False
        elif k == 'rear':
            m[sy(556):] = False  # lanternas e filete
        else:
            m[sy(618):] = False  # filete da saia
            m[sy(480):, :int(round(40 / f))] = m[sy(480):, :int(round(40 / f))] & False  # pisca dianteiro
            m[sy(480):, -int(round(75 / f)):] = False  # lanterna traseira
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'br-monza-{k}.png'), optimize=True)
        Image.fromarray((m * 255).astype(np.uint8), 'L').convert('RGBA').save(os.path.join(out, f'br-monza-{k}-mask.png'), optimize=True)
        print(k, s.shape[1], s.shape[0], 'origem', ox, oy, 'fator', round(f, 3), 'máscara', int(m.sum()))
        if dbg:
            v = np.array(Image.fromarray(s).resize((s.shape[1] * 4, s.shape[0] * 4), Image.NEAREST))
            bg = np.zeros_like(v[..., :3]); bg[:] = (0, 200, 0)
            al = v[..., 3:] / 255
            Image.fromarray((v[..., :3] * al + bg * (1 - al)).astype(np.uint8)).save(os.path.join(dbg, f'out-{k}.png'))
            mm = np.array(Image.fromarray((m * 255).astype(np.uint8)).resize((s.shape[1] * 4, s.shape[0] * 4), Image.NEAREST)) > 0
            bl = v[..., :3].copy(); bl[mm] = bl[mm][:, ::-1]  # repinta de azul para conferir
            Image.fromarray((bl * al + bg * (1 - al)).astype(np.uint8)).save(os.path.join(dbg, f'blue-{k}.png'))


if __name__ == '__main__':
    main()
