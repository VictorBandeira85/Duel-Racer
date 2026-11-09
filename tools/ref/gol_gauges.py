"""Quadro VDO do Gaúcho GTI (Gol GTI 1993), copiando a foto do quadro real que o Victor mandou:
fundo grafite fosco, números e marcações laranja em grotesca negrita, velocímetro 20-240 km/h
(número a cada 20, marcações a cada 5) com "vdo / km", hodômetro, parcial com o botão e "km/h";
conta-giros 1-7 (x1000) só no arco de cima, faixa hachurada laranja/vermelha de 6,25 a 7,25, "VDO" e
"1/min x 1000", e embaixo, dentro dele, temperatura (esquerda) e combustível (direita) com ícones;
no meio, o "GTI" prateado com o i vermelho, as luzes-espia em duas fileiras e o relógio de cristal
líquido (as horas o jogo escreve). Cobre o quadro inteiro da arte (os números errados somem).
O jogo desenha os ponteiros brancos. Saída em 4 px por pixel do jogo.
Uso: python3 tools/ref/gol_gauges.py <src/assets/cockpit>
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

K, KO, PY = 12, 4, 8 / 7
X0, Y0, X1, Y1 = 69, 31, 187, 78          # quadro na arte (gol_cockpit2.py: 69,2..186,8 x 31,1..77,7)
FB = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
FR = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
FACE, EDGE = (44, 44, 46), (18, 18, 20)
INK = (240, 108, 44)
WHITE = (226, 226, 222)
SPEED = dict(x=93.6, y=54.4, r=19.6, a0=112.5, sweep=293.5, max=240)
TACH = dict(x=154.5, y=54.4, r=19.6, a0=170.7, sweep=218.7, max=8)
TEMP = dict(x=150.5, y=63.4, r=8.6, a0=160, a1=110)    # pivô e arco (frio -> quente)
FUEL = dict(x=158.5, y=63.4, r=8.6, a0=20, a1=70)      # cheio -> vazio
MID = (115.3, 132.3)
W, H = (X1 - X0) * K, (Y1 - Y0) * K
LABELS = []


def P(x, y):
    return ((x - X0) * K, (y - Y0) * K)


def at(g, ang, rr):
    x, y = P(g['x'], g['y'])
    a = math.radians(ang)
    return (x + math.cos(a) * rr * K, y + math.sin(a) * rr * K * PY)


def tick(d, g, ang, r0, r1, w, col=INK):
    d.line([at(g, ang, r0), at(g, ang, r1)], fill=col, width=max(1, int(round(w * K))))


def label(s, x, y, size, font=FB, squeeze=0.88, col=INK):
    LABELS.append((s, x / K, y / K, size, font, squeeze, col))


def draw_labels(im):
    for s, cx, cy, size, font, sq, col in LABELS:
        f = ImageFont.truetype(font, int(round(size * KO * 4)))
        bx0, by0, bx1, by1 = ImageDraw.Draw(Image.new('L', (4, 4))).textbbox((0, 0), s, font=f)
        lay = Image.new('L', (bx1 - bx0 + 8, by1 - by0 + 8), 0)
        ImageDraw.Draw(lay).text((4 - bx0, 4 - by0), s, font=f, fill=255)
        lay = lay.resize((max(1, int(lay.width * sq / 4)), max(1, int(lay.height / 4))), Image.LANCZOS)
        im.paste(col + (255,), (int(round(cx * KO - lay.width / 2)), int(round(cy * KO - lay.height / 2))), lay)


def speed(d):
    g = SPEED
    fr = lambda v: g['a0'] + g['sweep'] * v / g['max']
    for v in range(20, 241, 5):
        if v % 20 == 0:
            tick(d, g, fr(v), g['r'] - 3.0, g['r'] - 0.3, 0.75)
        elif v % 10 == 0:
            tick(d, g, fr(v), g['r'] - 2.2, g['r'] - 0.3, 0.55)
        else:
            tick(d, g, fr(v), g['r'] - 1.5, g['r'] - 0.3, 0.45)
    for v in range(20, 241, 20):
        x, y = at(g, fr(v), g['r'] - 6.2)
        label(str(v), x, y, 3.4, squeeze=0.8 if v >= 100 else 0.9)
    x, y = P(g['x'], g['y'])
    label('vdo', x, y - K * 12.6, 1.3, FR, col=WHITE)
    label('km', x, y - K * 10.4, 1.6, FR, col=WHITE)
    label('km/h', x, y + K * 11.6, 1.9, FR, col=WHITE)
    for bx, by, bw in ((-6.0, -8.6, 12), (-4.2, 4.4, 8.4)):   # janelas do hodômetro e do parcial
        x0, y0 = P(g['x'] + bx, g['y'] + by)
        d.rectangle([x0 - K * 0.3, y0 - K * 0.3, x0 + (bw + 0.3) * K, y0 + 3.8 * K], fill=(10, 10, 12))
    for sx in (-1, 1):  # parafusos do eixo
        cx, cy = P(g['x'] + sx * 4.6, g['y'] - 1.2)
        d.ellipse([cx - K * 0.6, cy - K * 0.6, cx + K * 0.6, cy + K * 0.6], fill=(16, 16, 18))
    cx, cy = P(g['x'], g['y'] + g['r'] * 0.84 * PY)   # botão de zerar o parcial
    d.ellipse([cx - K * 1.0, cy - K * 1.0, cx + K * 1.0, cy + K * 1.0], fill=(20, 20, 22))
    d.ellipse([cx - K * 0.5, cy - K * 0.7, cx + K * 0.3, cy - K * 0.1], fill=(110, 110, 114))


def tach(d):
    g = TACH
    fr = lambda v: g['a0'] + g['sweep'] * v / g['max']
    v = 0.5
    while v <= 7.5 + 1e-6:
        if 6.25 <= v <= 7.25:
            pass
        elif abs(v - round(v)) < 1e-6:
            tick(d, g, fr(v), g['r'] - 3.0, g['r'] - 0.3, 0.75)
        else:
            tick(d, g, fr(v), g['r'] - 1.6, g['r'] - 0.3, 0.45)
        v += 0.25
    # faixa vermelha hachurada
    for k in range(40):
        vv = 6.25 + k / 40
        tick(d, g, fr(vv), g['r'] - 2.8, g['r'] - 0.3, 0.3, INK if k % 4 < 2 else (200, 34, 24))
    for n in range(1, 8):
        x, y = at(g, fr(n), g['r'] - 6.0)
        label(str(n), x, y, 3.6)
    x, y = P(g['x'], g['y'])
    label('VDO', x, y - K * 9.0, 1.4, FR, col=WHITE)
    label('1/min x 1000', x, y + K * 6.4, 1.9, FR, squeeze=0.82, col=WHITE)
    cx, cy = P(g['x'] + 4.4, g['y'] - 0.6)
    d.ellipse([cx - K * 0.55, cy - K * 0.55, cx + K * 0.55, cy + K * 0.55], fill=(16, 16, 18))
    # temperatura e combustível: arcos curtos embaixo, com o trecho de alerta laranja
    for gg, warn in ((TEMP, 'hot'), (FUEL, 'low')):
        a0, a1 = gg['a0'], gg['a1']
        for i in range(5):
            a = a0 + (a1 - a0) * i / 4
            tick(d, gg, a, gg['r'] - (1.8 if i in (0, 4) else 1.2), gg['r'] + 0.2, 0.55)
        for k in range(4):
            a = a1 - (a1 - a0) * 0.16 * k / 3
            tick(d, gg, a, gg['r'] - 2.2, gg['r'] + 0.2, 0.32)
    # ícones: termômetro com ondas e bomba de gasolina
    tx, ty = P(TACH['x'] - 3.2, TACH['y'] + 16.6)
    u = K * 0.5
    d.rectangle([tx - 0.35 * u, ty - 2.2 * u, tx + 0.35 * u, ty + 0.4 * u], fill=WHITE)
    d.ellipse([tx - 0.9 * u, ty, tx + 0.9 * u, ty + 1.6 * u], fill=WHITE)
    for k in (0, 1):
        d.line([(tx - 2.4 * u, ty + (0.6 + k * 0.9) * u), (tx + 2.4 * u, ty + (0.6 + k * 0.9) * u)], fill=WHITE, width=max(1, int(0.3 * u)))
    fx, fy = P(TACH['x'] + 3.4, TACH['y'] + 16.6)
    d.rectangle([fx - 1.4 * u, fy - 1.8 * u, fx + 0.6 * u, fy + 1.6 * u], fill=WHITE)
    d.rectangle([fx - 1.0 * u, fy - 1.4 * u, fx + 0.2 * u, fy - 0.5 * u], fill=FACE)
    d.line([(fx + 0.6 * u, fy - 0.8 * u), (fx + 1.5 * u, fy - 0.2 * u), (fx + 1.5 * u, fy + 1.0 * u)], fill=WHITE, width=max(1, int(0.35 * u)))


def middle(d):
    x0, x1 = MID
    a, b = P(x0, 34.0), P(x1, 75.0)
    d.rectangle([a[0], a[1], b[0], b[1]], fill=(30, 30, 32))
    d.rectangle([a[0], a[1], b[0], a[1] + K * 0.4], fill=(58, 58, 60))
    # quadro do GTI
    p0, p1 = P(x0 + 2.5, 35.6), P(x1 - 2.5, 41.0)
    d.rectangle([p0[0], p0[1], p1[0], p1[1]], fill=(22, 22, 24))
    cx = (x0 + x1) / 2
    label('GT', P(cx - 1.2, 0)[0], P(0, 38.3)[1], 3.6, FB, 0.86, col=(214, 216, 222))
    label('I', P(cx + 1.9, 0)[0], P(0, 38.3)[1], 3.6, FB, 0.86, col=(222, 40, 28))
    # luzes-espia apagadas: duas fileiras de cinco
    cols = [(60, 110, 50), (200, 190, 120), (120, 30, 30), (120, 30, 30), (30, 50, 120)]
    cols2 = [(110, 30, 26), (190, 170, 90), (120, 30, 30), (120, 30, 30), (26, 26, 28)]
    for row, cc in ((46.6, cols), (50.6, cols2)):
        for i, col in enumerate(cc):
            x = x0 + 2.6 + i * (x1 - x0 - 5.2) / 4
            c0 = P(x, row)
            d.ellipse([c0[0] - K * 1.25, c0[1] - K * 1.25 * PY, c0[0] + K * 1.25, c0[1] + K * 1.25 * PY], fill=(12, 12, 14))
            d.ellipse([c0[0] - K * 0.9, c0[1] - K * 0.9 * PY, c0[0] + K * 0.9, c0[1] + K * 0.9 * PY], fill=col)
    label('<>', P(x0 + 3.0, 0)[0], P(0, 43.4)[1], 1.5, FR, col=WHITE)
    label('oil', P(x1 - 3.0, 0)[0], P(0, 43.4)[1], 1.4, FR, col=WHITE)
    # visor do relógio (cristal líquido)
    q0, q1 = P(x0 + 2.0, 60.2), P(x1 - 2.0, 66.4)
    d.rectangle([q0[0] - K * 0.5, q0[1] - K * 0.5, q1[0] + K * 0.5, q1[1] + K * 0.5], fill=(14, 14, 16))
    d.rectangle([q0[0], q0[1], q1[0], q1[1]], fill=(150, 156, 128))
    for sx in (x0 + 4, x1 - 4):  # parafusos
        c0 = P(sx, 71.5)
        d.ellipse([c0[0] - K * 0.7, c0[1] - K * 0.7, c0[0] + K * 0.7, c0[1] + K * 0.7], fill=(70, 70, 74))


def main():
    out = sys.argv[1]
    im = Image.new('RGB', (W, H), FACE)
    al = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    # o quadro inteiro (cantos arredondados), mais escuro nas bordas de cima e de baixo
    ImageDraw.Draw(al).rounded_rectangle([K * 0.4, K * 0.4, W - K * 0.4, H - K * 0.4], radius=K * 4, fill=255)
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=K * 4, fill=EDGE)
    d.rounded_rectangle([K * 0.9, K * 0.9, W - K * 0.9, H - K * 0.9], radius=K * 3.6, fill=FACE)
    for i in range(int(4 * K)):
        t = 1 - i / (4 * K)
        d.line([(K, K + i), (W - K, K + i)], fill=tuple(int(c * (1 - 0.35 * t)) for c in FACE))
    speed(d)
    tach(d)
    middle(d)
    fin = im.convert('RGBA')
    fin.putalpha(al)
    fin = fin.resize((W * KO // K, H * KO // K), Image.LANCZOS)
    draw_labels(fin)
    fin.save(os.path.join(out, 'br-golgti-cluster.png'), optimize=True)
    print('quadro', (X0, Y0), (X1 - X0, Y1 - Y0))


if __name__ == '__main__':
    main()
