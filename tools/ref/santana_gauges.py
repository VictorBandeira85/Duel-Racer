"""Quadro do Savana GLS (VW Santana GLS 2.0 1990), copiando as fotos do quadro real que o Victor mandou
(a de cima, acesa à noite, e as duas de dia). Mesma família do Jornada Sport, numa placa preta fosca:
- velocímetro redondo (cortado reto embaixo), 20 a 220 km/h em 269°: blocos brancos a cada 20, três
  riscos finos entre eles, números (20, 40 ... 220) por DENTRO das marcações, "km" e o hodômetro de seis
  tambores acima do eixo, parcial de quatro abaixo (o último branco), "km/h" e o botão do parcial embaixo;
  um parafuso de cada lado do eixo
- bloco do meio, de cima para baixo: o vão com a tampa redonda lisa (no carro, o emblema da fábrica),
  faixa de ícones (setas e bateria à esquerda, óleo e farol alto à direita), duas fileiras de cinco casas
  quadradas com a lente redonda (verde, vermelha, cega, vermelha, azul / a de baixo escura: afogador e
  freio de mão no meio das cegas), APAGADAS, uma faixa lisa e o relógio de cristal líquido
- conta-giros redondo 0 a 7 ("1/min x1000"): o 0 é o bloco sem número onde o ponteiro descansa, 0-1
  apertado (19,5°) e depois 28,25° por 1000; faixa amarelo-alaranjada de 6,3 a 7, hachurada (contorno
  e travessas) até 6,8 e cheia até o 7. Embaixo, duas janelas em leque mais fundas: temperatura
  (esquerda, com o LED vermelho) e combustível (direita, reserva com a ponta amarela)
Algarismos quadrados da fábrica (os `SQ` de gol_gauges.py). Sem marca no mostrador (nada de "vdo").
O jogo desenha ponteiros, tambores dos hodômetros, a hora no cristal líquido e as luzes acesas
(santanaCluster em cockpit.ts).
À esquerda do quadro, na moldura, os dois interruptores com luz vermelha (desembaçador traseiro e farol
de neblina) também saem daqui: apagados (br-santana-switch.png) e acesos (br-santana-switch-on.png).
Saídas (4 px por pixel do jogo):
  br-santana-cluster.png      de dia
  br-santana-cluster-lit.png  aceso (noite e túnel): fundo verde-garrafa escuro iluminado por trás,
                              números e marcações verde-claros quase brancos
  br-santana-lamps.png        o bloco do meio com todas as lentes acesas (o jogo copia a casa de cada uma)
  br-santana-switch.png / br-santana-switch-on.png  os dois interruptores, apagados / acesos
Uso: python3 tools/ref/santana_gauges.py <src/assets/cockpit>
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from gol_gauges import SQ  # noqa: E402  (algarismos da mesma fábrica)

K, KO, PY = 12, 4, 8 / 7
X0, Y0, X1, Y1 = 75.3, 38.91, 180.7, 87.1    # placa dos mostradores na arte (santana_cockpit.py)
W, H = int(round((X1 - X0) * K)), int(round((Y1 - Y0) * K))
SW = (57.96, 69.61, 73.94, 86.71)            # caixa dos dois interruptores (santana_cockpit.py)
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
# medidas dentro da placa (colunas, linhas), tiradas da foto (1 coluna = 10,96 px da foto de cima)
SPEED = dict(x=23.46, y=27.0, R=18.7, a20=135.0, per=269.4 / 200)
TACH = dict(x=82.96, y=27.0, R=19.5, a0=175.5, a1=195.0, per=28.25)
CHORD = 45.8                                 # os dois mostradores são cortados retos nesta linha
BLOCK = (44.8, 61.6)                         # bloco do meio (colunas)
CAP = (45.8, 4.2, 60.6, 12.6)                # vão da tampa redonda
ICON1 = (17.2, 20.1)                         # faixa de ícones (linhas)
LAMP_X, LAMP_Y = (46.25, 49.65, 53.05, 56.45, 59.85), (23.5, 27.4)
LAMP_R = 0.95
STRIP = (30.6, 33.6)                         # faixa lisa entre as lentes e o relógio
LCD = (46.6, 37.1, 59.5, 42.9)               # vidro do relógio
# lentes: cor de cada casa (None = cega); a fileira de baixo fica escura apagada (afogador e freio)
LENS = [[(60, 200, 90), (235, 50, 40), None, (235, 50, 40), (70, 110, 255)], [None, (255, 190, 40), None, (235, 50, 40), None]]
# marcas dos pequenos, em graus em volta do centro do conta-giros (medidas na foto)
TEMP_HOT, TEMP_LED, TEMP_COLD, TEMP_MIN = 163.0, 147.0, 134.0, 128.0
FUEL_FULL, FUEL_HALF, FUEL_LOW, FUEL_RES = 18.0, 38.5, 46.5, 52.5
DAY = dict(plate=(38, 38, 40), edge=(12, 12, 14), face=(25, 25, 27), face2=(17, 17, 19), well=(9, 9, 11), ink=(228, 232, 218),
           band=(246, 156, 36), dark=(7, 7, 9), cell=(16, 16, 18), strip=(26, 26, 28), icon=(214, 218, 206), text=(208, 212, 200),
           lcd=(168, 178, 150), lcd2=(148, 158, 132), knob=(16, 16, 18), amber=(240, 200, 60), drum=(10, 10, 12), white=(226, 226, 216),
           cap=(30, 30, 33), cap2=(44, 44, 48), screw=(120, 120, 124))
# aceso: verde-garrafa profundo, mais claro no centro de cada mostrador (luz por trás de um difusor);
# o que brilha são os números, as marcações e os letreiros (verde-claro quase branco)
# aceso: verde-amarelado (oliva) como nas fotos do Santana à noite, escuro e pouco saturado; números claros
LIT = dict(plate=(12, 14, 6), edge=(6, 8, 2), face=(55, 67, 21), face2=(44, 54, 16), core=(77, 92, 33), well=(31, 38, 11), ink=(214, 236, 140),
           band=(250, 176, 60), dark=(9, 12, 3), cell=(11, 14, 4), strip=(19, 23, 8), icon=(167, 183, 123), text=(214, 236, 140),
           lcd=(112, 127, 69), lcd2=(96, 109, 57), knob=(13, 15, 5), amber=(240, 222, 110), drum=(9, 12, 3), white=(202, 212, 172),
           cap=(15, 17, 7), cap2=(23, 27, 11), screw=(44, 49, 31))


def P(x, y):
    return (x * K, y * K)


def at(g, ang, rr):
    a = math.radians(ang)
    return ((g['x'] + math.cos(a) * rr) * K, (g['y'] + math.sin(a) * rr * PY) * K)


def tick(d, g, ang, r0, r1, w, col):
    """marcação radial de largura w (colunas): quadrilátero (a tela do jogo tem pixel 8:7)"""
    a = math.radians(ang)
    nx, ny = -math.sin(a) * w / 2, math.cos(a) * w / 2
    pts = []
    for rr, s in ((r0, 1), (r1, 1), (r1, -1), (r0, -1)):
        pts.append(((g['x'] + math.cos(a) * rr + nx * s) * K, (g['y'] + (math.sin(a) * rr + ny * s) * PY) * K))
    d.polygon(pts, fill=col)


def number(im, s, cx, cy, h, col, wide=1.0, stroke=1.9, gap=6.5):
    """número com os algarismos quadrados da fábrica, centrado em (cx, cy) (colunas, linhas); h em colunas"""
    u = h * K / (6 + stroke)
    t = u * stroke
    adv = u * gap
    lay = Image.new('L', (int(adv * len(s) + t * 2), int((u * 6 + t * 2) * PY)), 0)
    dd = ImageDraw.Draw(lay)
    ox = t
    for ch in s:
        for path in SQ.get(ch, []):
            pts = [(ox + x * u, (t + y * u) * PY) for x, y in path]
            dd.line(pts, fill=255, width=int(round(t)), joint='curve')
            for x, y in pts:
                dd.ellipse([x - t / 2, y - t / 2, x + t / 2, y + t / 2], fill=255)
        ox += adv * (0.72 if ch == '1' else 1)
    lay = lay.crop(lay.getbbox())
    lay = lay.resize((max(1, int(lay.width * wide)), lay.height), Image.LANCZOS)
    im.paste(col, (int(round(cx * K - lay.width / 2)), int(round(cy * K - lay.height / 2))), lay)


def text(im, s, cx, cy, h, col, font=FB, wide=1.0):
    f = ImageFont.truetype(font, int(round(h * K * 1.4)))
    bb = f.getbbox(s)
    lay = Image.new('L', (bb[2] - bb[0] + 4, bb[3] - bb[1] + 4), 0)
    ImageDraw.Draw(lay).text((2 - bb[0], 2 - bb[1]), s, font=f, fill=255)
    lay = lay.resize((max(1, int(lay.width * wide)), max(1, int(lay.height * PY))), Image.LANCZOS)
    im.paste(col, (int(round(cx * K - lay.width / 2)), int(round(cy * K - lay.height / 2))), lay)


def dot(d, cx, cy, r, col):
    c = P(cx, cy)
    d.ellipse([c[0] - K * r, c[1] - K * r * PY, c[0] + K * r, c[1] + K * r * PY], fill=col)


def disc(im, pal, g, wells=()):
    """fundo redondo do mostrador, cortado reto embaixo; aceso, clareia no centro"""
    R = g['R'] + 1.1
    box = lambda rr: [(g['x'] - rr) * K, (g['y'] - rr * PY) * K, (g['x'] + rr) * K, (g['y'] + rr * PY) * K]
    lay = Image.new('RGB', im.size, pal['plate'])
    m = Image.new('L', im.size, 0)
    dm = ImageDraw.Draw(m)
    d = ImageDraw.Draw(lay)
    dm.ellipse(box(R + 0.45), fill=255)
    d.ellipse(box(R + 0.45), fill=pal['edge'])
    d.ellipse(box(R), fill=pal['face'])
    if 'core' in pal:
        n = 18
        for i in range(n):
            t = (i + 1) / n
            c = tuple(int(round(pal['face'][k] + (pal['core'][k] - pal['face'][k]) * t ** 1.4)) for k in range(3))
            d.ellipse(box(R * (1 - 0.82 * t)), fill=c)
    else:   # de dia: um pouco mais escuro para baixo
        for i in range(int(R * PY * K)):
            t = i / (R * PY * K)
            y = (g['y'] + R * PY) * K - i
            c = tuple(int(pal['face2'][k] * (1 - t) + pal['face'][k] * t) for k in range(3))
            xr = R * K * math.sqrt(max(0, 1 - (1 - t) ** 2))
            d.line([(g['x'] * K - xr, y), (g['x'] * K + xr, y)], fill=c)
    for poly in wells:   # janelas mais fundas (pequenos do conta-giros)
        pts = [((g['x'] + x * g['R']) * K, (g['y'] + y * g['R'] * PY) * K) for x, y in poly]
        d.polygon(pts, fill=pal['well'])
        d.line(pts[:-2], fill=pal['edge'], width=max(2, int(K * 0.3)), joint='curve')
    dm.rectangle([0, CHORD * K, im.width, im.height], fill=0)
    im.paste(lay, (0, 0), m)
    ImageDraw.Draw(im).line([((g['x'] - R * 0.7) * K, CHORD * K), ((g['x'] + R * 0.7) * K, CHORD * K)], fill=pal['edge'], width=max(2, int(K * 0.35)))


def a_speed(v):
    return SPEED['a20'] + (v - 20) * SPEED['per']


def speed(im, pal):
    g = SPEED
    R = g['R']
    disc(im, pal, g)
    d = ImageDraw.Draw(im)
    for v in range(20, 221, 5):
        big = v % 20 == 0
        tick(d, g, a_speed(v), R - (2.1 if big else 1.7), R, 1.0 if big else 0.38, pal['ink'])
    for v in range(20, 221, 20):
        a = math.radians(a_speed(v))
        s = str(v)
        hh = 2.15
        ww = (5.7 if len(s) == 3 else 4.0)
        rr = R - 2.1 - 0.6 - abs(math.cos(a)) * ww / 2 - abs(math.sin(a)) * hh / 2
        number(im, s, g['x'] + math.cos(a) * rr, g['y'] + math.sin(a) * rr * PY, hh, pal['ink'], 1.22 if len(s) == 3 else 1.3)
    text(im, 'km', g['x'] + 0.3, g['y'] - 8.6, 1.2, pal['text'], FB, 1.15)
    text(im, 'km/h', g['x'] + 0.1, g['y'] + 12.3, 1.3, pal['text'], FB, 1.15)
    # tambores do hodômetro (seis) e do parcial (quatro, o último branco): o jogo põe os algarismos
    for n, cx, cy, pitch, ww, last in ((6, g['x'] + 0.3, g['y'] - 5.6, 2.9, 2.2, False), (4, g['x'] + 0.3, g['y'] + 5.6, 3.4, 2.3, True)):
        for i in range(n):
            x = cx + (i - (n - 1) / 2) * pitch
            a, b = P(x - ww / 2, cy - 1.45), P(x + ww / 2, cy + 1.45)
            d.rectangle([a[0] - K * 0.2, a[1] - K * 0.2, b[0] + K * 0.2, b[1] + K * 0.2], fill=pal['edge'])
            d.rectangle([a[0], a[1], b[0], b[1]], fill=pal['white'] if last and i == n - 1 else pal['drum'])
    for sx in (-1, 1):   # parafusos dos lados do eixo
        dot(d, g['x'] + sx * 0.38 * R, g['y'] + 0.4, 0.6, pal['dark'])
    # botão do parcial, embaixo
    c = P(g['x'] - 0.3, g['y'] + 17.4)
    d.line([P(g['x'] - 0.2, g['y'] + 15.0), c], fill=pal['dark'], width=int(K * 0.5))
    d.ellipse([c[0] - K * 1.1, c[1] - K * 1.1 * PY, c[0] + K * 1.1, c[1] + K * 1.1 * PY], fill=pal['knob'])
    d.ellipse([c[0] - K * 0.65, c[1] - K * 0.8, c[0] - K * 0.1, c[1] - K * 0.25], fill=tuple(min(255, v + 70) for v in pal['knob']))


def a_tach(v):
    g = TACH
    return g['a0'] + (g['a1'] - g['a0']) * v if v <= 1 else g['a1'] + (v - 1) * g['per']


# janelas em leque dos pequenos (em raios do conta-giros, a partir do centro; a da direita é espelhada)
WELL = [(-1.2, 0.14), (-0.72, 0.14), (-0.62, 0.21), (-0.52, 0.37), (-0.45, 0.55), (-0.45, 0.72), (-0.49, 1.2), (-1.2, 1.2)]


def ico_pump(d, cx, cy, u, col, bg):
    d.rectangle([cx - 1.5 * u, cy - 1.9 * u * PY, cx + 0.5 * u, cy + 1.7 * u * PY], fill=col)
    d.rectangle([cx - 1.05 * u, cy - 1.45 * u * PY, cx + 0.05 * u, cy - 0.5 * u * PY], fill=bg)
    d.line([(cx + 0.5 * u, cy - 0.9 * u * PY), (cx + 1.5 * u, cy - 0.2 * u * PY), (cx + 1.5 * u, cy + 1.1 * u * PY)], fill=col, width=max(1, int(0.45 * u)))


def ico_temp(d, cx, cy, u, col):
    d.rectangle([cx - 0.3 * u, cy - 2.4 * u * PY, cx + 0.3 * u, cy + 0.6 * u * PY], fill=col)
    d.rectangle([cx - 0.3 * u, cy - 1.9 * u * PY, cx + 1.1 * u, cy - 1.5 * u * PY], fill=col)
    d.rectangle([cx - 0.3 * u, cy - 1.0 * u * PY, cx + 1.1 * u, cy - 0.6 * u * PY], fill=col)
    d.rectangle([cx - 2.2 * u, cy + 1.2 * u * PY, cx + 2.2 * u, cy + 1.6 * u * PY], fill=col)
    d.ellipse([cx - 0.8 * u, cy + 0.2 * u * PY, cx + 0.8 * u, cy + 1.5 * u * PY], fill=col)


def tach(im, pal):
    g = TACH
    R = g['R']
    disc(im, pal, g, wells=(WELL, [(-x, y) for x, y in WELL]))
    d = ImageDraw.Draw(im)
    # faixa amarelo-alaranjada: de 6,3 a 6,8 hachurada (contorno por fora e por dentro, travessas) e cheia até 7
    n = 30
    for k in range(n + 1):
        v = 6.3 + 0.5 * k / n
        tick(d, g, a_tach(v), R - 0.35, R, 0.5, pal['band'])
        tick(d, g, a_tach(v), R - 2.1, R - 1.75, 0.5, pal['band'])
    for k in range(6):
        tick(d, g, a_tach(6.3 + 0.1 * k), R - 2.1, R, 0.5, pal['band'])
    for k in range(13):
        tick(d, g, a_tach(6.8 + 0.2 * k / 12), R - 2.1, R, 0.5, pal['band'])
    for v in [0, 1 / 3, 2 / 3] + [1 + i * 0.25 for i in range(25)]:
        big = abs(v - round(v)) < 1e-6
        if 6.3 < v < 7 and not big:
            continue
        tick(d, g, a_tach(v), R - (2.1 if big else 1.6), R, 1.15 if big else 0.4, pal['ink'])
    for i in range(1, 8):
        a = math.radians(a_tach(i))
        hh, ww = 2.35, 2.0
        rr = R - 2.1 - 0.75 - abs(math.cos(a)) * ww / 2 - abs(math.sin(a)) * hh / 2
        number(im, str(i), g['x'] + math.cos(a) * rr, g['y'] + math.sin(a) * rr * PY, hh, pal['ink'], 1.25)
    text(im, '1/min x1000', g['x'], g['y'] + 0.31 * R * PY, 1.25, pal['text'], FB, 1.05)
    for sx in (-1, 1):   # parafusos dos lados do eixo
        dot(d, g['x'] + sx * 0.38 * R, g['y'] + 0.3, 0.6, pal['dark'])
    # pequenos: temperatura à esquerda (frio embaixo, quente em cima, LED entre eles), combustível à direita
    tick(d, g, TEMP_HOT, R * 0.80, R * 0.97, 0.5, pal['ink'])
    tick(d, g, TEMP_COLD, R * 0.78, R * 0.97, 1.4, pal['ink'])
    tick(d, g, TEMP_MIN, R * 0.76, R * 0.95, 0.42, pal['ink'])
    c = at(g, TEMP_LED, R * 0.9)
    d.ellipse([c[0] - K * 0.7, c[1] - K * 0.7 * PY, c[0] + K * 0.7, c[1] + K * 0.7 * PY], fill=pal['dark'])
    d.ellipse([c[0] - K * 0.46, c[1] - K * 0.46 * PY, c[0] + K * 0.46, c[1] + K * 0.46 * PY], fill=(84, 14, 16))
    tick(d, g, FUEL_FULL, R * 0.80, R * 0.97, 0.5, pal['ink'])
    tick(d, g, FUEL_HALF, R * 0.82, R * 0.97, 0.5, pal['ink'])
    tick(d, g, FUEL_LOW, R * 0.78, R * 0.95, 0.42, pal['ink'])
    tick(d, g, FUEL_RES, R * 0.78, R * 0.97, 1.4, pal['ink'])
    tick(d, g, FUEL_RES, R * 0.80, R * 0.90, 0.65, pal['amber'])
    u = K * 0.72
    cx, cy = P(g['x'] - 0.29 * R, g['y'] + 0.6 * R * PY)
    ico_temp(d, cx, cy, u, pal['icon'])
    cx, cy = P(g['x'] + 0.21 * R, g['y'] + 0.6 * R * PY)
    ico_pump(d, cx, cy, u, pal['icon'], pal['face2'] if 'core' not in pal else pal['face'])


def icons1(d, y, u, lw, cols):
    """setas e bateria (em cima das lentes 1 e 2), óleo e farol alto (em cima das lentes 4 e 5)"""
    xs = [v * K for v in LAMP_X]
    uy = u * PY
    c = cols[0]   # setas vazadas, lado a lado
    for sx in (-1, 1):
        x = xs[0] + sx * 1.35 * u
        d.polygon([(x + sx * 1.3 * u, y), (x, y - 1.4 * uy), (x, y - 0.6 * uy), (x - sx * 1.1 * u, y - 0.6 * uy),
                   (x - sx * 1.1 * u, y + 0.6 * uy), (x, y + 0.6 * uy), (x, y + 1.4 * uy)], outline=c, width=lw)
    c, x = cols[1], xs[1] + 0.9 * u   # bateria
    d.rectangle([x - 2.3 * u, y - 0.9 * uy, x + 2.3 * u, y + 1.5 * uy], outline=c, width=lw)
    d.rectangle([x - 1.7 * u, y - 1.5 * uy, x - 0.8 * u, y - 0.9 * uy], fill=c)
    d.rectangle([x + 0.8 * u, y - 1.5 * uy, x + 1.7 * u, y - 0.9 * uy], fill=c)
    c, x = cols[2], xs[3] - 0.4 * u   # almotolia de óleo com a gota
    d.polygon([(x - 1.8 * u, y - 0.2 * uy), (x + 0.9 * u, y - 0.2 * uy), (x + 2.7 * u, y - 1.1 * uy), (x + 2.9 * u, y - 0.7 * uy),
               (x + 1.2 * u, y + 1.3 * uy), (x - 1.8 * u, y + 1.3 * uy)], fill=c)
    d.rectangle([x - 1.2 * u, y - 0.9 * uy, x - 0.4 * u, y - 0.2 * uy], fill=c)
    d.line([(x - 1.8 * u, y + 0.2 * uy), (x - 2.8 * u, y - 0.6 * uy), (x - 2.8 * u, y + 0.2 * uy)], fill=c, width=lw)
    d.ellipse([x + 2.7 * u, y + 0.4 * uy, x + 3.3 * u, y + 1.2 * uy], fill=c)
    c, x = cols[3], xs[4] - 0.2 * u   # farol alto: riscos à esquerda, lente à direita
    d.chord([x - 0.9 * u, y - 1.6 * uy, x + 2.3 * u, y + 1.6 * uy], 270, 90, outline=c, width=lw)
    d.line([(x + 0.7 * u, y - 1.6 * uy), (x + 0.7 * u, y + 1.6 * uy)], fill=c, width=lw)
    for k in (-1.3, -0.45, 0.45, 1.3):
        d.line([(x - 2.4 * u, y + k * uy), (x + 0.2 * u, y + k * uy)], fill=c, width=lw)


def lens(d, cx, cy, col, pal, on=False, dim=0.26):
    """casa quadrada com a lente redonda; apagada, a lente guarda só um resto da cor do plástico"""
    a, b = P(cx - 1.4, cy - 1.55), P(cx + 1.4, cy + 1.55)
    d.rounded_rectangle([a[0], a[1], b[0], b[1]], radius=K * 0.45, fill=pal['cell'])
    c = P(cx, cy)
    r = K * LAMP_R
    if col is None:
        body = (20, 20, 22)
    elif on:
        body = col
    else:
        body = tuple(int(v * dim + 10) for v in col)
    d.ellipse([c[0] - r, c[1] - r * PY, c[0] + r, c[1] + r * PY], fill=body)
    hi = tuple(min(255, v + (110 if on else 40)) for v in body)
    d.ellipse([c[0] - r * 0.5, c[1] - r * 0.6 * PY, c[0] - r * 0.05, c[1] - r * 0.15 * PY], fill=hi)


def block(im, pal):
    d = ImageDraw.Draw(im)
    a, b = P(BLOCK[0], 0.8), P(BLOCK[1], CHORD + 1.2)
    d.rectangle([a[0], a[1], b[0], b[1]], fill=pal['edge'])
    d.rectangle([a[0] + K * 0.3, a[1] + K * 0.3, b[0] - K * 0.3, b[1] - K * 0.3], fill=tuple(int(v * 0.86) for v in pal['plate']))
    # vão com a tampa redonda lisa (no carro, o emblema da fábrica)
    x0, y0, x1, y1 = CAP
    d.rounded_rectangle([x0 * K, y0 * K, x1 * K, y1 * K], radius=K * 0.5, fill=pal['cap'])
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    dot(d, cx, cy, 2.75, pal['edge'])
    dot(d, cx, cy, 2.45, pal['cap2'])
    dot(d, cx + 0.12, cy + 0.15, 2.0, pal['cap'])
    hi = tuple(min(255, v + 28) for v in pal['cap2'])
    c, r = P(cx, cy), K * 2.45
    d.arc([c[0] - r, c[1] - r * PY, c[0] + r, c[1] + r * PY], 200, 290, fill=hi, width=max(2, int(K * 0.22)))
    # faixa de ícones e as dez casas
    u, lw = K * 0.5, max(1, int(K * 0.27))
    ya, yb = ICON1
    d.rounded_rectangle([(BLOCK[0] + 0.7) * K, ya * K, (BLOCK[1] - 0.7) * K, yb * K], radius=K * 0.5, fill=pal['strip'])
    icons1(d, (ya + yb) / 2 * K, u, lw, [pal['icon']] * 4)
    for j, cy in enumerate(LAMP_Y):
        for i, cx in enumerate(LAMP_X):
            lens(d, cx, cy, LENS[j][i], pal, dim=0.26 if j == 0 else 0.1)
    ya, yb = STRIP
    d.rounded_rectangle([(BLOCK[0] + 0.7) * K, ya * K, (BLOCK[1] - 0.7) * K, yb * K], radius=K * 0.5, fill=pal['strip'])
    # relógio de cristal líquido: moldura e vidro (o jogo escreve a hora)
    x0, y0, x1, y1 = LCD
    d.rounded_rectangle([(x0 - 0.9) * K, (y0 - 0.9) * K, (x1 + 0.9) * K, (y1 + 0.9) * K], radius=K * 0.7, fill=pal['edge'])
    d.rounded_rectangle([x0 * K, y0 * K, x1 * K, y1 * K], radius=K * 0.4, fill=pal['lcd'])
    d.rounded_rectangle([x0 * K, (y1 - 1.3) * K, x1 * K, y1 * K], radius=K * 0.4, fill=pal['lcd2'])
    # parafusos da placa, embaixo dos lados do bloco
    for x in (BLOCK[0] - 2.6, BLOCK[1] + 1.8):
        dot(d, x, CHORD - 0.4, 0.75, pal['edge'])
        dot(d, x, CHORD - 0.4, 0.5, pal['screw'])


def render(pal):
    im = Image.new('RGB', (W, H), pal['plate'])
    speed(im, pal)
    tach(im, pal)
    block(im, pal)
    return im.resize((W * KO // K, H * KO // K), Image.LANCZOS)


def lit_lamps():
    """bloco do meio com todas as lentes acesas, cada uma na sua cor, com o clarão em volta"""
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d, dg = ImageDraw.Draw(lay), ImageDraw.Draw(glow)
    for j, cy in enumerate(LAMP_Y):
        for i, cx in enumerate(LAMP_X):
            col = LENS[j][i]
            if col is None:
                continue
            lens(d, cx, cy, col, dict(cell=tuple(int(v * 0.3) for v in col)), on=True)
            c, r = P(cx, cy), K * (LAMP_R + 0.45)
            dg.ellipse([c[0] - r, c[1] - r * PY, c[0] + r, c[1] + r * PY], fill=col + (255,))
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.alpha_composite(lay)
    g = glow.filter(ImageFilter.GaussianBlur(K * 0.6))
    g.putalpha(g.getchannel('A').point(lambda v: int(v * 0.5)))
    out.alpha_composite(g)
    x0, x1 = int(BLOCK[0] * K), int(BLOCK[1] * K)
    return out.crop((x0, 0, x1, H)).resize(((x1 - x0) * KO // K, H * KO // K), Image.LANCZOS)


def ico_defrost(d, cx, cy, u, col, lw):
    """desembaçador traseiro: vidro (trapézio) com três setas onduladas subindo"""
    uy = u * PY
    d.polygon([(cx - 2.6 * u, cy + 1.6 * uy), (cx + 2.6 * u, cy + 1.6 * uy), (cx + 2.1 * u, cy - 1.6 * uy), (cx - 2.1 * u, cy - 1.6 * uy)], outline=col, width=lw)
    for k in (-1.1, 0, 1.1):
        x = cx + k * u
        d.line([(x, cy + 1.1 * uy), (x + 0.35 * u, cy + 0.5 * uy), (x - 0.35 * u, cy - 0.1 * uy), (x + 0.2 * u, cy - 0.9 * uy)], fill=col, width=lw)


def ico_fog(d, cx, cy, u, col, lw):
    """farol de neblina traseiro: lente em meia-lua, riscos retos e o risco ondulado atravessado"""
    uy = u * PY
    d.chord([cx - 2.6 * u, cy - 1.5 * uy, cx + 0.4 * u, cy + 1.5 * uy], 90, 270, outline=col, width=lw)
    d.line([(cx - 1.1 * u, cy - 1.5 * uy), (cx - 1.1 * u, cy + 1.5 * uy)], fill=col, width=lw)
    for k in (-1.0, 0, 1.0):
        d.line([(cx - 0.4 * u, cy + k * uy), (cx + 2.4 * u, cy + k * uy)], fill=col, width=lw)
    d.line([(cx + 1.0 * u, cy - 1.7 * uy), (cx + 0.6 * u, cy - 0.6 * uy), (cx + 1.3 * u, cy + 0.5 * uy), (cx + 0.9 * u, cy + 1.7 * uy)], fill=col, width=lw)


# interruptores (colunas, linhas dentro da caixa SW): retângulo de cada lente
SW_LENS = [(1.5, 2.4, 14.4, 7.0), (1.5, 9.6, 14.4, 15.4)]


def switches(on=False):
    sx0, sy0, sx1, sy1 = SW
    w, h = int(round((sx1 - sx0) * K)), int(round((sy1 - sy0) * K))
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0) if on else (16, 15, 18, 255))
    d = ImageDraw.Draw(im)
    if not on:   # moldura escura dos dois botões, com a borda de cima clara (como a arte)
        d.rounded_rectangle([K * 0.4, K * 0.9, w - K * 0.4, h - K * 0.6], radius=K * 0.8, fill=(10, 10, 12), outline=(52, 50, 58), width=max(2, int(K * 0.25)))
    for i, (x0, y0, x1, y1) in enumerate(SW_LENS):
        box = [x0 * K, y0 * K, x1 * K, y1 * K]
        if on:
            glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            ImageDraw.Draw(glow).rounded_rectangle([box[0] - K * 0.6, box[1] - K * 0.6, box[2] + K * 0.6, box[3] + K * 0.6], radius=K, fill=(255, 50, 30, 150))
            im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(K * 0.6)))
            d = ImageDraw.Draw(im)
            d.rounded_rectangle([box[0] - K * 0.3, box[1] - K * 0.3, box[2] + K * 0.3, box[3] + K * 0.3], radius=K * 0.5, fill=(20, 8, 8, 255))
            d.rounded_rectangle(box, radius=K * 0.4, fill=(236, 46, 28, 255))
            d.rounded_rectangle([box[0], box[1], box[2], (box[1] + box[3]) / 2], radius=K * 0.4, fill=(250, 84, 50, 255))
            ink = (255, 214, 150, 255)
        else:
            d.rounded_rectangle([box[0] - K * 0.3, box[1] - K * 0.3, box[2] + K * 0.3, box[3] + K * 0.3], radius=K * 0.5, fill=(6, 6, 8))
            d.rounded_rectangle(box, radius=K * 0.4, fill=(64, 16, 16))
            d.rounded_rectangle([box[0], box[1], box[2], (box[1] + box[3]) / 2], radius=K * 0.4, fill=(74, 20, 19))
            ink = (112, 40, 34)
        cx, cy = (x0 + x1) / 2 * K, (y0 + y1) / 2 * K
        (ico_defrost if i == 0 else ico_fog)(d, cx, cy, K * 0.62, ink, max(2, int(K * 0.24)))
    return im.resize((w * KO // K, h * KO // K), Image.LANCZOS)


def main():
    out = sys.argv[1]
    render(DAY).save(os.path.join(out, 'br-santana-cluster.png'), optimize=True)
    render(LIT).save(os.path.join(out, 'br-santana-cluster-lit.png'), optimize=True)
    lit_lamps().save(os.path.join(out, 'br-santana-lamps.png'), optimize=True)
    switches().save(os.path.join(out, 'br-santana-switch.png'), optimize=True)
    switches(True).save(os.path.join(out, 'br-santana-switch-on.png'), optimize=True)
    r = lambda v: round(v, 2)
    print('quadro', (X0, Y0), (r(X1 - X0), r(Y1 - Y0)))
    print('velocímetro', r(X0 + SPEED['x']), r(Y0 + SPEED['y']), 'R', SPEED['R'], 'ângulos', {v: r(a_speed(v)) for v in (20, 220)})
    print('conta-giros', r(X0 + TACH['x']), r(Y0 + TACH['y']), 'R', TACH['R'], 'ângulos', {v: r(a_tach(v)) for v in (0, 1, 7)})
    print('bloco x', r(X0 + BLOCK[0]), 'largura', r(BLOCK[1] - BLOCK[0]), 'lentes x', [r(X0 + v) for v in LAMP_X], 'y', [r(Y0 + v) for v in LAMP_Y])
    print('relógio', [r(X0 + LCD[0]), r(Y0 + LCD[1]), r(X0 + LCD[2]), r(Y0 + LCD[3])])
    print('hodômetro', r(X0 + SPEED['x'] + 0.3), r(Y0 + SPEED['y'] - 5.6), 'parcial', r(Y0 + SPEED['y'] + 5.6))
    print('interruptores', SW, [(r(SW[0] + a), r(SW[1] + b), r(SW[0] + c), r(SW[1] + e)) for a, b, c, e in SW_LENS])


if __name__ == '__main__':
    main()
