"""Quadro Veglia Borletti da Furia F4 (Ferrari F40), copiando a foto do quadro real que o Victor
enviou: placa preta com parafusos, velocímetro 0-360 km/h (de 40 em 40 grandes, 20 em 20
pequenos), conta-giros 0-100 x100 com as marcas vermelhas a partir de 77, água 60-90-120 °C à
esquerda e pressão do turbo 0-0,8-1,5 bar à direita, luzes vermelhas (óleo, água, "slow down") e
as lentes das luzes-espia embaixo de cada grande; números brancos retos, o cavalinho vira o
escudo da Fúria (só o contorno branco). O jogo desenha os ponteiros brancos e os hodômetros.
Gera 4 px por pixel do jogo e 2 px (números pequenos em fonte de pixels).
Uso: python3 tools/ref/f40_gauges.py <src/assets/cockpit>
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
K = 12
PY = 8 / 7
X0, Y0, X1, Y1 = 44, 7, 213, 91
FB = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
FR = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
WH = (240, 240, 236)
RED = (226, 40, 30)
SPEED = dict(x=104.2, y=45.9, r=24.5, a0=128, sweep=284, max=360)
TACH = dict(x=155.2, y=45.9, r=24.5, a0=128, sweep=284, max=100)
WATER = dict(x=68.5, y=66.1, r=12.6, a0=200, a1=340)
BOOST = dict(x=189.2, y=67.3, r=12.6, a0=200, a1=340)
W, H = (X1 - X0) * K, (Y1 - Y0) * K
KO = 4
LABELS = []
PIXFONT = {
    '0': ['111', '101', '101', '101', '111'], '1': ['1', '1', '1', '1', '1'], '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '001', '001'], '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'], ',': ['0', '0', '0', '1', '1'],
}


def P(x, y):
    return ((x - X0) * K, (y - Y0) * K)


def at(g, ang, rr):
    x, y = P(g['x'], g['y'])
    a = math.radians(ang)
    return (x + math.cos(a) * rr * K, y + math.sin(a) * rr * K * PY)


def ell(d, cx, cy, r, **kw):
    x, y = P(cx, cy)
    d.ellipse([x - r * K, y - r * K * PY, x + r * K, y + r * K * PY], **kw)


def tick(d, g, ang, r0, r1, w, col=WH):
    d.line([at(g, ang, r0), at(g, ang, r1)], fill=col, width=max(1, int(round(w * K))))


def label(s, cx, cy, size, font=FB, squeeze=0.92, small_ok=True):
    LABELS.append((s, cx / K, cy / K, size, font, squeeze, small_ok))


def draw_labels(im):
    for s, cx, cy, size, font, squeeze, small_ok in LABELS:
        px = size * KO
        x, y = cx * KO, cy * KO
        if KO == 2 and px < 10:
            if not small_ok or not all(ch in PIXFONT for ch in s):
                continue
            tw = sum(len(PIXFONT[ch][0]) for ch in s) + len(s) - 1
            x0, y0 = int(round(x - tw / 2)), int(round(y - 2.5))
            for ch in s:
                for j, row in enumerate(PIXFONT[ch]):
                    for i, v in enumerate(row):
                        if v == '1':
                            im.putpixel((x0 + i, y0 + j), (*WH, 255))
                x0 += len(PIXFONT[ch][0]) + 1
            continue
        f = ImageFont.truetype(font, int(round(px * 4)))
        d0 = ImageDraw.Draw(Image.new('L', (4, 4)))
        bx0, by0, bx1, by1 = d0.textbbox((0, 0), s, font=f)
        lay = Image.new('L', (bx1 - bx0 + 8, by1 - by0 + 8), 0)
        ImageDraw.Draw(lay).text((4 - bx0, 4 - by0), s, font=f, fill=255)
        lay = lay.resize((max(1, int(lay.width * squeeze / 4)), max(1, int(lay.height / 4))), Image.LANCZOS)
        im.paste((*WH, 255), (int(round(x - lay.width / 2)), int(round(y - lay.height / 2))), lay)


def shield(im, cx, cy, s):
    """escudo da Fúria só em contorno branco (no lugar do cavalinho)"""
    br = json.load(open(os.path.join(ROOT, 'src/assets/brands.json'), encoding='utf-8'))
    rows = br['brands']['furia']['logo']
    a = np.zeros((9, 9), np.uint8)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == 'K':
                a[j, i] = 255
    lg = Image.fromarray(a).resize((s, s), Image.NEAREST)
    im.paste(WH, (int(cx - s / 2), int(cy - s / 2)), lg)


def big(d, g, majors, minors, step, red_from=None, unit='', icons=()):
    ell(d, g['x'], g['y'], g['r'] + 1.4, fill=(8, 8, 9))
    ell(d, g['x'], g['y'], g['r'] + 0.7, fill=(46, 46, 50))
    ell(d, g['x'], g['y'], g['r'], fill=(10, 10, 11))
    fr = lambda v: g['a0'] + g['sweep'] * v / g['max']
    v = 0.0
    while v <= g['max'] + 1e-6:
        col = RED if red_from is not None and v >= red_from else WH
        if any(abs(v - m) < 1e-6 for m in majors):
            tick(d, g, fr(v), g['r'] - 3.2, g['r'] - 0.7, 0.55, col)
        elif any(abs(v - m) < 1e-6 for m in minors):
            tick(d, g, fr(v), g['r'] - 2.4, g['r'] - 0.7, 0.42, col)
        else:
            tick(d, g, fr(v), g['r'] - 1.7, g['r'] - 0.7, 0.32, col)
        v += step
    for L in majors:
        x, y = at(g, fr(L), g['r'] - 6.3)
        label(str(L), x, y, 4.4 if L >= 100 else 4.6, squeeze=0.8 if L >= 100 else 0.92, small_ok=(g is TACH) or L % 80 == 0 or L < 100)
    for L in minors:
        x, y = at(g, fr(L), g['r'] - 5.6)
        label(str(L), x, y, 2.2, font=FR, squeeze=0.9, small_ok=False)
    x, y = at(g, fr(0) + 8, g['r'] - 9.5)
    label(unit, x + K * 1.5, y, 1.7, font=FR, squeeze=1)
    x, y = P(g['x'] + 4, g['y'] + g['r'] * 0.55 * PY)
    label('VEGLIA', x, y, 1.5, squeeze=1)
    label('BORLETTI', x, y + K * 1.3, 1.0, font=FR, squeeze=1)
    # lentes das luzes-espia embaixo
    for i in range(3):
        cx, cy = P(g['x'] + (i - 1) * 5.4, g['y'] + g['r'] * 0.83 * PY)
        d.ellipse([cx - K * 1.2, cy - K * 1.2, cx + K * 1.2, cy + K * 1.2], fill=(150, 150, 150))
        d.ellipse([cx - K * 0.8, cy - K * 1.0, cx + K * 0.4, cy - K * 0.2], fill=(205, 205, 205))


def small(d, g, labels, unit):
    ell(d, g['x'], g['y'], g['r'] + 1.2, fill=(8, 8, 9))
    ell(d, g['x'], g['y'], g['r'] + 0.6, fill=(46, 46, 50))
    ell(d, g['x'], g['y'], g['r'], fill=(10, 10, 11))
    x, y = P(g['x'], g['y'])
    rr = g['r'] * K
    d.chord([x - rr, y - rr * PY, x + rr, y + rr * PY], 10, 170, fill=(24, 24, 26))
    a0, a1 = g['a0'], g['a1']
    for i in range(9):
        a = a0 + (a1 - a0) * i / 8
        big_ = i % 4 == 0
        tick(d, g, a, g['r'] - (2.0 if big_ else 1.4), g['r'] - 0.5, 0.42 if big_ else 0.3)
    for i, L in enumerate(labels):
        a = a0 + (a1 - a0) * i / (len(labels) - 1)
        lx, ly = at(g, a, g['r'] - 4.3)
        label(L, lx, ly + K * 1.4, 3.0, squeeze=0.86)
    lx, ly = P(g['x'], g['y'] - g['r'] * 0.78 * PY)
    label(unit, lx, ly, 1.6, font=FR, squeeze=1)
    ix, iy = x, y + rr * PY * 0.5
    s = K * 0.85
    d.rectangle([ix - s * 0.22, iy - s * 1.2, ix + s * 0.22, iy + s * 0.3], fill=WH)
    for k in range(3):
        d.line([ix - s * (1.3 - k * 0.15), iy + s * (0.55 + k * 0.38), ix + s * (1.3 - k * 0.15), iy + s * (0.55 + k * 0.38)], fill=WH, width=max(1, K // 7))


def lamp(d, cx, cy, r, text=None):
    x, y = P(cx, cy)
    d.ellipse([x - (r + 0.8) * K, y - (r + 0.8) * K, x + (r + 0.8) * K, y + (r + 0.8) * K], fill=(16, 16, 18))
    d.ellipse([x - r * K, y - r * K, x + r * K, y + r * K], fill=(120, 18, 16))
    d.ellipse([x - r * 0.6 * K, y - r * 0.7 * K, x, y - r * 0.1 * K], fill=(170, 40, 34))


def build(out):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # placa preta de cantos arredondados (como a da foto, mais larga em cima)
    # preenche o vão escuro da capa do quadro inteiro (sem restos dos mostradores da arte)
    pl = [P(57.5, 8.5), P(199, 8.5), P(206.5, 13.5), P(211.5, 40), P(211.5, 90), P(45.5, 90), P(45.5, 40), P(50.5, 13.5)]
    d.polygon(pl, fill=(22, 22, 24))
    for (sx, sy) in [(60, 12), (197, 12), (49, 50), (208, 50), (50, 82), (207, 82)]:
        x, y = P(sx, sy)
        d.ellipse([x - K * 0.9, y - K * 0.9, x + K * 0.9, y + K * 0.9], fill=(48, 48, 52))
    big(d, SPEED, list(range(0, 361, 40)), list(range(20, 361, 40)), 10, None, 'km/h')
    big(d, TACH, list(range(0, 101, 10)), [], 5, 77, 'x100')
    small(d, WATER, ['60', '90', '120'], '°C')
    small(d, BOOST, ['0', '0,8', '1,5'], 'bar')
    lamp(d, 129.7, 20.5, 2.6)
    lamp(d, 129.7, 70.5, 2.6)
    lamp(d, 61.5, 40, 2.4)
    lamp(d, 198.5, 40, 2.4)
    x, y = P(TACH['x'], TACH['y'] - TACH['r'] * 0.42 * PY)
    shield(im, x, y, int(K * 4.5))
    fin = im.resize((W * KO // K, H * KO // K), Image.LANCZOS)
    draw_labels(fin)
    fin.save(os.path.join(out, 'f40-cluster.png' if KO == 4 else 'f40-cluster-2x.png'), optimize=True)


def main():
    global KO
    for KO in (4, 2):
        LABELS.clear()
        build(sys.argv[1])
    print('quadro', (X0, Y0), (X1 - X0, Y1 - Y0))


if __name__ == '__main__':
    main()
