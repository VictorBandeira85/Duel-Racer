"""Quadro VDO do Toro V12 (Lamborghini Diablo), copiando a foto do quadro real que o Victor enviou:
fundos brancos, marcações e números pretos em grotesca negrita, velocímetro 20-360 km/h (números
grandes em 20, 40, 80 e de 160 em diante de 40 em 40, pequenos nos outros) com os hodômetros e "Km",
conta-giros 0-90 (min-1 x 100) varrendo 260° com faixa amarela de 68 a 75 e vermelha de 75 a 90, e
quatro relógios pequenos em escada como no carro: pressão do óleo 0-10 (em cima) e temperatura do
óleo 50-150 °C (embaixo) à esquerda, temperatura da água 40-120 °C (em cima) e combustível 0-½-1
(embaixo) à direita, com o eixo abaixo do centro e arco de 90°. "VDO" em cada um e o touro trocado
pelo escudo da Toro (só contorno). Os relógios pequenos da arte (outras posições) são apagados com a
cor do fundo do painel.
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
X0, Y0, X1, Y1 = 26, 12, 228, 80
FB = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
FR = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
INK = (24, 24, 26)
FACE = (240, 240, 236)
SPEED = dict(x=106.4, y=45.9, r=21.7, a0=121, sweep=289, max=360)
TACH = dict(x=153.7, y=45.9, r=21.7, a0=140, sweep=260, max=90)
RS = 9.5  # raio dos pequenos; o eixo fica meio raio abaixo do centro
SMALL = [dict(x=67.9, y=42.0, labels=['0', '2', '4', '6', '8', '10'], red=(0, 0.06), icon='oil', unit=''),
         dict(x=49.1, y=59.4, labels=['50', '80', '120', '150'], red=(0, 0.08), icon='oil', unit='°C'),
         dict(x=192.2, y=42.0, labels=['40', '80', '100', '120'], red=(0.92, 1), icon='water', unit='°C'),
         dict(x=211.0, y=59.4, labels=['0', '½', '1'], red=None, icon='fuel', unit='')]
OLD = [(44.1, 61.3), (70.4, 61.3), (188.1, 60.4)]  # relógios pequenos da arte, apagados
RECESS = (23, 19, 36)
A0S, A1S = 225, 315
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


def bezel(d, al, g, r, th=4.2):
    ell(d, g, r + th, fill=(14, 14, 16))
    ell(d, g, r + 0.9, fill=(52, 52, 58))
    ell(d, g, r, fill=FACE)
    x, y = P(g['x'], g['y'])
    ImageDraw.Draw(al).ellipse([x - (r + th) * K, y - (r + th) * K * PY, x + (r + th) * K, y + (r + th) * K * PY], fill=255)


def dot(d, g, dx, dy, rr, col=INK):
    ell(d, dict(x=g['x'] + dx, y=g['y'] + dy * PY), rr, fill=col)


def big(im, d, al, g, majors, minors, step, major_step, bands=(), dots=0.38):
    bezel(d, al, g, g['r'])
    fr = lambda v: g['a0'] + g['sweep'] * v / g['max']
    for v0, v1, col in bands:
        for k in range(60):
            v = v0 + (v1 - v0) * k / 59
            tick(d, g, fr(v), g['r'] - 2.6, g['r'] - 0.4, 0.8, col)
    v = float(g.get('min', 0))
    while v <= g['max'] + 1e-6:
        if abs(v / major_step - round(v / major_step)) < 1e-6:
            tick(d, g, fr(v), g['r'] - 3.2, g['r'] - 0.5, 0.75)
        else:
            tick(d, g, fr(v), g['r'] - 1.9, g['r'] - 0.5, 0.5)
        v += step
    for L in majors:
        x, y = at(g, fr(L), g['r'] - 6.0)
        label(str(L), x, y, 3.5 if L < 100 else 3.2, squeeze=0.9 if L < 100 else 0.78)
    for L in minors:
        x, y = at(g, fr(L), g['r'] - 5.6)
        label(str(L), x, y, 2.1, font=FR, squeeze=0.9)
    for sx in (-1, 1):
        dot(d, g, sx * dots * g['r'], 0, 0.75)
    x, y = P(g['x'], g['y'] + g['r'] * 0.66 * PY)
    label('VDO', x, y + K * 2.2, 1.5)
    shield(im, x, y - K * 0.6, int(K * 3.4))


def icon(d, cx, cy, kind):
    """ícones pretos pequenos do topo (almotolia do óleo, termômetro com ondas, bomba de gasolina)"""
    u = K * 0.45
    if kind == 'oil':
        d.polygon([(cx - 2.4 * u, cy - 0.4 * u), (cx + 0.8 * u, cy - 0.4 * u), (cx + 2.6 * u, cy - 1.6 * u), (cx + 1.2 * u, cy + 1.2 * u), (cx - 2.4 * u, cy + 1.2 * u)], fill=INK)
        d.rectangle([cx - 1.4 * u, cy - 1.4 * u, cx - 0.4 * u, cy - 0.4 * u], fill=INK)
        d.ellipse([cx + 2.6 * u, cy + 0.6 * u, cx + 3.2 * u, cy + 1.4 * u], fill=INK)
    elif kind == 'water':
        d.rectangle([cx - 0.35 * u, cy - 2.2 * u, cx + 0.35 * u, cy + 0.6 * u], fill=INK)
        d.ellipse([cx - 0.9 * u, cy + 0.2 * u, cx + 0.9 * u, cy + 1.6 * u], fill=INK)
        for k in (0, 1):
            d.line([(cx - 2.6 * u, cy + (0.4 + k) * u), (cx - 1.4 * u, cy + (0.2 + k) * u), (cx + 1.4 * u, cy + (0.6 + k) * u), (cx + 2.6 * u, cy + (0.4 + k) * u)], fill=INK, width=max(1, int(0.35 * u)))
    else:
        d.rectangle([cx - 1.6 * u, cy - 2 * u, cx + 0.6 * u, cy + 1.6 * u], fill=INK)
        d.rectangle([cx - 1.1 * u, cy - 1.5 * u, cx + 0.1 * u, cy - 0.5 * u], fill=FACE)
        d.line([(cx + 0.6 * u, cy - 0.8 * u), (cx + 1.6 * u, cy - 0.2 * u), (cx + 1.6 * u, cy + 1.0 * u)], fill=INK, width=max(1, int(0.4 * u)))


def small(im, d, al, g):
    """relógio pequeno do Diablo: eixo meio raio abaixo do centro, marcações e números num arco de
    90° (225° a 315°) que acompanha a borda de cima"""
    g = dict(g, r=RS)
    bezel(d, al, g, RS, 3.2)
    pv = dict(x=g['x'], y=g['y'] + 0.5 * RS * PY)

    def rim(ang):  # distância do eixo até a borda do mostrador nessa direção (unidades reais)
        ux, uy = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        b = uy * 0.5 * RS
        return -b + math.sqrt(b * b - (0.25 * RS * RS - RS * RS))
    n = len(g['labels'])
    steps = (n - 1) * 2
    fr = lambda u: A0S + (A1S - A0S) * u
    if g['red']:
        u0, u1 = g['red']
        for k in range(24):
            a = fr(u0 + (u1 - u0) * k / 23)
            e = rim(a) - 0.5
            tick(d, pv, a, e - 2.2, e, 0.7, (176, 26, 22))
    for i in range(steps + 1):
        a = fr(i / steps)
        e = rim(a) - 0.5
        tick(d, pv, a, e - (2.2 if i % 2 == 0 else 1.4), e, 0.6 if i % 2 == 0 else 0.45)
    for i, L in enumerate(g['labels']):
        a = fr(i / (n - 1))
        x, y = at(pv, a, rim(a) - 4.3)
        label(L, x, y, 2.6 if n < 5 else 2.3, squeeze=0.85)
    for sx in (-1, 1):
        dot(d, pv, sx * 0.62 * RS, 0.1 * RS, 0.6)
    x, y = P(pv['x'], pv['y'] + 0.42 * RS * PY)
    label('VDO', x, y, 1.2)
    x, y = P(g['x'] + (1.6 if g['unit'] else 0), g['y'] - 0.62 * RS * PY)
    icon(d, x, y, g['icon'])
    if g['unit']:
        label(g['unit'], x - K * 3.4, y, 1.7, font=FR)


def main():
    out = sys.argv[1]
    im = Image.new('RGB', (W, H), FACE)
    al = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    # relógios pequenos da arte (fora das posições novas): cor do fundo do painel
    for ox, oy in OLD:
        ell(d, dict(x=ox, y=oy), 14.0, fill=RECESS)
        x, y = P(ox, oy)
        ImageDraw.Draw(al).ellipse([x - 14 * K, y - 14 * K * PY, x + 14 * K, y + 14 * K * PY], fill=255)
    SPEED['min'] = 10
    big(im, d, al, SPEED, [20, 40, 80, 160, 200, 240, 280, 320, 360], [60, 100, 120, 140, 180, 220, 260, 300, 340], 10, 20)
    big(im, d, al, TACH, list(range(0, 91, 10)), [], 2.5, 10, ((68, 75, (232, 196, 24)), (75, 90, (176, 26, 22))), dots=0.32)
    # botão do parcial, embaixo do velocímetro
    dot(d, SPEED, 0, SPEED['r'] * 0.93, 0.9)
    # hodômetros (janelas pretas; os números o jogo desenha) e textos
    for (dy, w) in ((-0.42, 12.4), (0.22, 8.4)):
        x, y = P(SPEED['x'] - w / 2, SPEED['y'] + SPEED['r'] * dy * PY)
        d.rectangle([x, y, x + w * K, y + 3.6 * K], fill=(20, 20, 22))
    x, y = P(SPEED['x'], SPEED['y'] + SPEED['r'] * 0.42 * PY)
    label('Km/h', x, y, 1.7, font=FR)
    x, y = P(SPEED['x'], SPEED['y'] - SPEED['r'] * 0.58 * PY)
    label('Km', x, y, 1.6, font=FR)
    x, y = P(TACH['x'], TACH['y'] + TACH['r'] * 0.3 * PY)
    label('min-1', x, y, 1.8, font=FR)
    label('x 100', x, y + K * 2.0, 1.8, font=FR)
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
