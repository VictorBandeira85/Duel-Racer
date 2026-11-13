"""Quadro do Toro LP5 (Countach 5000 QV), copiando a FOTO DO QUADRO REAL que o Victor mandou (de dia e à
noite), na placa do quadro da arte nova (lp5_cockpit.py):
- placa prata (alumínio claro, como na foto) dentro do capuz caramelo da arte, com a sombra do capuz no
  alto e o contorno preto; sete mostradores com aro preto, fundo preto e números verde-claros (de dia) em
  grotesca negrita (Liberation Sans Bold, o desenho dos algarismos da foto)
- disposição da foto: os pequenos ficam mais altos que os grandes, com as caixas pretas das luzes-espia
  embaixo; da esquerda para a direita: temperatura do óleo (50 / 90 / 150 °C), voltímetro (10 a 16, faixa
  vermelha / branca / vermelha), VELOCÍMETRO, pressão do óleo (0 / 5 / 10 bar), CONTA-GIROS, combustível
  (0 / 1/2 / 1) e temperatura da água (40 / 80 / 120 °C, riscos vermelhos no fim)
- velocímetro 0-320 km/h (0 a 135°, 0,84375° por km/h: 160 no alto), números de 20 em 20, riscos de 10 em
  10; dentro, a escala em mph (0-200) numa trilha branca, "km/h" e "m.p.h"; hodômetro (seis tambores) com
  "km" embaixo e parcial (quatro, o último claro)
- conta-giros 0-90 "Giri x 100" (0 a 147,6°, 245° de abertura, medido na foto), riscos de 5 em 5, a zona
  listrada de 62 a 70, amarelo de 70 a 75 e vermelho de 75 a 90; "ELETTRONICO" no meio
- pequenos como na foto: a escala fica à esquerda (arco de um círculo com centro à direita do eixo), o eixo
  do ponteiro na linha vertical fina (um pouco à direita e abaixo do centro), o ícone à direita
- o escudo verde da fábrica vira um escudo fictício (verde-claro com os chifres da Toro); o "JAEGER"
  e qualquer marca real saem
O jogo desenha os ponteiros laranja (afinados, com rabicho curto, passando por cima do disco escuro do
eixo), os tambores e acende as luzes (lp5Cluster em src/cockpit.ts).
Saídas (4 px por pixel do jogo; placa X0..X1 x Y0..Y1 em pixels do painel, linhas 8:7):
  countach-cluster.png      de dia
  countach-cluster-lit.png  aceso (noite e túnel): números, marcações e ícones em VERDE vivo sobre o preto
                            (foto de noite), faixas amarela e vermelha acesas, a placa apagada
  countach-lamps.png        todas as luzes-espia acesas (o jogo copia a casa de cada uma)
Uso: python3 tools/ref/lp5_cluster.py <src/assets/cockpit>
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
import lp5_cockpit as LC  # noqa: E402  (escala e placa da cabine)

K, KO, PY = 12, 4, 8 / 7
nx = lambda ax: ax / LC.PXW - LC.PAD
ny = lambda ay: (ay - LC.Y0) / LC.PXH
PL = (nx(LC.PLATE[0]), ny(LC.PLATE[1]), nx(LC.PLATE[2]), ny(LC.PLATE[3]))   # placa (pixels do painel)
X0, Y0, X1, Y1 = math.floor(PL[0]), math.floor(PL[1]), math.ceil(PL[2]), math.ceil(PL[3])
W, H = int((X1 - X0) * K), int((Y1 - Y0) * K)
FB = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
FR = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
# mostradores (centro e raio do aro de fora, pixels do painel): os do meio da arte (velocímetro e
# conta-giros em volta do pequeno do meio, x 773 / 878 / 982 da arte), os pequenos mais altos (foto)
RB, RS = 14.8, 8.3
YB = 46.5
YS = YB - 0.35 * RB * PY
SPEED = dict(x=nx(773), y=YB, R=RB)
TACH = dict(x=nx(982), y=YB, R=RB)
OILP = dict(x=nx(878), y=YS, R=RS)
OILT = dict(x=nx(552), y=YS, R=RS)
VOLT = dict(x=nx(657), y=YS, R=RS)
FUEL = dict(x=nx(2 * 878 - 657), y=YS, R=RS)
WATER = dict(x=nx(2 * 878 - 552), y=YS, R=RS)
FACE = 0.86           # fundo / aro de fora
# escalas dos grandes (graus, sentido horário a partir das 3h): medidas na foto
speed_a = lambda v: 135.0 + v * 0.84375
tach_a = lambda k: 147.6 + k * (245.0 / 90.0)       # k em centenas de rpm (0..90)
# pequenos: a escala é um arco de centro Q (à direita do centro do mostrador) e o eixo P fica na linha
SM_Q = (0.50, 0.0)        # centro do arco das marcações (em R, relativo ao centro)
SM_RR = (0.86, 0.98)      # raio de dentro / de fora dos riscos (em R, a partir de Q)
SM_A = (157.0, 203.0)     # ângulos (a partir de Q) do começo e do fim da escala
SM_P = (0.15, 0.17)       # eixo do ponteiro (em R)
SM_LINE = 0.15            # linha vertical fina (x em R)
# caixas das luzes-espia (embaixo dos pequenos de fora) e as luzes de cada uma
BOX_Y = (YB + 0.40 * RB * PY, YB + 0.86 * RB * PY)
BOXL = (OILT['x'] - RS * 0.95, VOLT['x'] + RS * 0.95)
BOXR = (FUEL['x'] - RS * 0.95, WATER['x'] + RS * 0.95)
LAMPS = [('left', BOXL, 0, (60, 240, 90)), ('beam', BOXL, 1, (70, 230, 110)), ('batt', BOXL, 2, (255, 60, 40)),
         ('oil', BOXR, 0, (255, 60, 40)), ('brake', BOXR, 1, (255, 60, 40)), ('right', BOXR, 2, (60, 240, 90))]
DAY = dict(plate=(178, 179, 174), plate_hi=(204, 205, 200), plate_lo=(120, 121, 118), shadow=(38, 30, 22), edge=(10, 9, 9),
           bezel=(8, 8, 9), bezel_hi=(78, 80, 82), rim=(40, 42, 42), face=(12, 14, 13), ink=(214, 234, 218), red=(212, 40, 30),
           yellow=(236, 196, 40), line=(92, 98, 96), hub=(30, 32, 32), drum=(18, 18, 19), drum_hi=(226, 214, 170), box=(14, 14, 15),
           box_hi=(70, 72, 72), icon_off=(54, 58, 56), shield=(156, 210, 170), shield_ink=(22, 40, 28), screw=(70, 72, 72))
LIT = dict(glowface=(10, 30, 16), plate=(30, 30, 30), plate_hi=(38, 38, 38), plate_lo=(20, 20, 20), shadow=(10, 8, 6), edge=(4, 4, 4),
           bezel=(4, 4, 5), bezel_hi=(22, 23, 24), rim=(14, 15, 15), face=(6, 9, 7), ink=(88, 255, 120), red=(255, 64, 44),
           yellow=(255, 214, 60), line=(30, 80, 44), hub=(14, 16, 15), drum=(8, 8, 9), drum_hi=(150, 140, 110), box=(6, 6, 7),
           box_hi=(24, 25, 25), icon_off=(26, 30, 28), shield=(90, 230, 130), shield_ink=(10, 30, 16), screw=(26, 27, 27))


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
    ox, oy = -math.sin(a) * w / 2, math.cos(a) * w / 2
    pts = [P(g['x'] + dx + math.cos(a) * rr + ox * s, g['y'] + (dy + math.sin(a) * rr + oy * s) * PY) for rr, s in ((r0, 1), (r1, 1), (r1, -1), (r0, -1))]
    d.polygon(pts, fill=col)


def arc_band(d, g, a0, a1, r0, r1, col, dx=0.0, dy=0.0):
    n = max(8, int(abs(a1 - a0) * 2))
    pts = [at(g, a0 + (a1 - a0) * i / n, r1, dx, dy) for i in range(n + 1)] + [at(g, a1 - (a1 - a0) * i / n, r0, dx, dy) for i in range(n + 1)]
    d.polygon(pts, fill=col)


def text(im, s, cx, cy, h, col, font=FB, wide=1.0):
    """texto centrado em (cx, cy) (pixels do painel); h = altura dos algarismos em colunas"""
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


def plate(im, d, pal):
    """placa prata: contorno preto, cantos arredondados, sombra do capuz no alto e um escovado leve"""
    x0, y0 = P(PL[0], PL[1])
    x1, y1 = P(PL[2], PL[3])
    rad = 4.0 * K
    d.rounded_rectangle([x0, y0, x1, y1], radius=rad, fill=pal['edge'])
    e = 0.7 * K
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([x0 + e, y0 + e, x1 - e, y1 - e], radius=rad - e, fill=255)
    # degradê vertical (claro no meio, mais escuro embaixo) e a sombra do capuz nas primeiras linhas
    hh = int(y1 - y0)
    col = np.zeros((H, W, 3), float)
    ys = (np.arange(H) - y0) / max(1, hh)
    base = np.array(pal['plate'], float)
    hi, lo = np.array(pal['plate_hi'], float), np.array(pal['plate_lo'], float)
    t = np.clip(ys, 0, 1)[:, None]
    row = np.where(t < 0.45, base + (hi - base) * (t / 0.45), hi + (lo - hi) * ((t - 0.45) / 0.55))
    sh = np.clip(1 - (ys - 0.0) / 0.16, 0, 1)[:, None] ** 1.5
    row = row * (1 - sh) + np.array(pal['shadow'], float) * sh
    col[:] = row[:, None, :]
    rs = np.random.RandomState(5)
    brush = rs.normal(0, 1, (H, 1)) * 2.2 + rs.normal(0, 1, (H, W)) * 0.8
    col += brush[..., None] * (np.array(pal['plate'], float).mean() / 180)
    pim = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), 'RGB')
    im.paste(pim, (0, 0), m)


def bezel(d, g, pal):
    """aro preto (com um brilho em cima à esquerda), anel escuro do fundo e o fundo preto"""
    R = g['R']
    ell(d, g, R + 0.25, fill=pal['edge'])
    n = 72
    for i in range(n):
        a0 = i * 360 / n
        t = max(0.0, math.cos(math.radians(a0 + 125))) ** 3
        c = tuple(int(pal['bezel'][k] + (pal['bezel_hi'][k] - pal['bezel'][k]) * t) for k in range(3))
        arc_band(d, g, a0, a0 + 360 / n + 0.6, R * 0.90, R, c)
    ell(d, g, R * 0.90, fill=pal['rim'])
    ell(d, g, R * FACE, fill=pal['face'])
    if 'glowface' in pal:   # aceso: o fundo pega um pouco do verde no meio (foto de noite)
        for k in range(6):
            c = tuple(int(pal['face'][i] + (pal['glowface'][i] - pal['face'][i]) * (k + 1) / 6) for i in range(3))
            ell(d, g, R * FACE * (0.8 - k * 0.11), fill=c)


def shield(d, g, dy, s, pal):
    """escudo fictício (no lugar do escudo verde da fábrica): verde-claro com os chifres da Toro"""
    cx, cy = g['x'], g['y'] + dy * PY
    pts = [(-0.5, -0.62), (0.5, -0.62), (0.5, 0.05), (0.0, 0.62), (-0.5, 0.05)]
    d.polygon([P(cx + x * s, cy + y * s * PY) for x, y in pts], fill=pal['shield'])
    w = max(1, int(K * s * 0.13))
    for sx in (-1, 1):
        d.line([P(cx + sx * 0.32 * s, cy - 0.42 * s * PY), P(cx + sx * 0.18 * s, cy - 0.05 * s * PY), P(cx, cy + 0.32 * s * PY)],
               fill=pal['shield_ink'], width=w)


def speed(im, d, pal):
    g, R = SPEED, SPEED['R']
    bezel(d, g, pal)
    F = R * FACE
    for v in range(0, 321, 10):
        big = v % 20 == 0
        tick(d, g, speed_a(v), F * (0.86 if big else 0.90), F * 0.97, F * (0.035 if big else 0.024), pal['ink'])
    for v in range(0, 321, 20):
        a = math.radians(speed_a(v))
        s = str(v)
        h = F * 0.118
        ww = h * 0.58 * len(s)
        rr = F * 0.80 - abs(math.cos(a)) * ww / 2 - abs(math.sin(a)) * h * 0.6
        text(im, s, g['x'] + math.cos(a) * rr, g['y'] + math.sin(a) * rr * PY, h, pal['ink'], FB, 0.95)
    # mph: trilha branca (dois arcos finos) com riscos para dentro, números de 20 em 20
    mph_a = lambda m: speed_a(m * 1.609)
    r_tr = F * 0.585
    arc_band(d, g, mph_a(0) - 2, mph_a(200) + 2, r_tr, r_tr + F * 0.018, pal['ink'])
    for m in range(0, 201, 10):
        big = m % 20 == 0
        tick(d, g, mph_a(m), r_tr - F * (0.075 if big else 0.045), r_tr, F * (0.026 if big else 0.018), pal['ink'])
    for m in range(0, 201, 20):
        a = math.radians(mph_a(m))
        s = str(m)
        h = F * 0.078
        ww = h * 0.58 * len(s)
        rr = r_tr - F * 0.11 - abs(math.cos(a)) * ww / 2 - abs(math.sin(a)) * h * 0.5
        text(im, s, g['x'] + math.cos(a) * rr, g['y'] + math.sin(a) * rr * PY, h, pal['ink'], FB, 0.92)
    text(im, 'km/h', g['x'] + F * 0.52, g['y'] + F * 0.80 * PY, F * 0.06, pal['ink'], FR)
    text(im, 'm.p.h', g['x'] + F * 0.28, g['y'] + F * 0.47 * PY, F * 0.055, pal['ink'], FR)
    # hodômetro (seis tambores) com "km" embaixo; parcial (quatro, o último claro)
    for n, cy, pitch, ww, last in ((6, -0.27, 0.105, 0.085, False), (4, 0.27, 0.105, 0.085, True)):
        for i in range(n):
            x = g['x'] + (i - (n - 1) / 2) * pitch * F
            a, b = P(x - ww * F / 2, g['y'] + (cy - 0.07) * F * PY), P(x + ww * F / 2, g['y'] + (cy + 0.07) * F * PY)
            d.rectangle([a[0] - K * 0.12, a[1] - K * 0.12, b[0] + K * 0.12, b[1] + K * 0.12], fill=(2, 2, 3))
            d.rectangle([a, b], fill=pal['drum_hi'] if last and i == n - 1 else pal['drum'])
    text(im, 'km', g['x'], g['y'] - 0.13 * F * PY, F * 0.05, pal['ink'], FR)
    shield(d, g, 0.62 * F, F * 0.17, pal)


def tach(im, d, pal):
    g, R = TACH, TACH['R']
    bezel(d, g, pal)
    F = R * FACE
    # zona listrada (62 a 70), amarelo (70 a 75) e vermelho (75 a 90), por fora, na faixa dos riscos
    arc_band(d, g, tach_a(70), tach_a(75), F * 0.82, F * 0.97, pal['yellow'])
    arc_band(d, g, tach_a(75), tach_a(90), F * 0.82, F * 0.97, pal['red'])
    for q in range(124, 140):
        tick(d, g, tach_a(q / 2), F * 0.86, F * 0.97, F * 0.016, pal['ink'])
    for v in range(0, 91, 5):
        big = v % 10 == 0
        tick(d, g, tach_a(v), F * (0.80 if big else 0.87), F * 0.97, F * (0.04 if big else 0.03), pal['ink'] if v < 70 or v % 10 else (236, 236, 230))
    for v in range(0, 91, 10):
        a = math.radians(tach_a(v))
        s = str(v)
        h = F * 0.135
        ww = h * 0.58 * len(s)
        rr = F * 0.665 - abs(math.cos(a)) * ww / 2 - abs(math.sin(a)) * h * 0.5
        text(im, s, g['x'] + math.cos(a) * rr, g['y'] + math.sin(a) * rr * PY, h, pal['ink'], FB, 0.95)
    text(im, 'ELETTRONICO', g['x'], g['y'] - 0.30 * F * PY, F * 0.062, pal['ink'], FB, 0.95)
    text(im, 'Giri x 100', g['x'], g['y'] + 0.50 * F * PY, F * 0.07, pal['ink'], FR)
    for sx in (-1, 1):
        ell(d, g, F * 0.035, fill=pal['screw'], dx=sx * 0.42 * F, dy=0.02 * F)
    shield(d, g, 0.74 * F, F * 0.15, pal)


def small_pt(g, ang, rr):
    """ponto no arco das marcações (centro Q) de um pequeno: ângulo e raio em R"""
    R = g['R']
    a = math.radians(ang)
    return g['x'] + (SM_Q[0] + math.cos(a) * rr) * R, g['y'] + (SM_Q[1] + math.sin(a) * rr) * R * PY


def small_a(f):
    """fração da escala (0 embaixo, 1 em cima) -> ângulo (a partir de Q)"""
    return SM_A[0] + (SM_A[1] - SM_A[0]) * f


def small(im, d, pal, g, labels, top=None, icon=None, ticks=6, band=None, red_top=0):
    R = g['R']
    bezel(d, g, pal)
    F = R * FACE
    # linha vertical fina onde fica o eixo
    lx = g['x'] + SM_LINE * R
    d.line([P(lx, g['y'] - F * 0.80 * PY), P(lx, g['y'] + F * 0.80 * PY)], fill=pal['line'], width=max(1, int(K * 0.13)))
    if band:   # faixas de cor ao longo do arco (voltímetro: vermelha, branca, vermelha)
        for f0, f1, c in band:
            n = 10
            pts = [P(*small_pt(g, small_a(f0 + (f1 - f0) * i / n), SM_RR[0] * 0.97)) for i in range(n + 1)]
            pts += [P(*small_pt(g, small_a(f1 - (f1 - f0) * i / n), SM_RR[0] * 0.84)) for i in range(n + 1)]
            d.polygon(pts, fill=pal[c] if isinstance(c, str) else c)
    for i in range(ticks):
        f = i / (ticks - 1)
        a = math.radians(small_a(f))
        p0, p1 = small_pt(g, small_a(f), SM_RR[0]), small_pt(g, small_a(f), SM_RR[1])
        w = R * 0.05
        ox, oy = -math.sin(a) * w / 2, math.cos(a) * w / 2
        col = pal['red'] if i >= ticks - red_top else pal['ink']
        d.polygon([P(p0[0] + ox, p0[1] + oy * PY), P(p1[0] + ox, p1[1] + oy * PY), P(p1[0] - ox, p1[1] - oy * PY), P(p0[0] - ox, p0[1] - oy * PY)], fill=col)
    for i, s in enumerate(labels):
        f = i / (len(labels) - 1)
        x, y = small_pt(g, small_a(f), SM_RR[0] * 0.70)
        text(im, s, x + R * 0.03 * len(s), y, R * 0.165, pal['ink'], FB, 0.92)
    if top:
        text(im, top, g['x'] - R * 0.05, g['y'] - R * 0.57 * PY, R * 0.13, pal['ink'], FB if top == 'bar' else FR)
    if icon:
        icon(d, g['x'] + R * 0.45, g['y'] - R * 0.02 * PY, R * 0.17, pal['ink'])


def _poly(d, cx, cy, s, pts, col, fill=False, w=0.13):
    q = [P(cx + x * s, cy + y * s * PY) for x, y in pts]
    if fill:
        d.polygon(q, fill=col)
    else:
        d.line(q, fill=col, width=max(1, int(K * w)), joint='curve')


def icon_oil(d, cx, cy, s, col):
    """almotolia (pressão do óleo)"""
    _poly(d, cx, cy, s, [(-0.9, 0.2), (-0.5, -0.15), (0.35, -0.15), (0.95, -0.6), (1.0, -0.45), (0.5, 0.35), (-0.9, 0.35), (-0.9, 0.2)], col)
    _poly(d, cx, cy, s, [(-0.2, -0.45), (0.15, -0.45), (0.15, -0.15), (-0.2, -0.15)], col, True)
    _poly(d, cx, cy, s, [(1.05, 0.0), (1.1, 0.25)], col)


def icon_thermo(d, cx, cy, s, col, waves=True):
    _poly(d, cx, cy, s, [(-0.1, -0.85), (0.1, -0.85), (0.1, 0.25), (-0.1, 0.25)], col, True)
    for k in range(3):
        yy = -0.7 + k * 0.28
        _poly(d, cx, cy, s, [(0.12, yy), (0.4, yy)], col)
    if waves:
        for row in (0.45, 0.72):
            _poly(d, cx, cy, s, [(-0.8 + j * 0.2, row + (0.08 if j % 2 else -0.08)) for j in range(9)], col)


def icon_oiltemp(d, cx, cy, s, col):
    icon_thermo(d, cx - 0.25 * s, cy - 0.15 * s, s * 0.8, col, waves=False)
    icon_oil(d, cx + 0.1 * s, cy + 0.65 * s, s * 0.55, col)


def icon_batt(d, cx, cy, s, col):
    _poly(d, cx, cy, s, [(-0.9, -0.45), (0.9, -0.45), (0.9, 0.5), (-0.9, 0.5), (-0.9, -0.45)], col)
    _poly(d, cx, cy, s, [(-0.6, -0.65), (-0.3, -0.65), (-0.3, -0.45), (-0.6, -0.45)], col, True)
    _poly(d, cx, cy, s, [(0.3, -0.65), (0.6, -0.65), (0.6, -0.45), (0.3, -0.45)], col, True)
    _poly(d, cx, cy, s, [(-0.62, 0.0), (-0.22, 0.0)], col)
    _poly(d, cx, cy, s, [(-0.42, -0.2), (-0.42, 0.2)], col)
    _poly(d, cx, cy, s, [(0.22, 0.0), (0.62, 0.0)], col)


def icon_pump(d, cx, cy, s, col):
    _poly(d, cx, cy, s, [(-0.7, 0.85), (-0.7, -0.8), (0.2, -0.8), (0.2, 0.85)], col)
    _poly(d, cx, cy, s, [(-0.55, -0.62), (0.05, -0.62), (0.05, -0.2), (-0.55, -0.2)], col, True)
    _poly(d, cx, cy, s, [(-0.9, 0.85), (0.4, 0.85)], col)
    _poly(d, cx, cy, s, [(0.2, -0.35), (0.6, -0.1), (0.6, 0.5), (0.8, 0.5), (0.8, -0.3)], col)


def lamp_icon(d, name, cx, cy, s, col):
    if name in ('left', 'right'):
        sd = -1 if name == 'left' else 1
        _poly(d, cx, cy, s, [(sd * 0.9, 0), (sd * 0.1, -0.7), (sd * 0.1, -0.3), (-sd * 0.8, -0.3), (-sd * 0.8, 0.3), (sd * 0.1, 0.3), (sd * 0.1, 0.7)], col, True)
    elif name == 'beam':
        _poly(d, cx, cy, s, [(0.1, -0.6), (0.5, -0.6), (0.8, -0.3), (0.8, 0.3), (0.5, 0.6), (0.1, 0.6), (0.1, -0.6)], col, w=0.18)
        for k in range(3):
            yy = -0.45 + k * 0.45
            _poly(d, cx, cy, s, [(-0.8, yy + 0.12), (-0.15, yy)], col, w=0.15)
    elif name == 'batt':
        icon_batt(d, cx, cy, s * 0.95, col)
    elif name == 'oil':
        icon_oil(d, cx - 0.1 * s, cy, s * 0.85, col)
    elif name == 'brake':
        _poly(d, cx, cy, s, [(math.cos(t) * 0.6, math.sin(t) * 0.6) for t in np.linspace(0, 2 * math.pi, 25)], col, w=0.16)
        _poly(d, cx, cy, s, [(0, -0.35), (0, 0.12)], col, w=0.2)
        _poly(d, cx, cy, s, [(-0.03, 0.27), (0.03, 0.33)], col, True)
        for sx in (-1, 1):
            _poly(d, cx, cy, s, [(sx * 0.78, -0.45), (sx * 0.9, 0), (sx * 0.78, 0.45)], col, w=0.16)


def lamp_xy(box, i):
    x0, x1 = box
    w = (x1 - x0) / 3
    return x0 + w * (i + 0.5), (BOX_Y[0] + BOX_Y[1]) / 2, w


def boxes(d, pal):
    for x0, x1 in (BOXL, BOXR):
        a, b = P(x0, BOX_Y[0]), P(x1, BOX_Y[1])
        d.rectangle([a[0] - K * 0.35, a[1] - K * 0.35, b[0] + K * 0.35, b[1] + K * 0.35], fill=pal['edge'])
        d.rectangle([a, b], fill=pal['box'])
        d.line([a, (b[0], a[1])], fill=pal['box_hi'], width=max(1, int(K * 0.15)))
        for i in (1, 2):   # divisões entre as janelinhas
            x = x0 + (x1 - x0) * i / 3
            d.line([P(x, BOX_Y[0]), P(x, BOX_Y[1])], fill=pal['edge'], width=max(1, int(K * 0.2)))
    for name, box, i, col in LAMPS:
        x, y, w = lamp_xy(box, i)
        lamp_icon(d, name, x, y, (BOX_Y[1] - BOX_Y[0]) * 0.36, pal['icon_off'])


def screws(d, pal):
    """parafusos da placa (como na foto, embaixo, dos dois lados da coluna)"""
    for x in (nx(716), nx(1040)):
        g = dict(x=x, y=PL[3] - 3.0, R=1)
        ell(d, g, 0.9, fill=pal['edge'])
        ell(d, g, 0.6, fill=pal['screw'])


def build(pal, lamps_lit=False):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    plate(im, d, pal)
    boxes(d, pal)
    screws(d, pal)
    speed(im, d, pal)
    tach(im, d, pal)
    small(im, d, pal, OILT, ['50', '90', '150'], '°C', icon_oiltemp)
    small(im, d, pal, VOLT, ['10', '12', '14', '16'], None, lambda d_, x, y, s, c: icon_batt(d_, x, y, s * 0.85, c), ticks=7,
          band=[(0.0, 0.42, 'red'), (0.42, 0.83, (226, 226, 220) if pal is DAY else (120, 255, 150)), (0.83, 1.0, 'red')])
    small(im, d, pal, OILP, ['0', '5', '10'], 'bar', icon_oil)
    small(im, d, pal, FUEL, ['0', '1/2', '1'], None, icon_pump)
    small(im, d, pal, WATER, ['40', '80', '120'], '°C', icon_thermo, ticks=7, red_top=2)
    if lamps_lit:
        for name, box, i, col in LAMPS:
            x, y, w = lamp_xy(box, i)
            a, b = P(x - w / 2 + 0.25, BOX_Y[0] + 0.2), P(x + w / 2 - 0.25, BOX_Y[1] - 0.2)
            d.rectangle([a, b], fill=tuple(int(v * 0.22) for v in col))
            lamp_icon(d, name, x, y, (BOX_Y[1] - BOX_Y[0]) * 0.36, col)
    return im.resize((int((X1 - X0) * KO), int((Y1 - Y0) * KO)), Image.LANCZOS)


def main():
    out = sys.argv[1]
    build(DAY).save(os.path.join(out, 'countach-cluster.png'), optimize=True)
    build(LIT).save(os.path.join(out, 'countach-cluster-lit.png'), optimize=True)
    build(DAY, True).save(os.path.join(out, 'countach-lamps.png'), optimize=True)
    r = lambda v: round(v, 2)
    print('placa', X0, Y0, X1 - X0, Y1 - Y0)
    for n, g in (('speed', SPEED), ('tach', TACH), ('oilt', OILT), ('volt', VOLT), ('oilp', OILP), ('fuel', FUEL), ('water', WATER)):
        print(n, r(g['x']), r(g['y']), g['R'])
    for name, box, i, _ in LAMPS:
        x, y, w = lamp_xy(box, i)
        print('luz', name, r(x), r(y), r(w), r(BOX_Y[1] - BOX_Y[0]))


if __name__ == '__main__':
    main()
