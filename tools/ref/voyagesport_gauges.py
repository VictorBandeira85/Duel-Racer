"""Quadro do Jornada Sport (VW Voyage Sport 1.8 1992), copiando a foto do quadro real que o Victor mandou.
Da esquerda para a direita, numa placa preta fosca:
- velocímetro redondo grande (cortado reto embaixo), 20 a 220 km/h em 269°: blocos brancos a cada 20,
  três riscos finos entre eles, números (20, 40 ... 220) por DENTRO das marcações, "km" e o hodômetro
  de seis tambores acima do eixo, parcial de quatro abaixo (o último branco), "km/h" e o botão do parcial
- bloco do meio: esquema das marchas (1 3 5 / 2 4 R), faixa de ícones (setas, bateria, óleo, farol
  alto), duas fileiras de cinco lentes redondas (verde, vermelha, cega, vermelha, azul / cega, amarela,
  cega, vermelha, cega), APAGADAS, faixa de ícones (afogador, freio) e o relógio de cristal líquido
- conta-giros redondo 0 a 7 ("1/min x1000"): o 0 é o bloco sem número onde o ponteiro descansa, 0-1
  apertado (19,5°) e depois 28,25° por 1000; faixa laranja hachurada de 6,3 a 6,8 e cheia até 7. Na
  parte de baixo, duas janelas em leque mais fundas: temperatura (esquerda, com o LED vermelho) e
  combustível (direita, reserva com a ponta amarela), marcas na borda do próprio conta-giros
Algarismos quadrados da fábrica (os `SQ` de gol_gauges.py), largos como na foto. Sem marca no mostrador.
O jogo desenha ponteiros, tambores dos hodômetros, a hora no cristal líquido e as luzes acesas
(voyageSportCluster em cockpit.ts).
Saídas (4 px por pixel do jogo):
  br-voyagesport-cluster.png      de dia
  br-voyagesport-cluster-lit.png  aceso (noite e túnel): fundo verde-garrafa escuro iluminado por trás,
                                  números e marcações verde-claros quase brancos
  br-voyagesport-lamps.png        o bloco do meio com todas as lentes acesas (o jogo copia a casa de cada uma)
Uso: python3 tools/ref/voyagesport_gauges.py <src/assets/cockpit>
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from gol_gauges import SQ  # noqa: E402  (algarismos da mesma fábrica)

K, KO, PY = 12, 4, 8 / 7
X0, Y0, X1, Y1 = 67.5, 33.3, 188.5, 86.1    # placa dos mostradores na arte (voyagesport_cockpit.py)
W, H = int(round((X1 - X0) * K)), int(round((Y1 - Y0) * K))
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FR = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
# medidas dentro da placa (colunas, linhas), tiradas da foto (1 coluna = 9,87 px da foto)
SPEED = dict(x=25.7, y=28.4, R=23.0, a20=135.0, per=269.4 / 200)
TACH = dict(x=98.0, y=28.4, R=22.0, a0=175.5, a1=195.0, per=28.25)
CHORD = 51.2                                 # os dois mostradores são cortados retos nesta linha
BLOCK = (51.7, 72.6)                         # bloco do meio (colunas)
GEAR = (52.5, 1.8, 71.8, 11.4)               # esquema das marchas
ICON1, ICON2 = (16.8, 20.8), (33.0, 36.9)    # faixas de ícones (linhas)
LAMP_X, LAMP_Y = (53.95, 58.05, 62.15, 66.25, 70.35), (24.2, 28.9)
LAMP_R = 1.25
LCD = (54.0, 40.9, 70.3, 48.6)               # vidro do relógio
# lentes: cor de cada casa (None = cega)
LENS = [[(60, 200, 90), (235, 50, 40), None, (235, 50, 40), (70, 110, 255)], [None, (255, 190, 40), None, (235, 50, 40), None]]
# marcas dos pequenos, em graus em volta do centro do conta-giros
TEMP_HOT, TEMP_LED, TEMP_COLD, TEMP_MIN = 162.0, 147.0, 134.0, 128.0
FUEL_FULL, FUEL_HALF, FUEL_LOW, FUEL_RES = 18.0, 35.5, 46.5, 53.0
DAY = dict(plate=(40, 40, 42), edge=(12, 12, 14), face=(25, 25, 27), face2=(17, 17, 19), well=(8, 8, 10), ink=(226, 232, 214),
           band=(240, 120, 30), dark=(7, 7, 9), cell=(17, 17, 19), strip=(24, 24, 26), icon=(214, 218, 206), text=(206, 212, 198),
           lcd=(170, 180, 152), lcd2=(150, 160, 134), knob=(16, 16, 18), amber=(240, 200, 60), drum=(10, 10, 12), white=(226, 226, 216))
# aceso: verde-garrafa profundo, mais claro no centro de cada mostrador (luz por trás de um difusor);
# o que brilha são os números, as marcações e os letreiros (verde-claro quase branco)
LIT = dict(plate=(5, 15, 11), edge=(2, 8, 5), face=(18, 70, 45), face2=(14, 56, 36), core=(30, 95, 62), well=(9, 40, 26), ink=(190, 245, 205),
           band=(244, 110, 44), dark=(3, 12, 8), cell=(4, 14, 10), strip=(7, 24, 16), icon=(120, 186, 142), text=(190, 245, 205),
           lcd=(66, 130, 92), lcd2=(54, 112, 78), knob=(4, 16, 10), amber=(240, 222, 110), drum=(3, 12, 8), white=(170, 214, 180))


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
    return lay.width / K, lay.height / K


def text(im, s, cx, cy, h, col, font=FR, wide=1.0):
    f = ImageFont.truetype(font, int(round(h * K * 1.4)))
    bb = f.getbbox(s)
    lay = Image.new('L', (bb[2] - bb[0] + 4, bb[3] - bb[1] + 4), 0)
    ImageDraw.Draw(lay).text((2 - bb[0], 2 - bb[1]), s, font=f, fill=255)
    lay = lay.resize((max(1, int(lay.width * wide)), max(1, int(lay.height * PY))), Image.LANCZOS)
    im.paste(col, (int(round(cx * K - lay.width / 2)), int(round(cy * K - lay.height / 2))), lay)


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
    ImageDraw.Draw(im).line([((g['x'] - R * 0.62) * K, CHORD * K), ((g['x'] + R * 0.62) * K, CHORD * K)], fill=pal['edge'], width=max(2, int(K * 0.35)))


def a_speed(v):
    return SPEED['a20'] + (v - 20) * SPEED['per']


def speed(im, pal):
    g = SPEED
    R = g['R']
    disc(im, pal, g)
    d = ImageDraw.Draw(im)
    for v in range(20, 221, 5):
        big = v % 20 == 0
        tick(d, g, a_speed(v), R - (2.5 if big else 2.0), R, 1.15 if big else 0.42, pal['ink'])
    for v in range(20, 221, 20):
        a = math.radians(a_speed(v))
        s = str(v)
        hh = 2.5
        ww = (6.6 if len(s) == 3 else 4.6)
        rr = R - 2.5 - 0.75 - abs(math.cos(a)) * ww / 2 - abs(math.sin(a)) * hh / 2
        number(im, s, g['x'] + math.cos(a) * rr, g['y'] + math.sin(a) * rr * PY, hh, pal['ink'], 1.22 if len(s) == 3 else 1.3)
    text(im, 'km', g['x'], g['y'] - 9.4 * PY, 1.35, pal['text'], FB, 1.15)
    text(im, 'km/h', g['x'] - 0.2, g['y'] + 13.3 * PY, 1.45, pal['text'], FB, 1.15)
    # tambores do hodômetro (seis) e do parcial (quatro, o último branco): o jogo põe os algarismos
    for n, cx, cy, pitch, ww, last in ((6, g['x'] + 0.2, g['y'] - 6.0 * PY, 3.55, 2.7, False), (4, g['x'] + 0.3, g['y'] + 6.4 * PY, 4.0, 2.6, True)):
        for i in range(n):
            x = cx + (i - (n - 1) / 2) * pitch
            a, b = P(x - ww / 2, cy - 1.75), P(x + ww / 2, cy + 1.75)
            d.rectangle([a[0] - K * 0.2, a[1] - K * 0.2, b[0] + K * 0.2, b[1] + K * 0.2], fill=pal['edge'])
            d.rectangle([a[0], a[1], b[0], b[1]], fill=pal['white'] if last and i == n - 1 else pal['drum'])
    for sx in (-1, 1):   # parafusos dos lados do eixo
        c = P(g['x'] + sx * 8.7, g['y'])
        d.ellipse([c[0] - K * 0.75, c[1] - K * 0.75 * PY, c[0] + K * 0.75, c[1] + K * 0.75 * PY], fill=pal['dark'])
    # botão do parcial, embaixo
    c = P(g['x'] - 1.0, g['y'] + 19.0 * PY)
    d.line([P(g['x'] - 0.6, g['y'] + 16.0 * PY), c], fill=pal['dark'], width=int(K * 0.5))
    d.ellipse([c[0] - K * 1.2, c[1] - K * 1.2 * PY, c[0] + K * 1.2, c[1] + K * 1.2 * PY], fill=pal['knob'])
    d.ellipse([c[0] - K * 0.7, c[1] - K * 0.9, c[0] - K * 0.1, c[1] - K * 0.3], fill=tuple(min(255, v + 70) for v in pal['knob']))


def a_tach(v):
    g = TACH
    return g['a0'] + (g['a1'] - g['a0']) * v if v <= 1 else g['a1'] + (v - 1) * g['per']


# janelas em leque dos pequenos (em raios do conta-giros, a partir do centro; a da direita é espelhada)
WELL = [(-1.2, 0.15), (-0.72, 0.15), (-0.62, 0.22), (-0.52, 0.38), (-0.45, 0.56), (-0.45, 0.72), (-0.49, 1.2), (-1.2, 1.2)]


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
    # faixa: hachurada de 6,3 a 6,8 (riscos laranja) e cheia de 6,8 a 7
    n = 9
    for k in range(n):
        tick(d, g, a_tach(6.3 + 0.5 * k / (n - 1)), R - 2.0, R, 0.42, pal['band'])
    for k in range(13):
        tick(d, g, a_tach(6.8 + 0.2 * k / 12), R - 2.3, R, 0.5, pal['band'])
    for v in [0, 1 / 3, 2 / 3] + [1 + i * 0.25 for i in range(25)]:
        big = abs(v - round(v)) < 1e-6
        if 6.3 < v < 7 and not big:
            tick(d, g, a_tach(v), R - 2.0, R - 1.2, 0.42, pal['ink'])   # na faixa, só um toque branco
            continue
        tick(d, g, a_tach(v), R - (2.4 if big else 1.9), R, 1.3 if big else 0.45, pal['ink'])
    for i in range(1, 8):
        a = math.radians(a_tach(i))
        hh, ww = 2.9, 2.5
        rr = R - 2.4 - 0.8 - abs(math.cos(a)) * ww / 2 - abs(math.sin(a)) * hh / 2
        number(im, str(i), g['x'] + math.cos(a) * rr, g['y'] + math.sin(a) * rr * PY, hh, pal['ink'], 1.25)
    text(im, '1/min x1000', g['x'], g['y'] + 7.0 * PY, 1.4, pal['text'], FB, 1.05)
    # pequenos: temperatura à esquerda (frio embaixo, quente em cima, LED entre eles), combustível à direita
    tick(d, g, TEMP_HOT, R * 0.80, R * 0.97, 0.5, pal['ink'])
    tick(d, g, TEMP_COLD, R * 0.78, R * 0.97, 1.5, pal['ink'])
    tick(d, g, TEMP_MIN, R * 0.76, R * 0.95, 0.45, pal['ink'])
    c = at(g, TEMP_LED, R * 0.9)
    d.ellipse([c[0] - K * 0.75, c[1] - K * 0.75 * PY, c[0] + K * 0.75, c[1] + K * 0.75 * PY], fill=pal['dark'])
    d.ellipse([c[0] - K * 0.5, c[1] - K * 0.5 * PY, c[0] + K * 0.5, c[1] + K * 0.5 * PY], fill=(84, 14, 16))
    tick(d, g, FUEL_FULL, R * 0.80, R * 0.97, 0.5, pal['ink'])
    tick(d, g, FUEL_HALF, R * 0.82, R * 0.97, 0.5, pal['ink'])
    tick(d, g, FUEL_LOW, R * 0.78, R * 0.95, 0.45, pal['ink'])
    tick(d, g, FUEL_RES, R * 0.78, R * 0.97, 1.5, pal['ink'])
    tick(d, g, FUEL_RES, R * 0.80, R * 0.90, 0.7, pal['amber'])
    u = K * 0.8
    cx, cy = P(g['x'] - 0.25 * R, g['y'] + 0.62 * R * PY)
    ico_temp(d, cx, cy, u, pal['icon'])
    cx, cy = P(g['x'] + 0.25 * R, g['y'] + 0.62 * R * PY)
    ico_pump(d, cx, cy, u, pal['icon'], pal['face2'] if 'core' not in pal else pal['face'])


def icons1(d, y, u, lw, cols):
    """setas, bateria, óleo e farol alto, em cima das lentes 1, 2, 4 e 5"""
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
    d.line([(x - 1.7 * u, y + 0.2 * uy), (x - 0.9 * u, y + 0.2 * uy)], fill=c, width=max(1, lw - 1))
    d.line([(x + 0.9 * u, y + 0.2 * uy), (x + 1.7 * u, y + 0.2 * uy)], fill=c, width=max(1, lw - 1))
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


def icons2(d, y, u, lw, cols):
    """afogador e freio, embaixo das lentes 2 e 4"""
    xs = [v * K for v in LAMP_X]
    uy = u * PY
    c, x = cols[0], xs[1]   # afogador: borboleta atravessada no duto
    d.line([(x - 1.4 * u, y - 1.5 * uy), (x - 1.4 * u, y + 1.5 * uy)], fill=c, width=lw)
    d.line([(x + 1.4 * u, y - 1.5 * uy), (x + 1.4 * u, y + 1.5 * uy)], fill=c, width=lw)
    d.line([(x - 1.4 * u, y - 0.9 * uy), (x + 1.4 * u, y + 0.9 * uy)], fill=c, width=lw)
    c, x = cols[1], xs[3]   # freio: (!) num círculo entre dois arcos
    d.ellipse([x - 1.5 * u, y - 1.5 * uy, x + 1.5 * u, y + 1.5 * uy], outline=c, width=lw)
    d.rectangle([x - 0.25 * u, y - 0.9 * uy, x + 0.25 * u, y + 0.2 * uy], fill=c)
    d.rectangle([x - 0.25 * u, y + 0.55 * uy, x + 0.25 * u, y + 0.9 * uy], fill=c)
    d.arc([x - 2.5 * u, y - 2.1 * uy, x + 2.5 * u, y + 2.1 * uy], 135, 225, fill=c, width=lw)
    d.arc([x - 2.5 * u, y - 2.1 * uy, x + 2.5 * u, y + 2.1 * uy], -45, 45, fill=c, width=lw)


def lens(d, cx, cy, col, pal, on=False):
    """casa quadrada com a lente redonda; apagada, a lente guarda só um resto da cor do plástico"""
    a, b = P(cx - 1.8, cy - 2.05), P(cx + 1.8, cy + 2.05)
    d.rounded_rectangle([a[0], a[1], b[0], b[1]], radius=K * 0.5, fill=pal['cell'])
    c = P(cx, cy)
    r = K * LAMP_R
    if col is None:
        body = (20, 20, 22)
    elif on:
        body = col
    else:
        body = tuple(int(v * 0.26 + 10) for v in col)
    d.ellipse([c[0] - r, c[1] - r * PY, c[0] + r, c[1] + r * PY], fill=body)
    hi = tuple(min(255, v + (110 if on else 46)) for v in body)
    d.ellipse([c[0] - r * 0.5, c[1] - r * 0.6 * PY, c[0] - r * 0.05, c[1] - r * 0.15 * PY], fill=hi)


def block(im, pal):
    d = ImageDraw.Draw(im)
    a, b = P(BLOCK[0], 1.0), P(BLOCK[1], H / K - 0.6)
    d.rectangle([a[0], a[1], b[0], b[1]], fill=pal['edge'])
    d.rectangle([a[0] + K * 0.3, a[1] + K * 0.3, b[0] - K * 0.3, b[1] - K * 0.3], fill=tuple(int(v * 0.86) for v in pal['plate']))
    # esquema das marchas
    x0, y0, x1, y1 = GEAR
    d.rounded_rectangle([x0 * K, y0 * K, x1 * K, y1 * K], radius=K * 0.5, fill=pal['strip'])
    gx = [x0 + (x1 - x0) * f for f in (0.26, 0.5, 0.74)]
    ya, yb, ym = y0 + 2.0, y1 - 2.0, (y0 + y1) / 2
    lw = max(1, int(K * 0.34))
    for x in gx:
        d.line([P(x, ya + 1.5), P(x, yb - 1.5)], fill=pal['icon'], width=lw)
    d.line([P(gx[0], ym), P(gx[2], ym)], fill=pal['icon'], width=lw)
    for x, top, bot in zip(gx, '135', '24R'):
        number(im, top, x, ya, 1.75, pal['icon'], 1.2, 1.5)
        if bot == 'R':
            text(im, 'R', x, yb, 1.5, pal['icon'], FB, 1.15)
        else:
            number(im, bot, x, yb, 1.75, pal['icon'], 1.2, 1.5)
    # faixas de ícones e as dez casas
    u, lw = K * 0.6, max(1, int(K * 0.3))
    for (ya, yb) in (ICON1, ICON2):
        d.rounded_rectangle([(BLOCK[0] + 0.7) * K, ya * K, (BLOCK[1] - 0.7) * K, yb * K], radius=K * 0.6, fill=pal['strip'])
    icons1(d, (ICON1[0] + ICON1[1]) / 2 * K, u, lw, [pal['icon']] * 4)
    icons2(d, (ICON2[0] + ICON2[1]) / 2 * K, u, lw, [pal['icon']] * 2)
    for j, cy in enumerate(LAMP_Y):
        for i, cx in enumerate(LAMP_X):
            lens(d, cx, cy, LENS[j][i], pal)
    # relógio de cristal líquido: moldura e vidro (o jogo escreve a hora)
    x0, y0, x1, y1 = LCD
    d.rounded_rectangle([(x0 - 1.0) * K, (y0 - 1.0) * K, (x1 + 1.0) * K, (y1 + 1.0) * K], radius=K * 0.7, fill=pal['edge'])
    d.rounded_rectangle([x0 * K, y0 * K, x1 * K, y1 * K], radius=K * 0.4, fill=pal['lcd'])
    d.rounded_rectangle([x0 * K, (y1 - 1.6) * K, x1 * K, y1 * K], radius=K * 0.4, fill=pal['lcd2'])


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
            c, r = P(cx, cy), K * (LAMP_R + 0.5)
            dg.ellipse([c[0] - r, c[1] - r * PY, c[0] + r, c[1] + r * PY], fill=col + (255,))
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.alpha_composite(lay)
    g = glow.filter(ImageFilter.GaussianBlur(K * 0.7))
    g.putalpha(g.getchannel('A').point(lambda v: int(v * 0.5)))
    out.alpha_composite(g)
    x0, x1 = int(BLOCK[0] * K), int(BLOCK[1] * K)
    return out.crop((x0, 0, x1, H)).resize(((x1 - x0) * KO // K, H * KO // K), Image.LANCZOS)


def main():
    out = sys.argv[1]
    render(DAY).save(os.path.join(out, 'br-voyagesport-cluster.png'), optimize=True)
    render(LIT).save(os.path.join(out, 'br-voyagesport-cluster-lit.png'), optimize=True)
    lit_lamps().save(os.path.join(out, 'br-voyagesport-lamps.png'), optimize=True)
    r = lambda v: round(v, 2)
    print('quadro', (X0, Y0), (X1 - X0, r(Y1 - Y0)))
    print('velocímetro', r(X0 + SPEED['x']), r(Y0 + SPEED['y']), 'R', SPEED['R'], 'ângulos', {v: r(a_speed(v)) for v in (20, 220)})
    print('conta-giros', r(X0 + TACH['x']), r(Y0 + TACH['y']), 'R', TACH['R'], 'ângulos', {v: r(a_tach(v)) for v in (0, 1, 7)})
    print('bloco x', r(X0 + BLOCK[0]), 'largura', r(BLOCK[1] - BLOCK[0]), 'lentes x', [r(X0 + v) for v in LAMP_X], 'y', [r(Y0 + v) for v in LAMP_Y])
    print('relógio', [r(X0 + LCD[0]), r(Y0 + LCD[1]), r(X0 + LCD[2]), r(Y0 + LCD[3])])


if __name__ == '__main__':
    main()
