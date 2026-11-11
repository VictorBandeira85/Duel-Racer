"""Quadro do Jornada LS (VW Voyage LS 1986), copiando a foto do quadro real que o Victor mandou. Cinco
blocos em fila, da esquerda para a direita: relógio de ponteiros (12, 3, 6 e 9, botão de acerto
embaixo à direita); combustível (em cima) e temperatura (embaixo), pequenos, com o eixo escondido
abaixo de cada janela; velocímetro 20-190 km/h (números por FORA das marcações: 20, 40, 60, 80 em
vermelho, 100, 120, 140, 160 e 190, este no espaço de um passo só, como no carro), hodômetro em cima
do eixo, parcial embaixo e "km/h"; bloco de luzes-espia em três fileiras de duas (farol alto e setas,
pisca-alerta e freio, bateria e óleo), APAGADAS; conta-giros 0-8 (x1000 rpm) com o 0-1 apertado e a
faixa vermelha de 6,5 a 8. Algarismos quadrados da fábrica (os `SQ` de gol_gauges.py), em traço mais fino.
Cobre a janela inteira dos mostradores da arte (os números errados e os ícones do 5º bloco somem).
O jogo desenha ponteiros, hodômetros e as luzes acesas (voyageCluster em cockpit.ts).
Saídas (4 px por pixel do jogo):
  br-voyage-cluster.png      de dia
  br-voyage-cluster-lit.png  aceso (noite e túnel): fundo verde-garrafa iluminado por trás, números verde-claros quase brancos
  br-voyage-lamps.png        o bloco das luzes-espia com todas acesas (o jogo copia a casa de cada uma)
Uso: python3 tools/ref/voyage_gauges.py <src/assets/cockpit>
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from gol_gauges import SQ  # noqa: E402  (algarismos da mesma fábrica)

K, KO, PY = 12, 4, 8 / 7
X0, Y0, X1, Y1 = 56.0, 33.6, 200.0, 76.1    # janela dos mostradores na arte (voyage_cockpit.py: 55,9..200,1 x 33,7..76,0)
W, H = int(round((X1 - X0) * K)), int(round((Y1 - Y0) * K))
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FR = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
TOP, BOT = 1.2, 41.3                         # linhas do alto e do pé dos blocos (dentro da janela)
# blocos (colunas dentro da janela): relógio, pequenos, velocímetro, luzes, conta-giros
B_CLOCK, B_SMALL, B_SPEED, B_LAMPS, B_TACH = (1.2, 24.8), (26.2, 48.2), (49.6, 92.6), (94.0, 117.6), (119.0, 142.6)
CLOCK = dict(x=13.6, y=21.25)
SPEED = dict(x=71.1, y=24.4, a20=143.0, per=31.9 / 20, a190=401.0)   # 20 a 143°, 31,9° a cada 20 km/h até 160; 190 a 401°
TACH = dict(x=130.2, y=24.4, a0=140.0, a1=158.0, per=35.3)           # 0 a 140°, 1 a 158°, depois 35,3° por 1000 rpm
FUEL = dict(x=37.2, y=17.9, win=(1.2, 14.2))                         # eixo abaixo da janela; arco de 238° a 302°
TEMP = dict(x=37.2, y=45.0, win=(28.4, 41.3))
LAMP_X, LAMP_Y = (99.9, 111.7), (7.9, 21.25, 34.6)                   # centros das casas das luzes
DAY = dict(gap=(11, 11, 13), face=(33, 34, 36), face2=(26, 27, 29), ink=(228, 228, 218), red=(232, 72, 52), band=(214, 52, 40),
           dark=(9, 9, 11), cell=(40, 41, 43), hot=(226, 190, 70), knob=(14, 14, 16), text=(196, 196, 188))
# aceso: verde-garrafa profundo, mais claro no centro de cada mostrador (luz por trás de um difusor);
# o que brilha são os números, as marcações e os letreiros (verde-claro quase branco)
LIT = dict(gap=(6, 26, 17), face=(18, 70, 45), face2=(14, 56, 36), core=(30, 95, 62), ink=(190, 245, 205), red=(255, 150, 120),
           band=(236, 84, 46), dark=(3, 12, 8), cell=(17, 66, 43), icon=(112, 176, 134), hot=(232, 236, 140), knob=(4, 16, 10), text=(190, 245, 205))


def P(x, y):
    return (x * K, y * K)


def at(g, ang, rr):
    a = math.radians(ang)
    return ((g['x'] + math.cos(a) * rr) * K, (g['y'] + math.sin(a) * rr * PY) * K)


def tick(d, g, ang, r0, r1, w, col):
    d.line([at(g, ang, r0), at(g, ang, r1)], fill=col, width=max(1, int(round(w * K))))


def number(im, s, cx, cy, h, col, squeeze=1.0, stroke=1.3):
    """número com os algarismos quadrados da fábrica, centrado em (cx, cy) (colunas, linhas); h em colunas"""
    u = h * K / (6 + stroke)
    t = u * stroke
    adv = u * 6.0
    lay = Image.new('L', (int(adv * len(s) + t * 2), int((u * 6 + t * 2) * PY)), 0)
    dd = ImageDraw.Draw(lay)
    for i, ch in enumerate(s):
        ox = t + i * adv + (u * 1.0 if ch == '1' else 0) * 0
        for path in SQ.get(ch, []):
            pts = [(ox + x * u, (t + y * u) * PY) for x, y in path]
            dd.line(pts, fill=255, width=int(round(t)), joint='curve')
            for x, y in pts:
                dd.ellipse([x - t / 2, y - t / 2, x + t / 2, y + t / 2], fill=255)
    bb = lay.getbbox()
    lay = lay.crop(bb)
    lay = lay.resize((max(1, int(lay.width * squeeze)), lay.height), Image.LANCZOS)
    im.paste(col, (int(round(cx * K - lay.width / 2)), int(round(cy * K - lay.height / 2))), lay)
    return lay.width / K, lay.height / K


def text(im, s, cx, cy, h, col, font=FR, squeeze=0.9):
    f = ImageFont.truetype(font, int(round(h * K * 1.4)))
    bb = f.getbbox(s)
    lay = Image.new('L', (bb[2] - bb[0] + 4, bb[3] - bb[1] + 4), 0)
    ImageDraw.Draw(lay).text((2 - bb[0], 2 - bb[1]), s, font=f, fill=255)
    lay = lay.resize((max(1, int(lay.width * squeeze)), max(1, int(lay.height * PY))), Image.LANCZOS)
    im.paste(col, (int(round(cx * K - lay.width / 2)), int(round(cy * K - lay.height / 2))), lay)


def block(d, pal, xr, y0=TOP, y1=BOT, col=None):
    """bloco de mostrador: placa de cantos arredondados, um pouco mais escura embaixo"""
    a, b = P(xr[0], y0), P(xr[1], y1)
    d.rounded_rectangle([a[0], a[1], b[0], b[1]], radius=K * 1.3, fill=pal['dark'])
    d.rounded_rectangle([a[0] + K * 0.35, a[1] + K * 0.35, b[0] - K * 0.35, b[1] - K * 0.35], radius=K * 1.1, fill=col or pal['face'])
    if 'core' in pal and col is None:   # aceso: clarão suave no meio do bloco
        cx, cy, rx, ry = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (b[0] - a[0]) / 2 - K * 0.6, (b[1] - a[1]) / 2 - K * 0.6
        n = 16
        for i in range(n):
            t = (i + 1) / n
            c = tuple(int(round(pal['face'][k] + (pal['core'][k] - pal['face'][k]) * t ** 1.5)) for k in range(3))
            f = 1 - 0.8 * t
            d.ellipse([cx - rx * f, cy - ry * f, cx + rx * f, cy + ry * f], fill=c)
        return
    f2 = pal['face2']
    hgt = b[1] - a[1]
    for i in range(int(hgt * 0.45)):
        t = i / (hgt * 0.45)
        y = b[1] - K * 0.8 - i
        c = tuple(int(f2[k] * (1 - t) + (col or pal['face'])[k] * t) for k in range(3))
        d.line([(a[0] + K * 1.0, y), (b[0] - K * 1.0, y)], fill=c)


def clock(im, d, pal):
    g = CLOCK
    block(d, pal, B_CLOCK)
    for h in range(12):
        ang = -90 + h * 30
        if h in (3, 9):  # no 3 e no 9 a marcação é um bloco curto, com o número por fora
            tick(d, g, ang, 6.0, 7.5, 0.95, pal['ink'])
        elif h in (0, 6):
            tick(d, g, ang, 6.6, 8.9, 0.75, pal['ink'])
        else:
            tick(d, g, ang, 7.3, 8.9, 0.45, pal['ink'])
    number(im, '12', g['x'], g['y'] - 11.3 * PY, 2.2, pal['ink'], 0.8)
    number(im, '6', g['x'], g['y'] + 11.3 * PY, 2.2, pal['ink'])
    number(im, '3', g['x'] + 9.6, g['y'], 2.2, pal['ink'], 0.9)
    number(im, '9', g['x'] - 9.6, g['y'], 2.2, pal['ink'], 0.9)
    # botão de acerto, embaixo à direita
    c = P(g['x'] + 7.4, g['y'] + 12.2 * PY)
    d.ellipse([c[0] - K * 1.7, c[1] - K * 1.7 * PY, c[0] + K * 1.7, c[1] + K * 1.7 * PY], fill=pal['dark'])
    d.ellipse([c[0] - K * 1.25, c[1] - K * 1.25 * PY, c[0] + K * 1.25, c[1] + K * 1.25 * PY], fill=pal['knob'])
    d.ellipse([c[0] - K * 0.7, c[1] - K * 0.9, c[0] - K * 0.1, c[1] - K * 0.3], fill=tuple(min(255, v + 60) for v in pal['knob']))


def ico_pump(d, cx, cy, u, col, bg):
    d.rectangle([cx - 1.5 * u, cy - 1.9 * u, cx + 0.5 * u, cy + 1.7 * u], fill=col)
    d.rectangle([cx - 1.05 * u, cy - 1.45 * u, cx + 0.05 * u, cy - 0.5 * u], fill=bg)
    d.line([(cx + 0.5 * u, cy - 0.9 * u), (cx + 1.5 * u, cy - 0.2 * u), (cx + 1.5 * u, cy + 1.1 * u)], fill=col, width=max(1, int(0.4 * u)))


def ico_temp(d, cx, cy, u, col):
    d.rectangle([cx - 0.3 * u, cy - 2.4 * u, cx + 0.3 * u, cy + 0.6 * u], fill=col)
    d.rectangle([cx - 0.3 * u, cy - 1.9 * u, cx + 1.1 * u, cy - 1.5 * u], fill=col)
    d.rectangle([cx - 0.3 * u, cy - 1.0 * u, cx + 1.1 * u, cy - 0.6 * u], fill=col)
    d.rectangle([cx - 2.2 * u, cy + 1.2 * u, cx + 2.2 * u, cy + 1.6 * u], fill=col)
    d.ellipse([cx - 0.8 * u, cy + 0.2 * u, cx + 0.8 * u, cy + 1.5 * u], fill=col)


def small(d, pal):
    xr = B_SMALL
    block(d, pal, xr, *FUEL['win'])
    block(d, pal, xr, 15.3, 27.3, col=pal['face2'])       # janela cega do meio
    block(d, pal, xr, *TEMP['win'])
    for g, kind in ((FUEL, 'fuel'), (TEMP, 'temp')):
        tick(d, g, 238, 8.6, 11.0, 0.75, pal['ink'])       # começo da escala: reserva / frio
        tick(d, g, 254, 9.8, 11.0, 0.45, pal['ink'])
        tick(d, g, 270, 9.0, 11.0, 0.6, pal['ink'])
        tick(d, g, 286, 9.8, 11.0, 0.45, pal['ink'])
        # fim da escala: bloco inclinado (cheio, branco) ou hachurado (quente, amarelo)
        col = pal['ink'] if kind == 'fuel' else pal['hot']
        n = 9
        for k in range(n):
            if kind == 'temp' and k % 3 == 1:
                continue
            tick(d, g, 299 + k * 6.5 / (n - 1), 8.8, 11.0, 0.3, col)
        u = K * 0.62
        cx, cy = at(g, 270, 6.6)
        if kind == 'fuel':
            ico_pump(d, cx, cy, u, pal['ink'], pal['face'])
        else:
            ico_temp(d, cx, cy - 0.2 * u, u, pal['ink'])


def a_speed(v):
    g = SPEED
    return g['a20'] + (v - 20) * g['per'] if v <= 160 else g['a20'] + 140 * g['per'] + (v - 160) * (g['a190'] - g['a20'] - 140 * g['per']) / 30


def speed(im, d, pal):
    g = SPEED
    block(d, pal, B_SPEED)
    R0, R1 = 10.4, 13.2
    for v in list(range(20, 161, 10)) + [170, 180, 190]:
        big = v % 20 == 0 or v == 190
        tick(d, g, a_speed(v), R0 if big else R0 + 1.5, R1, 0.8 if big else 0.42, pal['ink'])
    for v in (20, 40, 60, 80, 100, 120, 140, 160, 190):
        a = math.radians(a_speed(v))
        s = str(v)
        hh = 3.0
        ww = (2.05 if len(s) == 3 else 1.6) * hh * (0.82 if len(s) == 3 else 0.9) * 0.82
        rr = R1 + 0.9 + abs(math.cos(a)) * ww / 2 + abs(math.sin(a)) * hh / 2
        x, y = g['x'] + math.cos(a) * rr, g['y'] + math.sin(a) * rr * PY
        number(im, s, x, y, hh, pal['red'] if v == 80 else pal['ink'], 0.82 if len(s) == 3 else 0.9)
    text(im, 'km/h', g['x'], g['y'] + 12.6 * PY, 1.7, pal['text'], FB)
    for bx, by, bw, bh in ((-7.2, -8.3, 14.4, 3.8), (-4.4, 5.2, 9.6, 3.6)):   # janelas do hodômetro e do parcial
        a = P(g['x'] + bx, g['y'] + by)
        d.rectangle([a[0] - K * 0.3, a[1] - K * 0.2, a[0] + (bw + 0.3) * K, a[1] + (bh + 0.2) * K], fill=pal['dark'])


def a_tach(v):
    g = TACH
    return g['a0'] + (g['a1'] - g['a0']) * v if v <= 1 else g['a1'] + (v - 1) * g['per']


def tach(im, d, pal):
    g = TACH
    block(d, pal, B_TACH)
    R0, R1 = 5.9, 7.9
    n = 60
    for k in range(n + 1):   # faixa vermelha de 6,5 a 8
        tick(d, g, a_tach(6.5 + 1.5 * k / n), R0 + 0.5, R1, 0.5, pal['band'])
    v = 0.0
    while v <= 8.001:
        big = abs(v - round(v)) < 1e-6
        tick(d, g, a_tach(v), R0 if big else R0 + 1.0, R1, 0.7 if big else 0.38, pal['ink'])
        v += 0.5
    for i in range(9):
        a = math.radians(a_tach(i))
        hh, ww = 2.3, 1.5
        rr = R1 + 0.7 + abs(math.cos(a)) * ww / 2 + abs(math.sin(a)) * hh / 2
        number(im, str(i), g['x'] + math.cos(a) * rr, g['y'] + math.sin(a) * rr * PY, hh, pal['ink'], 0.85)
    text(im, 'x 1000', g['x'] + 0.2, g['y'] + 9.4 * PY, 1.25, pal['text'], FR)
    text(im, 'rpm', g['x'] + 0.2, g['y'] + 11.4 * PY, 1.25, pal['text'], FR)


def lamp_icons(d, cols, u, lw):
    """pictogramas das seis luzes; cols = cor de cada uma (farol alto, setas, alerta, freio, bateria, óleo)"""
    (xa, xb), (y1, y2, y3) = [v * K for v in LAMP_X], [v * K for v in LAMP_Y]
    # farol alto: lente e cinco raios retos
    c = cols[0]
    d.chord([xa - 0.4 * u, y1 - 1.7 * u, xa + 2.8 * u, y1 + 1.7 * u], 270, 90, fill=c)
    for k in (-1.4, -0.7, 0, 0.7, 1.4):
        d.line([(xa - 2.8 * u, y1 + k * u), (xa - 0.9 * u, y1 + k * u)], fill=c, width=lw)
    # setas (esquerda e direita)
    c = cols[1]
    for sx in (-1, 1):
        d.polygon([(xb + sx * 3.1 * u, y1), (xb + sx * 1.5 * u, y1 - 1.6 * u), (xb + sx * 1.5 * u, y1 + 1.6 * u)], fill=c)
        d.rectangle([xb + min(sx * 0.35 * u, sx * 1.5 * u), y1 - 0.65 * u, xb + max(sx * 0.35 * u, sx * 1.5 * u), y1 + 0.65 * u], fill=c)
    # pisca-alerta: triângulo vazado duplo
    c = cols[2]
    d.polygon([(xa, y2 - 2.2 * u), (xa + 2.5 * u, y2 + 1.7 * u), (xa - 2.5 * u, y2 + 1.7 * u)], outline=c, width=lw)
    d.polygon([(xa, y2 - 0.7 * u), (xa + 1.1 * u, y2 + 1.0 * u), (xa - 1.1 * u, y2 + 1.0 * u)], outline=c, width=max(1, lw - 1))
    # freio: (!) num círculo entre dois arcos
    c = cols[3]
    d.ellipse([xb - 1.6 * u, y2 - 1.6 * u, xb + 1.6 * u, y2 + 1.6 * u], outline=c, width=lw)
    d.rectangle([xb - 0.25 * u, y2 - 0.95 * u, xb + 0.25 * u, y2 + 0.25 * u], fill=c)
    d.rectangle([xb - 0.25 * u, y2 + 0.6 * u, xb + 0.25 * u, y2 + 0.95 * u], fill=c)
    d.arc([xb - 2.7 * u, y2 - 2.3 * u, xb + 2.7 * u, y2 + 2.3 * u], 135, 225, fill=c, width=lw)
    d.arc([xb - 2.7 * u, y2 - 2.3 * u, xb + 2.7 * u, y2 + 2.3 * u], -45, 45, fill=c, width=lw)
    # bateria
    c = cols[4]
    d.rectangle([xa - 2.5 * u, y3 - 1.1 * u, xa + 2.5 * u, y3 + 1.6 * u], outline=c, width=lw)
    d.rectangle([xa - 1.9 * u, y3 - 1.8 * u, xa - 0.9 * u, y3 - 1.1 * u], fill=c)
    d.rectangle([xa + 0.9 * u, y3 - 1.8 * u, xa + 1.9 * u, y3 - 1.1 * u], fill=c)
    d.line([(xa - 1.8 * u, y3 + 0.3 * u), (xa - 1.0 * u, y3 + 0.3 * u)], fill=c, width=max(1, lw - 1))
    d.line([(xa + 1.0 * u, y3 + 0.3 * u), (xa + 1.8 * u, y3 + 0.3 * u)], fill=c, width=max(1, lw - 1))
    d.line([(xa + 1.4 * u, y3 - 0.1 * u), (xa + 1.4 * u, y3 + 0.7 * u)], fill=c, width=max(1, lw - 1))
    # almotolia de óleo com a gota
    c = cols[5]
    d.polygon([(xb - 2.0 * u, y3 - 0.2 * u), (xb + 0.9 * u, y3 - 0.2 * u), (xb + 2.9 * u, y3 - 1.2 * u), (xb + 3.1 * u, y3 - 0.8 * u),
               (xb + 1.3 * u, y3 + 1.4 * u), (xb - 2.0 * u, y3 + 1.4 * u)], fill=c)
    d.rectangle([xb - 1.3 * u, y3 - 1.0 * u, xb - 0.5 * u, y3 - 0.2 * u], fill=c)
    d.line([(xb - 2.0 * u, y3 + 0.2 * u), (xb - 3.0 * u, y3 - 0.6 * u), (xb - 3.0 * u, y3 + 0.2 * u)], fill=c, width=lw)
    d.ellipse([xb + 2.9 * u, y3 + 0.3 * u, xb + 3.5 * u, y3 + 1.1 * u], fill=c)


def lamps(d, pal):
    block(d, pal, B_LAMPS, col=pal['face2'])
    for cy in LAMP_Y:   # casa de cada luz
        for cx in LAMP_X:
            a, b = P(cx - 5.2, cy - 5.6), P(cx + 5.2, cy + 5.6)
            d.rounded_rectangle([a[0], a[1], b[0], b[1]], radius=K * 0.8, fill=pal['cell'])
    lamp_icons(d, [pal.get('icon', pal['ink'])] * 6, K * 0.72, max(1, int(K * 0.34)))


def render(pal):
    im = Image.new('RGB', (W, H), pal['gap'])
    d = ImageDraw.Draw(im)
    clock(im, d, pal)
    small(d, pal)
    speed(im, d, pal)
    lamps(d, pal)
    tach(im, d, pal)
    return im.resize((W * KO // K, H * KO // K), Image.LANCZOS)


def lit_lamps():
    """bloco das luzes com todas acesas, cada uma na sua cor, com o clarão da lente em volta"""
    cols = [(110, 170, 255), (80, 240, 110), (255, 70, 50), (255, 70, 50), (255, 70, 50), (255, 96, 50)]
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for j, cy in enumerate(LAMP_Y):
        for i, cx in enumerate(LAMP_X):
            c = cols[j * 2 + i]
            a, b = P(cx - 5.2, cy - 5.6), P(cx + 5.2, cy + 5.6)
            d.rounded_rectangle([a[0], a[1], b[0], b[1]], radius=K * 0.8, fill=tuple(int(v * 0.5) for v in c) + (255,))
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    lamp_icons(ImageDraw.Draw(glow), [c + (255,) for c in cols], K * 0.72, max(1, int(K * 0.34)))
    lay.alpha_composite(glow.filter(ImageFilter.GaussianBlur(K * 0.9)))
    lay.alpha_composite(glow.filter(ImageFilter.GaussianBlur(K * 0.9)))
    ic = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    lamp_icons(ImageDraw.Draw(ic), [tuple(min(255, v + 70) for v in c) + (255,) for c in cols], K * 0.72, max(1, int(K * 0.34)))
    lay.alpha_composite(ic)
    x0, x1 = int(B_LAMPS[0] * K), int(B_LAMPS[1] * K)
    return lay.crop((x0, 0, x1, H)).resize(((x1 - x0) * KO // K, H * KO // K), Image.LANCZOS)


def main():
    out = sys.argv[1]
    render(DAY).save(os.path.join(out, 'br-voyage-cluster.png'), optimize=True)
    render(LIT).save(os.path.join(out, 'br-voyage-cluster-lit.png'), optimize=True)
    lit_lamps().save(os.path.join(out, 'br-voyage-lamps.png'), optimize=True)
    r = lambda v: round(v, 2)
    print('quadro', (X0, Y0), (X1 - X0, Y1 - Y0))
    print('velocímetro', r(X0 + SPEED['x']), r(Y0 + SPEED['y']), 'ângulos', {v: r(a_speed(v)) for v in (0, 20, 160, 190)})
    print('conta-giros', r(X0 + TACH['x']), r(Y0 + TACH['y']), 'ângulos', {v: r(a_tach(v)) for v in (0, 1, 8)})
    print('relógio', r(X0 + CLOCK['x']), r(Y0 + CLOCK['y']))
    print('combustível', r(X0 + FUEL['x']), r(Y0 + FUEL['y']), 'janela', [r(Y0 + v) for v in FUEL['win']])
    print('temperatura', r(X0 + TEMP['x']), r(Y0 + TEMP['y']), 'janela', [r(Y0 + v) for v in TEMP['win']])
    print('luzes: bloco x', r(X0 + B_LAMPS[0]), 'largura', r(B_LAMPS[1] - B_LAMPS[0]), 'casas x', [r(X0 + v) for v in LAMP_X], 'y', [r(Y0 + v) for v in LAMP_Y])
    print('pequenos x', [r(X0 + v) for v in B_SMALL])


if __name__ == '__main__':
    main()
