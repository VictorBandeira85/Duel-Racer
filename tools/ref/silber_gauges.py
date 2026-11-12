"""Quadro do Silber 95 (Porsche 959), copiando a FOTO DO QUADRO REAL que o Victor mandou para os três
mostradores do meio, e a arte dele para os dois de fora (que no carro de verdade não aparecem na foto):
- aros cromados finos em volta de cada mostrador (dentro do copo preto da arte), fundo preto fosco
- combinado do óleo (o segundo): à esquerda a temperatura do óleo (40 no losango, 60, 90, 120, 150, 170,
  faixa vermelha no fim), à direita a pressão do óleo (0 a 5); os eixos ficam escondidos atrás da ilha do
  meio (só as pontas dos ponteiros aparecem nas janelas), que leva o esquema das travas do diferencial,
  os ícones e as três luzes vermelhas (óleo, alerta e bateria), APAGADAS
- conta-giros 0-8 "1/min x1000" (29° por 1000, o 1 a 169,5°), marcações de 250 em 250 até 8,5, faixa
  laranja de 7,4 a 8,6, as duas setas verdes (apagadas), o farol alto e o ponto escuro; embaixo dele o
  MANÔMETRO DO TURBO 0-2,5 bar (0 / 0,5 / 1,5 / 2,5 escritos), com o eixo embaixo
- velocímetro 20-340 km/h (0,75° por km/h, o 20 a 150°): números grandes em 20, 60, 100, 140, 220, 260,
  300, 340 e pequenos nos outros 20, a marca laranja dos 50, "KM", hodômetro de seis tambores e parcial
  de quatro (o último branco), o botão do parcial embaixo
- o de fora à esquerda (da arte): combustível (arco da esquerda, bomba) e temperatura da água (arco da
  direita, termômetro), ilha lisa no meio
- o de fora à direita (da arte): pressão dos pneus (o 959 tinha o monitor), dianteiros à esquerda e
  traseiros à direita, 1,5 a 3,5 bar, coluna de luzes no meio (vermelha e âmbar), APAGADAS
Algarismos em grotesca negrita (Inter), sem marca nenhuma no mostrador (nada de "VDO"/"ELECTRONIC").
O jogo desenha os ponteiros laranja, os tambores, e acende as luzes (silberCluster em cockpit.ts).
Saídas (4 px por pixel do jogo; placa X0..X1 x Y0..Y1 em pixels do painel, linhas 8:7):
  959-cluster.png      de dia
  959-cluster-lit.png  aceso (noite e túnel): fundo preto, números, marcações e ícones em branco morno,
                       faixas laranja e vermelha acesas, aros apagados
  959-lamps.png        todas as luzes-espia acesas (o jogo copia a casa de cada uma)
Uso: python3 tools/ref/silber_gauges.py <src/assets/cockpit>
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

K, KO, PY = 12, 4, 8 / 7
X0, Y0, X1, Y1 = 12.0, 34.0, 244.0, 90.0       # placa (pixels do painel), cobre os cinco mostradores
W, H = int(round((X1 - X0) * K)), int(round((Y1 - Y0) * K))
FB = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'
FS = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
# centros e raios dos aros (pixels do painel: silber_cockpit.py)
G1 = dict(x=33.14, y=61.65, R=17.68)
OIL = dict(x=81.42, y=62.03, R=21.76)
TACH = dict(x=128.0, y=61.65, R=23.46)
SPEED = dict(x=177.64, y=62.03, R=23.12)
G5 = dict(x=220.82, y=63.59, R=19.72)
FACE = 0.885          # raio do fundo / raio do aro
TICK = 0.85           # ponta de fora das marcações
# escalas (graus, sentido horário a partir das 3h)
tach_a = lambda k: 140.5 + 29.0 * k
speed_a = lambda v: 150.0 + (v - 20) * 0.75
boost_a = lambda b: 217.5 + 42.0 * b
oilt_a = lambda i: 151.0 + 11.5 * i            # 40, 60, 90, 120, 150, 170 (escala de passo igual)
oilp_a = lambda p: 20.2 - 10.6 * p
BOOST = dict(dy=0.68, r=0.47)                  # manômetro do turbo: eixo abaixo do centro e raio (em R do conta-giros)
ISLE = 0.60                                    # ilha do meio do combinado do óleo e do da esquerda
# luzes (centro relativo ao mostrador, em R; raio em R; cor acesa)
LAMPS = [('oil', OIL, 0.0, -0.02, 0.095, (255, 60, 40)), ('warn', OIL, 0.0, 0.30, 0.095, (255, 60, 40)), ('batt', OIL, 0.0, 0.60, 0.09, (255, 60, 40)),
         ('left', TACH, -0.40, -0.60, 0.10, (60, 240, 80)), ('right', TACH, 0.40, -0.60, 0.10, (60, 240, 80)), ('beam', TACH, 0.0, -0.43, 0.10, (90, 150, 255)),
         ('tire', G5, 0.0, -0.60, 0.085, (255, 60, 40)), ('a1', G5, 0.0, -0.31, 0.08, (255, 170, 30)), ('a2', G5, 0.0, 0.31, 0.08, (255, 170, 30)),
         ('a3', G5, 0.0, 0.60, 0.08, (255, 170, 30))]
DAY = dict(face=(13, 13, 15), face2=(7, 7, 8), isle=(18, 18, 20), isle_edge=(46, 46, 50), ink=(236, 236, 230), orange=(246, 112, 34),
           red=(222, 46, 34), chrome=[(70, 70, 76), (205, 206, 212), (120, 121, 128), (232, 232, 236), (60, 60, 66)], cup=(4, 4, 5),
           lens_off=(64, 20, 18), green_off=(22, 52, 30), amber_off=(70, 44, 12), blue_off=(24, 30, 58), hub=(36, 36, 40), drum=(20, 20, 22),
           white=(226, 226, 220), screw=(52, 52, 56), icon=(220, 220, 214))
LIT = dict(face=(9, 9, 11), face2=(6, 6, 8), isle=(11, 11, 13), isle_edge=(24, 24, 27), ink=(252, 238, 204), orange=(255, 136, 50),
           red=(255, 70, 48), chrome=[(20, 20, 23), (52, 52, 58), (34, 34, 38), (60, 60, 66), (18, 18, 21)], cup=(3, 3, 4),
           lens_off=(30, 10, 9), green_off=(11, 24, 14), amber_off=(32, 20, 6), blue_off=(11, 14, 28), hub=(22, 22, 25), drum=(10, 10, 11),
           white=(150, 148, 140), screw=(24, 24, 27), icon=(240, 228, 196))


def P(x, y):
    return ((x - X0) * K, (y - Y0) * K)


def at(g, ang, rr, dx=0.0, dy=0.0):
    a = math.radians(ang)
    return P(g['x'] + dx + math.cos(a) * rr, g['y'] + (dy + math.sin(a) * rr) * PY)


def ell(d, g, rr, fill=None, outline=None, width=1, dx=0.0, dy=0.0):
    cx, cy = P(g['x'] + dx, g['y'] + dy * PY)
    d.ellipse([cx - rr * K, cy - rr * K * PY, cx + rr * K, cy + rr * K * PY], fill=fill, outline=outline, width=width)


def tick(d, g, ang, r0, r1, w, col, dx=0.0, dy=0.0):
    a = math.radians(ang)
    nx, ny = -math.sin(a) * w / 2, math.cos(a) * w / 2
    pts = [P(g['x'] + dx + math.cos(a) * rr + nx * s, g['y'] + (dy + math.sin(a) * rr + ny * s) * PY) for rr, s in ((r0, 1), (r1, 1), (r1, -1), (r0, -1))]
    d.polygon(pts, fill=col)


def arc_band(d, g, a0, a1, r0, r1, col, dx=0.0, dy=0.0):
    n = max(8, int(abs(a1 - a0)))
    pts = [at(g, a0 + (a1 - a0) * i / n, r1, dx, dy) for i in range(n + 1)] + [at(g, a1 - (a1 - a0) * i / n, r0, dx, dy) for i in range(n + 1)]
    d.polygon(pts, fill=col)


def text(im, s, cx, cy, h, col, font=FB, wide=1.0):
    """texto centrado em (cx, cy) (pixels do painel); h = altura das maiúsculas/algarismos em colunas"""
    f = ImageFont.truetype(font, 200)
    bb = f.getbbox('0')
    k = h * K / (bb[3] - bb[1])
    f = ImageFont.truetype(font, max(6, int(round(200 * k))))
    b = f.getbbox(s)
    lay = Image.new('L', (b[2] - b[0] + 8, b[3] - b[1] + 8), 0)
    ImageDraw.Draw(lay).text((4 - b[0], 4 - b[1]), s, font=f, fill=255)
    lay = lay.resize((max(1, int(lay.width * wide)), max(1, int(lay.height * PY))), Image.LANCZOS)
    x, y = P(cx, cy)
    im.paste(col, (int(round(x - lay.width / 2)), int(round(y - lay.height / 2))), lay)


def bezel(d, g, pal):
    """copo preto da arte, aro cromado fino (degradê de brilho em volta) e o fundo"""
    R = g['R']
    ell(d, g, R + 0.35, fill=pal['cup'])
    n = 72
    for i in range(n):   # aro: claro em cima à esquerda, escuro embaixo
        a0 = i * 360 / n
        t = (math.cos(math.radians(a0 + 135)) + 1) / 2
        ch = pal['chrome']
        c = tuple(int(ch[1][k] * t + ch[4][k] * (1 - t)) for k in range(3))
        arc_band(d, g, a0, a0 + 360 / n + 0.6, R * 0.905, R * 0.975, c)
    ell(d, g, R * 0.905, fill=pal['cup'])
    ell(d, g, R * FACE, fill=pal['face'])


def screw(d, g, dx, dy, pal):
    ell(d, g, 0.55, fill=pal['screw'], dx=dx, dy=dy)
    cx, cy = P(g['x'] + dx, g['y'] + dy * PY)
    d.line([(cx - 0.4 * K, cy), (cx + 0.4 * K, cy)], fill=pal['face2'], width=max(1, int(K * 0.14)))


def lens(d, g, dx, dy, r, col):
    ell(d, g, r + 0.25, fill=(5, 5, 6), dx=dx, dy=dy)
    ell(d, g, r, fill=col, dx=dx, dy=dy)


def lamps_off(d, pal):
    for name, g, lx, ly, lr, _ in LAMPS:
        R = g['R']
        off = pal['lens_off'] if name in ('oil', 'warn', 'batt', 'tire') else pal['green_off'] if name in ('left', 'right') else pal['blue_off'] if name == 'beam' else pal['amber_off']
        if name in ('left', 'right', 'beam'):
            continue   # setas e farol alto: desenhados no conta-giros
        lens(d, g, lx * R, ly * R, lr * R, off)


def icon_oilcan(d, g, cx, cy, s, col):
    """almotolia de óleo (pictograma), centro em (cx, cy) relativo ao mostrador, tamanho s"""
    pts = [(-1.0, 0.1), (-0.5, -0.2), (0.4, -0.2), (0.95, -0.45), (1.0, -0.35), (0.5, 0.35), (-0.9, 0.35)]
    poly = [P(g['x'] + cx + x * s, g['y'] + (cy + y * s) * PY) for x, y in pts]
    d.polygon(poly, outline=col, width=max(1, int(K * 0.22)))
    a, b = P(g['x'] + cx - 0.2 * s, g['y'] + (cy - 0.4 * s) * PY), P(g['x'] + cx + 0.2 * s, g['y'] + (cy - 0.2 * s) * PY)
    d.rectangle([a, b], fill=col)


def icon_thermo(d, g, cx, cy, s, col):
    a, b = P(g['x'] + cx - 0.12 * s, g['y'] + (cy - 0.9 * s) * PY), P(g['x'] + cx + 0.12 * s, g['y'] + (cy + 0.3 * s) * PY)
    d.rectangle([a, b], fill=col)
    ell(d, g, 0.3 * s, fill=col, dx=cx, dy=cy + 0.4 * s)
    for k in range(3):
        y = cy - 0.7 * s + k * 0.3 * s
        d.line([P(g['x'] + cx + 0.15 * s, g['y'] + y * PY), P(g['x'] + cx + 0.45 * s, g['y'] + y * PY)], fill=col, width=max(1, int(K * 0.14)))


def icon_pump(d, g, cx, cy, s, col):
    a, b = P(g['x'] + cx - 0.55 * s, g['y'] + (cy - 0.8 * s) * PY), P(g['x'] + cx + 0.25 * s, g['y'] + (cy + 0.8 * s) * PY)
    d.rectangle([a, b], outline=col, width=max(1, int(K * 0.22)))
    a, b = P(g['x'] + cx - 0.4 * s, g['y'] + (cy - 0.6 * s) * PY), P(g['x'] + cx + 0.1 * s, g['y'] + (cy - 0.2 * s) * PY)
    d.rectangle([a, b], fill=col)
    d.line([P(g['x'] + cx + 0.25 * s, g['y'] + (cy - 0.3 * s) * PY), P(g['x'] + cx + 0.6 * s, g['y'] + (cy - 0.1 * s) * PY),
            P(g['x'] + cx + 0.6 * s, g['y'] + (cy + 0.5 * s) * PY)], fill=col, width=max(1, int(K * 0.2)))


def oil(im, d, pal):
    g, R = OIL, OIL['R']
    bezel(d, g, pal)
    # ilha do meio (eixos escondidos), um pouco mais clara, com a borda brilhante da peça em relevo
    ell(d, g, R * ISLE + 0.25, fill=pal['isle_edge'])
    ell(d, g, R * ISLE, fill=pal['isle'])
    # temperatura do óleo (esquerda): losango no 40, marcações, números e a faixa vermelha no fim
    arc_band(d, g, oilt_a(4.55), oilt_a(5.6), R * 0.70, R * 0.84, pal['red'])
    for i, s in enumerate(['40', '60', '90', '120', '150', '170']):
        a = oilt_a(i)
        if i == 0:
            c = at(g, a, R * 0.77)
            s2 = R * 0.07 * K
            d.polygon([(c[0], c[1] - s2 * PY), (c[0] + s2, c[1]), (c[0], c[1] + s2 * PY), (c[0] - s2, c[1])], fill=pal['ink'])
        else:
            tick(d, g, a, R * 0.72, R * TICK, R * 0.055, pal['ink'])
        tx = at(g, a, R * 0.62)
        text(im, s, X0 + tx[0] / K, Y0 + tx[1] / K, R * 0.085, pal['ink'], FB, 0.9)
    # pressão do óleo (direita): 0 a 5
    for p in range(6):
        tick(d, g, oilp_a(p), R * 0.72, R * TICK, R * 0.055, pal['ink'])
        tx = at(g, oilp_a(p), R * 0.63)
        text(im, str(p), X0 + tx[0] / K, Y0 + tx[1] / K, R * 0.09, pal['ink'], FB)
    for p in range(5):
        tick(d, g, oilp_a(p + 0.5), R * 0.77, R * TICK, R * 0.035, pal['ink'])
    # ícones: temperatura do óleo e pressão do óleo (nas janelas), esquema das travas do diferencial no alto
    icon_thermo(d, g, -0.43 * R, -0.08 * R, R * 0.09, pal['icon'])
    icon_oilcan(d, g, -0.36 * R, 0.05 * R, R * 0.08, pal['icon'])
    icon_oilcan(d, g, 0.42 * R, -0.02 * R, R * 0.09, pal['icon'])
    w = max(1, int(K * 0.2))
    for yy in (-0.62, -0.38):
        a, b = P(g['x'] - 0.16 * R, g['y'] + yy * R * PY), P(g['x'] + 0.16 * R, g['y'] + yy * R * PY)
        d.line([a, b], fill=pal['icon'], width=w)
        for sx in (-0.16, 0.16):
            ell(d, g, 0.05 * R, outline=pal['icon'], width=w, dx=sx * R, dy=yy * R)
    a, b = P(g['x'] - 0.04 * R, g['y'] - 0.56 * R * PY), P(g['x'] + 0.04 * R, g['y'] - 0.44 * R * PY)
    d.rectangle([a, b], fill=pal['icon'])


def tach(im, d, pal):
    g, R = TACH, TACH['R']
    bezel(d, g, pal)
    arc_band(d, g, tach_a(7.4), tach_a(8.62), R * 0.70, R * 0.745, pal['orange'])
    for q in range(0, 35):
        k = q / 4
        big, mid = q % 4 == 0, q % 2 == 0
        r0 = R * (0.70 if big else 0.75 if mid else 0.77)
        tick(d, g, tach_a(k), r0, R * TICK, R * (0.036 if big else 0.026 if mid else 0.019), pal['ink'])
    for k in range(1, 9):
        a = math.radians(tach_a(k))
        rr = R * 0.56
        text(im, str(k), g['x'] + math.cos(a) * rr, g['y'] + math.sin(a) * rr * PY, R * 0.15, pal['ink'], FB)
    text(im, '1/min', g['x'], g['y'] - 0.27 * R * PY, R * 0.065, pal['ink'], FS)
    text(im, '×1000', g['x'], g['y'] - 0.165 * R * PY, R * 0.065, pal['ink'], FS)
    # setas verdes e farol alto (apagados; o jogo acende), ponto escuro no alto
    for side in (-1, 1):
        cx, cy = side * 0.40 * R, -0.60 * R
        s = 0.07 * R
        pts = [P(g['x'] + cx + side * s * 1.3, g['y'] + cy * PY), P(g['x'] + cx - side * s * 0.2, g['y'] + (cy - s) * PY),
               P(g['x'] + cx - side * s * 0.2, g['y'] + (cy - s * 0.45) * PY), P(g['x'] + cx - side * s * 1.2, g['y'] + (cy - s * 0.45) * PY),
               P(g['x'] + cx - side * s * 1.2, g['y'] + (cy + s * 0.45) * PY), P(g['x'] + cx - side * s * 0.2, g['y'] + (cy + s * 0.45) * PY),
               P(g['x'] + cx - side * s * 0.2, g['y'] + (cy + s) * PY)]
        d.polygon(pts, fill=pal['green_off'])
    beam(d, g, 0.0, -0.43 * R, 0.07 * R, pal['icon'])
    ell(d, g, 0.05 * R, fill=(4, 4, 5), dy=-0.66 * R)
    for sx in (-1, 1):
        screw(d, g, sx * 0.30 * R, 0.0, pal)
    # manômetro do turbo, embaixo: 0 / 0,5 / 1,5 / 2,5 bar, eixo embaixo
    by, br = BOOST['dy'] * R, BOOST['r'] * R
    for q in range(6):
        b = q * 0.5
        tick(d, g, boost_a(b), br * 0.82, br, R * 0.04, pal['ink'], dy=by)
        if q in (0, 1, 3, 5):
            a = math.radians(boost_a(b))
            rr = br * 0.62
            s = '0' if q == 0 else str(b).replace('.', ',')
            text(im, s, g['x'] + math.cos(a) * rr + (0.03 * R if q == 0 else 0), g['y'] + (by + math.sin(a) * rr + 0.02 * R) * PY, R * 0.065, pal['ink'], FB, 0.92)
    text(im, 'bar', g['x'], g['y'] + (by - 0.12 * R) * PY, R * 0.055, pal['ink'], FS)
    for sx in (-1, 1):
        screw(d, g, sx * 0.30 * R, by, pal)


def beam(d, g, cx, cy, s, col):
    """farol alto (pictograma): meia-lua com os riscos para a frente"""
    w = max(1, int(K * 0.16))
    a, b = P(g['x'] + cx - 0.2 * s, g['y'] + (cy - 0.7 * s) * PY), P(g['x'] + cx + 1.2 * s, g['y'] + (cy + 0.7 * s) * PY)
    d.pieslice([a[0] - (b[0] - a[0]) * 0.0, a[1], b[0], b[1]], -90, 90, outline=col, width=w)
    d.line([P(g['x'] + cx + 0.45 * s, g['y'] + (cy - 0.7 * s) * PY), P(g['x'] + cx + 0.45 * s, g['y'] + (cy + 0.7 * s) * PY)], fill=col, width=w)
    for k in range(4):
        y = cy - 0.55 * s + k * 0.37 * s
        d.line([P(g['x'] + cx - 1.2 * s, g['y'] + y * PY), P(g['x'] + cx - 0.15 * s, g['y'] + y * PY)], fill=col, width=w)


def speed(im, d, pal):
    g, R = SPEED, SPEED['R']
    bezel(d, g, pal)
    tick(d, g, speed_a(50), R * 0.62, R * 0.80, R * 0.06, pal['orange'])
    for v in range(20, 341, 10):
        big = v % 20 == 0
        tick(d, g, speed_a(v), R * (0.72 if big else 0.775), R * TICK, R * (0.036 if big else 0.019), pal['ink'])
    bigs = (20, 60, 100, 140, 220, 260, 300, 340)
    for v in range(20, 341, 20):
        a = math.radians(speed_a(v))
        h = R * (0.10 if v in bigs else 0.06)
        s = str(v)
        ww = h * (0.75 * len(s))
        rr = R * 0.705 - abs(math.cos(a)) * ww / 2 - abs(math.sin(a)) * h * 0.62
        text(im, s, g['x'] + math.cos(a) * rr, g['y'] + math.sin(a) * rr * PY, h, pal['ink'], FB, 0.92)
    text(im, 'KM', g['x'], g['y'] - 0.39 * R * PY, R * 0.06, pal['ink'], FS)
    # farol baixo (pictograma)
    beam(d, g, 0.0, -0.53 * R, 0.05 * R, pal['icon'])
    # tambores: hodômetro (seis) e parcial (quatro, o último branco); o jogo põe os algarismos
    for n, cy, pitch, ww, last in ((6, -0.24, 0.112, 0.088, False), (4, 0.27, 0.14, 0.098, True)):
        for i in range(n):
            x = g['x'] + (i - (n - 1) / 2) * pitch * R
            a, b = P(x - ww * R / 2, g['y'] + (cy - 0.075) * R * PY), P(x + ww * R / 2, g['y'] + (cy + 0.075) * R * PY)
            d.rectangle([a[0] - K * 0.18, a[1] - K * 0.18, b[0] + K * 0.18, b[1] + K * 0.18], fill=(3, 3, 4))
            d.rectangle([a, b], fill=pal['white'] if last and i == n - 1 else pal['drum'])
    for sx in (-1, 1):
        screw(d, g, sx * 0.40 * R, 0.0, pal)
    # botão do parcial, embaixo
    ell(d, g, 0.08 * R, fill=(3, 3, 4), dy=0.80 * R)
    ell(d, g, 0.055 * R, fill=pal['screw'], dy=0.78 * R)


def twin(im, d, pal, g, left, right, labels_l, labels_r, red_l=None, red_r=None):
    """mostrador de dois arcos (os de fora, da arte): marcações nas bordas, ilha lisa no meio"""
    R = g['R']
    bezel(d, g, pal)
    ell(d, g, R * ISLE + 0.25, fill=pal['isle_edge'])
    ell(d, g, R * ISLE, fill=pal['isle'])
    for (a0, a1), labs, red in (((left[0], left[1]), labels_l, red_l), ((right[0], right[1]), labels_r, red_r)):
        if red:
            arc_band(d, g, a0 + (a1 - a0) * red[0], a0 + (a1 - a0) * red[1], R * 0.70, R * 0.84, pal['red'])
        n = 8
        for i in range(n + 1):
            big = i % 4 == 0
            tick(d, g, a0 + (a1 - a0) * i / n, R * (0.70 if big else 0.76), R * TICK, R * (0.07 if big else 0.04), pal['ink'])
        for i, s in enumerate(labs):
            if not s:
                continue
            a = math.radians(a0 + (a1 - a0) * i / (len(labs) - 1))
            text(im, s, g['x'] + math.cos(a) * R * 0.62, g['y'] + math.sin(a) * R * 0.62 * PY, R * 0.085, pal['ink'], FB, 0.9)


G1_FUEL, G1_TEMP = (135.0, 225.0), (45.0, -45.0)   # arcos (vazio -> cheio, frio -> quente)
G5_F, G5_R = (140.0, 220.0), (40.0, -40.0)         # 1,5 -> 3,5 bar


def g1(im, d, pal):
    g, R = G1, G1['R']
    twin(im, d, pal, g, G1_FUEL, G1_TEMP, ['R', '', '1'], ['', '', ''], red_l=(0.0, 0.14), red_r=(0.86, 1.0))
    icon_pump(d, g, -0.30 * R, 0.22 * R, R * 0.13, pal['icon'])
    icon_thermo(d, g, 0.34 * R, -0.12 * R, R * 0.13, pal['icon'])


def g5(im, d, pal):
    g, R = G5, G5['R']
    twin(im, d, pal, g, G5_F, G5_R, ['1,5', '2,5', '3,5'], ['1,5', '2,5', '3,5'])
    ell(d, g, 0.1 * R, fill=pal['lens_off'], dy=0.0)   # tracinho vermelho do meio (da arte)


def build(pal, lamps_lit=False):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for f in (g1, oil, tach, speed, g5):
        f(im, d, pal)
    lamps_off(d, pal)
    if lamps_lit:   # todas as luzes acesas (o jogo recorta a casa de cada uma e põe o clarão)
        for name, g, lx, ly, lr, col in LAMPS:
            R = g['R']
            if name in ('left', 'right'):
                side = -1 if name == 'left' else 1
                cx, cy, s = lx * R, ly * R, 0.07 * R
                pts = [P(g['x'] + cx + side * s * 1.3, g['y'] + cy * PY), P(g['x'] + cx - side * s * 0.2, g['y'] + (cy - s) * PY),
                       P(g['x'] + cx - side * s * 0.2, g['y'] + (cy - s * 0.45) * PY), P(g['x'] + cx - side * s * 1.2, g['y'] + (cy - s * 0.45) * PY),
                       P(g['x'] + cx - side * s * 1.2, g['y'] + (cy + s * 0.45) * PY), P(g['x'] + cx - side * s * 0.2, g['y'] + (cy + s * 0.45) * PY),
                       P(g['x'] + cx - side * s * 0.2, g['y'] + (cy + s) * PY)]
                d.polygon(pts, fill=col)
            elif name == 'beam':
                beam(d, g, lx * R, ly * R, 0.07 * R, col)
            else:
                lens(d, g, lx * R, ly * R, lr * R, col)
                ell(d, g, lr * R * 0.45, fill=tuple(min(255, v + 90) for v in col), dx=lx * R - lr * R * 0.25, dy=ly * R - lr * R * 0.3)
    return im.resize((int((X1 - X0) * KO), int((Y1 - Y0) * KO)), Image.LANCZOS)


def main():
    out = sys.argv[1]
    build(DAY).save(os.path.join(out, '959-cluster.png'), optimize=True)
    build(LIT).save(os.path.join(out, '959-cluster-lit.png'), optimize=True)
    build(DAY, True).save(os.path.join(out, '959-lamps.png'), optimize=True)
    for name, g, lx, ly, lr, _ in LAMPS:
        print(name, round(g['x'] + lx * g['R'], 2), round(g['y'] + ly * g['R'] * PY, 2), round(2 * (lr * g['R'] + 0.6), 2))


if __name__ == '__main__':
    main()
