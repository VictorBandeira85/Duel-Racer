"""Quadro de instrumentos da Furia TR (Ferrari Testarossa) em alta resolução, copiando a foto do
quadro real (Veglia "electronic") que o Victor enviou:
- três painéis quadrados cinza-chumbo: velocímetro à esquerda, pressão do óleo e temperatura da
  água empilhados no meio, conta-giros à direita
- mostradores pretos, marcações e números LARANJA (iluminação laranja), números inclinados e
  quadrados; velocímetro 0-320 km/h numerado de 20 em 20, conta-giros 0-100 (x 100) de 10 em 10
  com a faixa vermelha de 70 a 100; óleo 0-6-12 e água 60-90-120 °C com os ícones
- embaixo dos dois grandes, a lente escura com as luzes-espia apagadas (setas, farol, gasolina,
  bateria); o cavalinho vira o escudo da Fúria
Geometria tirada da arte da cabine (testarossa_cockpit.py). O jogo desenha só os ponteiros.
Gera duas versões: 4 px por pixel do jogo (RES 4) e 2 px (RES 2, números pequenos em fonte de pixels).
Uso: python3 tools/ref/testarossa_gauges.py <src/assets/cockpit>
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
K = 12                      # desenho em 12 px por pixel do jogo, reduzido para KO
PY = 8 / 7
X0, Y0, X1, Y1 = 63, 29, 200, 83
FONT = '/usr/share/fonts/truetype/freefont/FreeSansBoldOblique.ttf'
FONT_S = '/usr/share/fonts/truetype/freefont/FreeSansBoldOblique.ttf'
OR = (255, 128, 24)         # laranja dos números
ORD = (150, 70, 14)
RED = (232, 40, 24)
SPEED = dict(x=95.4, y=53.7, r=21, a0=135, sweep=270, max=320)
TACH = dict(x=166.1, y=53.7, r=21, a0=135, sweep=270, max=100)
OIL = dict(x=130.7, y=40.4, r=8.4, a0=205, a1=335)
WATER = dict(x=130.7, y=66.6, r=8.4, a0=205, a1=335)
PANELS = [(71.2, 30.4, 119.2, 81.7), (119.2, 30.4, 143.0, 54.5), (119.2, 54.5, 143.0, 81.7), (143.0, 30.4, 190.9, 81.7)]
W, H = (X1 - X0) * K, (Y1 - Y0) * K
KO = 4
LABELS = []
PIXFONT = {
    '0': ['111', '101', '101', '101', '111'], '1': ['1', '1', '1', '1', '1'], '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '001', '001'], '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
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


def tick(d, g, ang, r0, r1, w, col=OR):
    d.line([at(g, ang, r0), at(g, ang, r1)], fill=col, width=max(1, int(round(w * K))))


def label(s, cx, cy, size, squeeze=0.78, font=FONT, small_ok=True):
    # small_ok=False: some na versão de 2 px por pixel (não cabe sem encostar nos vizinhos)
    LABELS.append((s, cx / K, cy / K, size, squeeze, font, small_ok))


def draw_labels(im):
    for s, cx, cy, size, squeeze, font, small_ok in LABELS:
        px = size * KO  # corpo em pixels finais
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
                            im.putpixel((x0 + i, y0 + j), (*OR, 255))
                x0 += len(PIXFONT[ch][0]) + 1
            continue
        # desenha em 4x e reduz (inclinadas e condensadas, como no quadro)
        f = ImageFont.truetype(font, int(round(px * 4)))
        d0 = ImageDraw.Draw(Image.new('L', (4, 4)))
        bx0, by0, bx1, by1 = d0.textbbox((0, 0), s, font=f)
        lay = Image.new('L', (bx1 - bx0 + 8, by1 - by0 + 8), 0)
        ImageDraw.Draw(lay).text((4 - bx0, 4 - by0), s, font=f, fill=255)
        lay = lay.resize((max(1, int(lay.width * squeeze / 4)), max(1, int(lay.height / 4))), Image.LANCZOS)
        im.paste((*OR, 255), (int(round(x - lay.width / 2)), int(round(y - lay.height / 2))), lay)


def logo(size):
    br = json.load(open(os.path.join(ROOT, 'src/assets/brands.json'), encoding='utf-8'))
    pal = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in br['palette'].items()}
    rows = br['brands']['furia']['logo']
    a = np.zeros((9, 9, 4), np.uint8)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.':
                c = pal[ch]
                # no quadro o escudo é só o contorno laranja aceso
                a[j, i] = (*OR, 255) if ch != 'K' else (20, 20, 20, 255)
    return Image.fromarray(a, 'RGBA').resize((size, size), Image.NEAREST)


def big_dial(im, d, g, labels, minor, major, red_from=None, texts=()):
    # aro escuro, fundo preto
    ell(d, g['x'], g['y'], g['r'] + 1.3, fill=(12, 12, 13))
    ell(d, g['x'], g['y'], g['r'] + 0.6, fill=(40, 40, 42))
    ell(d, g['x'], g['y'], g['r'], fill=(16, 16, 17))
    fr = lambda v: g['a0'] + g['sweep'] * v / g['max']
    if red_from is not None:  # faixa vermelha fina por fora das marcações
        for k in range(80):
            v = red_from + (g['max'] - red_from) * k / 79
            tick(d, g, fr(v), g['r'] - 1.1, g['r'] - 0.25, 0.7, RED)
    v = 0.0
    while v <= g['max'] + 1e-6:
        if abs(v / major - round(v / major)) < 1e-6:
            tick(d, g, fr(v), g['r'] - 4.4, g['r'] - 0.9, 0.75)  # marcações compridas e grossas, como na foto
        else:
            tick(d, g, fr(v), g['r'] - 3.2, g['r'] - 0.9, 0.45)
        v += minor
    for L in labels:
        x, y = at(g, fr(L), g['r'] - (8.4 if L >= 100 else 7.6))
        label(str(L), x, y, 3.5 if L >= 100 else 4.0, squeeze=0.6 if L >= 100 else 0.76, small_ok=L < 100 or L % 40 == 0 or g is TACH)
    # lente das luzes-espia embaixo (crescente escuro)
    x, y = P(g['x'], g['y'])
    rr = g['r'] * K
    d.chord([x - rr * 0.98, y - rr * PY * 0.98, x + rr * 0.98, y + rr * PY * 0.98], 58, 122, fill=(30, 30, 32))
    d.line([x - rr * 0.52, y + rr * PY * 0.835, x + rr * 0.52, y + rr * PY * 0.835], fill=(70, 70, 74), width=max(1, K // 5))
    for i, kind in enumerate(texts):
        cx = x + (i - 1) * rr * 0.32
        cy = y + rr * PY * 0.9
        s = K * 0.9
        col = (78, 80, 84)
        d.ellipse([cx - s * 1.25, cy - s * 1.25, cx + s * 1.25, cy + s * 1.25], fill=(52, 54, 58))
        if kind == '<':
            d.polygon([(cx - s * 0.8, cy), (cx + s * 0.5, cy - s * 0.7), (cx + s * 0.5, cy + s * 0.7)], fill=col)
        elif kind == '>':
            d.polygon([(cx + s * 0.8, cy), (cx - s * 0.5, cy - s * 0.7), (cx - s * 0.5, cy + s * 0.7)], fill=col)
        else:
            d.rectangle([cx - s * 0.6, cy - s * 0.5, cx + s * 0.6, cy + s * 0.5], outline=col, width=max(1, K // 6))


def small_dial(d, g, labels, icon):
    ell(d, g['x'], g['y'], g['r'] + 0.9, fill=(12, 12, 13))
    ell(d, g['x'], g['y'], g['r'] + 0.4, fill=(40, 40, 42))
    ell(d, g['x'], g['y'], g['r'], fill=(16, 16, 17))
    # metade de baixo: lente mais clara com o ícone
    x, y = P(g['x'], g['y'])
    rr = g['r'] * K
    d.chord([x - rr, y - rr * PY, x + rr, y + rr * PY], 8, 172, fill=(34, 34, 36))
    a0, a1 = g['a0'], g['a1']
    for i in range(5):
        a = a0 + (a1 - a0) * i / 4
        big = i % 2 == 0
        tick(d, g, a, g['r'] - (1.8 if big else 1.3), g['r'] - 0.6, 0.42 if big else 0.32)
    for i, L in enumerate(labels):
        a = a0 + (a1 - a0) * i / (len(labels) - 1)
        lx, ly = at(g, a, g['r'] - 4.0)
        label(L, lx, ly + K * 1.3, 3.3, squeeze=0.74, small_ok=not (len(labels) == 3 and i == 1 and len(labels[2]) > 2))
    ix, iy = x, y + rr * PY * 0.5
    s = K * 0.9
    if icon == 'oil':
        d.polygon([(ix - s * 1.6, iy - s * 0.3), (ix + s * 0.6, iy - s * 0.3), (ix + s * 1.6, iy - s * 0.8), (ix + s * 0.9, iy + s * 0.5), (ix - s * 1.6, iy + s * 0.5)], fill=OR)
    else:
        d.rectangle([ix - s * 0.22, iy - s * 1.1, ix + s * 0.22, iy + s * 0.3], fill=OR)
        for k in range(3):
            d.line([ix - s * (1.4 - k * 0.15), iy + s * (0.5 + k * 0.35), ix + s * (1.4 - k * 0.15), iy + s * (0.5 + k * 0.35)], fill=OR, width=max(1, K // 6))


def build(out):
    im = Image.new('RGB', (W, H), (14, 14, 15))
    d = ImageDraw.Draw(im)
    alpha = Image.new('L', (W, H), 0)
    da = ImageDraw.Draw(alpha)
    for (a, b, c, e) in PANELS:
        x0, y0 = P(a + 0.5, b + 0.5)
        x1, y1 = P(c - 0.5, e - 0.5)
        # só os painéis (com 1/2 px escuro em volta) cobrem a arte: a moldura curva é a da arte
        da.rectangle(list(P(a, b)) + list(P(c, e)), fill=255)
        d.rectangle([x0, y0, x1, y1], fill=(40, 40, 43))
        d.line([x0, y0, x1, y0], fill=(58, 58, 62), width=max(1, K // 5))
    big_dial(im, d, SPEED, list(range(0, 321, 20)), 10, 20, None, ('<', 'o', '>'))
    big_dial(im, d, TACH, list(range(0, 101, 10)), 5, 10, 70, ('o', 'o', 'o'))
    # textos dos grandes
    for g, s, s2 in [(SPEED, 'electronic', 'km/h'), (TACH, 'electronic', 'x 100')]:
        x, y = P(g['x'], g['y'] - g['r'] * 0.36 * PY)
        label(s, x, y, 1.7, squeeze=1, font=FONT_S)
        x, y = P(g['x'], g['y'] + g['r'] * 0.5 * PY)
        label(s2, x, y, 1.8, squeeze=1, font=FONT_S)
    small_dial(d, OIL, ['0', '6', '12'], 'oil')
    small_dial(d, WATER, ['60', '90', '120'], 'temp')
    x, y = P(WATER['x'] - WATER['r'] * 0.48, WATER['y'] + WATER['r'] * 0.5 * PY)
    label('°C', x, y, 1.8, squeeze=1, font=FONT_S)  # na lente de baixo, ao lado do ícone
    # escudo da Fúria (no lugar do cavalinho) abaixo do km/h e do x 100
    for g in (SPEED, TACH):
        lg = logo(int(K * 2.6))
        x, y = P(g['x'], g['y'] + g['r'] * 0.68 * PY)
        im.paste(lg, (int(x - lg.width / 2), int(y - lg.height / 2)), lg)
    im = im.convert('RGBA')
    im.putalpha(alpha)
    fin = im.resize((W * KO // K, H * KO // K), Image.LANCZOS)
    draw_labels(fin)
    name = 'tr-cluster.png' if KO == 4 else 'tr-cluster-2x.png'
    fin.save(os.path.join(out, name), optimize=True)


def main():
    global KO
    out = sys.argv[1]
    for KO in (4, 2):
        LABELS.clear()
        build(out)
    print('quadro', (X0, Y0), 'tamanho', (X1 - X0, Y1 - Y0))


if __name__ == '__main__':
    main()
