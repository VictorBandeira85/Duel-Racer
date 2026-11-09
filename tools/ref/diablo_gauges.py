"""Quadro VDO do Toro V12 (Lamborghini Diablo), copiando a foto do quadro real que o Victor enviou:
fundos brancos, marcações e números pretos em grotesca negrita, velocímetro 0-360 km/h com os
hodômetros, conta-giros 0-90 (min-1 x100) com faixa amarela de 70 a 75 e vermelha de 75 a 90,
temperatura do óleo 50-150 °C, combustível 0-½-1 e pressão do óleo 0-10 bar, "VDO" em cada um e o
touro da marca trocado pelo escudo da Toro (só contorno). Posições da arte da cabine (diablo_cockpit.py).
O jogo desenha os ponteiros laranja. Saída em 4 px por pixel do jogo.
Uso: python3 tools/ref/diablo_gauges.py <src/assets/cockpit>
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
K = 12
KO = 4
PY = 8 / 7
X0, Y0, X1, Y1 = 26, 12, 206, 80
FB = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
FR = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
INK = (24, 24, 26)
FACE = (240, 240, 236)
SPEED = dict(x=106.4, y=45.9, r=21.7, a0=125, sweep=290, max=360)
TACH = dict(x=153.7, y=45.9, r=21.7, a0=125, sweep=290, max=90)
SMALL = [dict(x=44.1, y=61.3, r=10.6, labels=['50', '80', '120', '150'], unit='°C'),
         dict(x=70.4, y=61.3, r=10.6, labels=['0', '½', '1'], unit=''),
         dict(x=188.1, y=60.4, r=10.6, labels=['0', '2', '4', '6', '8', '10'], unit='bar')]
A0S, A1S = 205, 335
W, H = (X1 - X0) * K, (Y1 - Y0) * K
LABELS = []


def P(x, y):
    return ((x - X0) * K, (y - Y0) * K)


def at(g, ang, rr):
    x, y = P(g['x'], g['y'])
    a = math.radians(ang)
    return (x + math.cos(a) * rr * K, y + math.sin(a) * rr * K * PY)


def ell(d, g, r, **kw):
    x, y = P(g['x'], g['y'])
    d.ellipse([x - r * K, y - r * K * PY, x + r * K, y + r * K * PY], **kw)


def tick(d, g, ang, r0, r1, w, col=INK):
    d.line([at(g, ang, r0), at(g, ang, r1)], fill=col, width=max(1, int(round(w * K))))


def label(s, x, y, size, font=FB, squeeze=0.9):
    LABELS.append((s, x / K, y / K, size, font, squeeze))


def draw_labels(im):
    for s, cx, cy, size, font, sq in LABELS:
        f = ImageFont.truetype(font, int(round(size * KO * 4)))
        d0 = ImageDraw.Draw(Image.new('L', (4, 4)))
        bx0, by0, bx1, by1 = d0.textbbox((0, 0), s, font=f)
        lay = Image.new('L', (bx1 - bx0 + 8, by1 - by0 + 8), 0)
        ImageDraw.Draw(lay).text((4 - bx0, 4 - by0), s, font=f, fill=255)
        lay = lay.resize((max(1, int(lay.width * sq / 4)), max(1, int(lay.height / 4))), Image.LANCZOS)
        im.paste((*INK, 255), (int(round(cx * KO - lay.width / 2)), int(round(cy * KO - lay.height / 2))), lay)


def shield(im, x, y, s):
    br = json.load(open(os.path.join(ROOT, 'src/assets/brands.json'), encoding='utf-8'))
    rows = br['brands']['toro']['logo']
    a = np.zeros((len(rows), len(rows[0])), np.uint8)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.':
                a[j, i] = 255
    big = np.array(Image.fromarray(a).resize((s, s), Image.NEAREST)) > 0
    import cv2
    k = max(1, s // 12)
    edge = big & ~cv2.erode(big.astype(np.uint8), np.ones((2 * k + 1, 2 * k + 1), np.uint8)).astype(bool)
    im.paste(INK, (int(x - s / 2), int(y - s / 2)), Image.fromarray((edge * 255).astype(np.uint8)))


def bezel(d, al, g, r):
    ell(d, g, r + 4.2, fill=(14, 14, 16))
    ell(d, g, r + 0.9, fill=(52, 52, 58))
    ell(d, g, r, fill=FACE)
    x, y = P(g['x'], g['y'])
    ImageDraw.Draw(al).ellipse([x - (r + 4.2) * K, y - (r + 4.2) * K * PY, x + (r + 4.2) * K, y + (r + 4.2) * K * PY], fill=255)


def big(im, d, al, g, majors, minors, step, bands=()):
    bezel(d, al, g, g['r'])
    fr = lambda v: g['a0'] + g['sweep'] * v / g['max']
    for v0, v1, col in bands:
        for k in range(60):
            v = v0 + (v1 - v0) * k / 59
            tick(d, g, fr(v), g['r'] - 2.2, g['r'] - 0.4, 0.8, col)
    v = 0.0
    while v <= g['max'] + 1e-6:
        if any(abs(v - m) < 1e-6 for m in majors):
            tick(d, g, fr(v), g['r'] - 3.0, g['r'] - 0.5, 0.55)
        else:
            tick(d, g, fr(v), g['r'] - 1.9, g['r'] - 0.5, 0.36)
        v += step
    for L in majors:
        x, y = at(g, fr(L), g['r'] - 6.0)
        label(str(L), x, y, 3.5 if L < 100 else 3.2, squeeze=0.9 if L < 100 else 0.78)
    for L in minors:
        x, y = at(g, fr(L), g['r'] - 5.6)
        label(str(L), x, y, 2.1, font=FR, squeeze=0.9)
    x, y = P(g['x'], g['y'] + g['r'] * 0.62 * PY)
    label('VDO', x, y + K * 2.2, 1.5)
    shield(im, x, y - K * 0.6, int(K * 3.4))


def small(im, d, al, g):
    bezel(d, al, g, g['r'])
    n = len(g['labels'])
    steps = (n - 1) * 2
    for i in range(steps + 1):
        a = A0S + (A1S - A0S) * i / steps
        tick(d, g, a, g['r'] - (2.0 if i % 2 == 0 else 1.4), g['r'] - 0.5, 0.42 if i % 2 == 0 else 0.3)
    for i, L in enumerate(g['labels']):
        a = A0S + (A1S - A0S) * i / (n - 1)
        x, y = at(g, a, g['r'] - 4.0)
        label(L, x, y + K * 0.9, 2.5 if len(g['labels']) < 5 else 2.2, squeeze=0.85)
    x, y = P(g['x'], g['y'] + g['r'] * 0.55 * PY)
    label('VDO', x, y, 1.2)
    if g['unit']:
        x, y = P(g['x'], g['y'] - g['r'] * 0.2 * PY)
        label(g['unit'], x, y, 1.8, font=FR)


def main():
    out = sys.argv[1]
    im = Image.new('RGB', (W, H), FACE)
    al = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    big(im, d, al, SPEED, list(range(40, 361, 40)), list(range(20, 341, 40)), 10)
    big(im, d, al, TACH, list(range(0, 91, 10)), [], 5, ((70, 75, (232, 196, 24)), (75, 90, (176, 26, 22))))
    # hodômetros (janelas pretas; os números o jogo desenha) e textos
    for (dy, w) in ((-0.42, 12.4), (0.22, 8.4)):
        x, y = P(SPEED['x'] - w / 2, SPEED['y'] + SPEED['r'] * dy * PY)
        d.rectangle([x, y, x + w * K, y + 3.6 * K], fill=(20, 20, 22))
    x, y = P(SPEED['x'], SPEED['y'] + SPEED['r'] * 0.42 * PY)
    label('Km/h', x, y, 1.7, font=FR)
    x, y = P(TACH['x'], TACH['y'] + TACH['r'] * 0.36 * PY)
    label('min-1 x 100', x, y, 1.6, font=FR)
    for g in SMALL:
        small(im, d, al, g)
    im = im.convert('RGBA')
    im.putalpha(al)
    fin = im.resize((W * KO // K, H * KO // K), Image.LANCZOS)
    draw_labels(fin)
    fin.save(os.path.join(out, 'diablo-cluster.png'), optimize=True)
    print('quadro', (X0, Y0), (X1 - X0, Y1 - Y0))


if __name__ == '__main__':
    main()
