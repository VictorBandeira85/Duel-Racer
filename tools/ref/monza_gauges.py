"""Quadro do Ímola S/R (Monza S/R 1987), copiando a foto do quadro real que o Victor mandou: fundo
grafite, números e marcações laranja em grotesca fina. Velocímetro 20-220 km/h (número a cada 20,
marcação a cada 10, 120 no alto) com hodômetro em cima do eixo, parcial embaixo e "km/h"; conta-giros
10-70 (x100 min-1) com a faixa vermelha vazada no fim; no meio, quatro mostradores de arco em pé com
o ponteiro saindo da direita: voltímetro e econômetro (arco verde) em cima, temperatura e combustível
embaixo, cada um com o seu pictograma; luzes-espia numa fileira embaixo. Cobre o quadro inteiro da
arte (os números e ícones errados somem). O jogo desenha os ponteiros laranja e os hodômetros.
Saída em 4 px por pixel do jogo.
Com "classic" no fim: o quadro do Ímola Classic SE (sedã), igual na disposição mas com números e
marcações brancos e a faixa do conta-giros laranja, numa tela um pouco mais alta (a da arte do sedã).
Uso: python3 tools/ref/monza_gauges.py <src/assets/cockpit> [classic]
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

K, KO, PY = 12, 4, 8 / 7
X0, Y0, X1, Y1 = 64.5, 37.5, 217.5, 91.5   # tela do quadro na arte (monza_cockpit.py: 64,8..217,1 x 37,6..91,3)
FN = '/usr/share/fonts/opentype/inter/Inter-Medium.otf'
BG, PANEL = (52, 50, 49), (17, 17, 19)   # painel cinza-castanho e os mostradores pretos (como na foto)
AMBER = (236, 160, 60)
INK = (240, 120, 44)
RED, GREEN, BLUE = (222, 52, 38), (70, 178, 84), (70, 130, 230)
# medido na foto: 20 km/h a 148° e 220 a 30° (1,21° por km/h, 120 no alto); conta-giros 10 a 172° e
# 60 na horizontal (38,2° por 1000 rpm)
SPEED = dict(x=97.5, y=65.2, r=21.6, a0=124.0, per=1.21)
TACH = dict(x=175.8, y=65.2, r=21.6, a0=133.5, per=38.2)
MID = (123.3, 152.8, 40.0, 86.2)           # x0, x1, y0, y1 dos quatro pequenos
A_LO, A_HI = 143.0, 217.0                  # arco dos pequenos (ponteiro para a esquerda): mínimo embaixo
CLASSIC = len(sys.argv) > 2 and sys.argv[2] == 'classic'
OUT = 'br-monza-cluster.png'
if CLASSIC:
    INK, RED_ZONE, OUT = (234, 234, 228), (240, 130, 40), 'br-monzasedan-cluster.png'
    Y0, Y1 = Y0 - 1.9, Y1 + 1.9
else:
    RED_ZONE = RED
W, H = int(round((X1 - X0) * K)), int(round((Y1 - Y0) * K))
LABELS = []


def P(x, y):
    return ((x - X0) * K, (y - Y0) * K)


def at(g, ang, rr):
    x, y = P(g['x'], g['y'])
    a = math.radians(ang)
    return (x + math.cos(a) * rr * K, y + math.sin(a) * rr * K * PY)


def tick(d, g, ang, r0, r1, w, col=None):
    col = col or INK
    d.line([at(g, ang, r0), at(g, ang, r1)], fill=col, width=max(1, int(round(w * K))))


def label(s, x, y, size, col=None, font=FN):
    col = col or INK
    LABELS.append((s, x / K * KO, y / K * KO, size, col, font))


def draw_labels(im):
    """textos na resolução final (nítidos), já estreitados pelo pixel 8:7"""
    for s, x, y, size, col, font in LABELS:
        f = ImageFont.truetype(font, int(round(size * KO * 4)))
        bb = f.getbbox(s)
        t = Image.new('L', (bb[2] - bb[0] + 8, bb[3] - bb[1] + 8), 0)
        ImageDraw.Draw(t).text((4 - bb[0], 4 - bb[1]), s, font=f, fill=255)
        t = t.resize((max(1, int(round(t.width / 4 * 0.875))), max(1, int(round(t.height / 4)))), Image.LANCZOS)
        im.paste(Image.new('RGB', t.size, col), (int(round(x - t.width / 2)), int(round(y - t.height / 2))), t)


def face(d, g, rr=23.8):
    """mostrador preto redondo, com o pé cortado reto (como no quadro real)"""
    c = P(g['x'], g['y'])
    d.chord([c[0] - rr * K, c[1] - rr * K * PY, c[0] + rr * K, c[1] + rr * K * PY], 130, 50, fill=PANEL)


def panel(d, x0, y0, x1, y1, rad=3.0):
    a, b = P(x0, y0), P(x1, y1)
    d.rounded_rectangle([a[0], a[1], b[0], b[1]], radius=rad * K, fill=PANEL)


def speed(d):
    g = SPEED
    face(d, g)
    for v in range(10, 221, 10):
        a = g['a0'] + v * g['per']
        if v % 20 == 0:
            tick(d, g, a, g['r'] - 0.6, g['r'] + 1.2, 0.5)
            x, y = at(g, a, g['r'] - (5.6 if v >= 100 else 4.6))
            label(str(v), x, y, 4.0)
        else:
            tick(d, g, a, g['r'] + 0.2, g['r'] + 1.2, 0.4)
    # janelas do hodômetro (em cima do eixo) e do parcial (embaixo)
    for (bx, by, bw, bh) in ((g['x'] - 7.4, g['y'] - 9.4, 14.8, 4.2), (g['x'] - 5.0, g['y'] + 5.4, 10.0, 4.0)):
        a, b = P(bx, by), P(bx + bw, by + bh)
        d.rectangle([a[0], a[1], b[0], b[1]], fill=(10, 10, 12))
    x, y = P(g['x'], g['y'] + 14.6)
    label('km/h', x, y, 2.2)


def tach(d):
    g = TACH
    face(d, g)
    for i in range(1, 15):  # 500 em 500 rpm até 7000
        v = i / 2
        a = g['a0'] + v * g['per']
        if v >= 6.4:
            continue
        if i % 2 == 0:
            tick(d, g, a, g['r'] - 0.6, g['r'] + 1.2, 0.5)
        else:
            tick(d, g, a, g['r'] + 0.2, g['r'] + 1.2, 0.4)
    for v in range(1, 8):
        a = g['a0'] + v * g['per']
        x, y = at(g, a, g['r'] - (4.8 if v < 7 else 6.4))
        label(str(v * 10), x, y, 4.0)
    # faixa vermelha vazada (só o contorno), de 6300 a 7200 rpm
    # faixa do limite: um trecho vazado (só o contorno) e depois cheio, curto, rente à borda (6300-7000)
    n = 16
    for a0, a1, full in ((g['a0'] + 6.3 * g['per'], g['a0'] + 6.55 * g['per'], False), (g['a0'] + 6.55 * g['per'], g['a0'] + 7.0 * g['per'], True)):
        outer = [at(g, a0 + (a1 - a0) * i / n, g['r'] + 1.3) for i in range(n + 1)]
        inner = [at(g, a0 + (a1 - a0) * i / n, g['r'] - 0.5) for i in range(n + 1)]
        if full:
            d.polygon(outer + inner[::-1], fill=RED_ZONE)
        else:
            d.line(outer + inner[::-1] + [outer[0]], fill=RED_ZONE, width=int(0.4 * K), joint='curve')
    x, y = P(g['x'], g['y'] + 13.4)
    label('x100', x, y, 2.1)
    x, y = P(g['x'], g['y'] + 16.4)
    label('min-1', x, y, 2.1)


def ico_batt(d, cx, cy, u, col=None):
    col = col or INK
    lw = max(1, int(0.5 * u))
    d.rectangle([cx - 2.6 * u, cy - 1.2 * u, cx + 2.6 * u, cy + 1.8 * u], outline=col, width=lw)
    d.rectangle([cx - 1.9 * u, cy - 2.0 * u, cx - 0.9 * u, cy - 1.2 * u], fill=col)
    d.rectangle([cx + 0.9 * u, cy - 2.0 * u, cx + 1.9 * u, cy - 1.2 * u], fill=col)
    d.line([(cx - 1.9 * u, cy + 0.3 * u), (cx - 0.9 * u, cy + 0.3 * u)], fill=col, width=lw)
    d.line([(cx + 0.9 * u, cy + 0.3 * u), (cx + 1.9 * u, cy + 0.3 * u)], fill=col, width=lw)
    d.line([(cx + 1.4 * u, cy - 0.2 * u), (cx + 1.4 * u, cy + 0.8 * u)], fill=col, width=lw)


def ico_pump(d, cx, cy, u, col=None):
    col = col or INK
    hole = PANEL
    lw = max(1, int(0.5 * u))
    d.rectangle([cx - 2.0 * u, cy - 2.2 * u, cx + 0.8 * u, cy + 2.2 * u], fill=col)
    d.rectangle([cx - 1.3 * u, cy - 1.5 * u, cx + 0.1 * u, cy - 0.2 * u], fill=hole)
    d.rectangle([cx - 2.5 * u, cy + 1.8 * u, cx + 1.3 * u, cy + 2.4 * u], fill=col)
    d.line([(cx + 0.8 * u, cy - 0.6 * u), (cx + 2.1 * u, cy - 0.6 * u), (cx + 2.1 * u, cy + 1.4 * u)], fill=col, width=lw)
    d.line([(cx + 1.2 * u, cy - 2.2 * u), (cx + 2.2 * u, cy - 1.2 * u), (cx + 2.2 * u, cy - 0.2 * u)], fill=col, width=lw)


def ico_temp(d, cx, cy, u, col=None):
    col = col or INK
    lw = max(1, int(0.5 * u))
    d.rectangle([cx - 0.4 * u, cy - 2.4 * u, cx + 0.4 * u, cy + 0.8 * u], fill=col)
    d.ellipse([cx - 1.0 * u, cy + 0.2 * u, cx + 1.0 * u, cy + 2.0 * u], fill=col)
    for k in (-1.8, -1.0, -0.2):
        d.line([(cx + 0.4 * u, cy + k * u), (cx + 1.5 * u, cy + k * u)], fill=col, width=lw)
    for sx in (-1, 1):  # ondas da água
        d.line([(cx + sx * 1.4 * u, cy + 1.8 * u), (cx + sx * 2.1 * u, cy + 1.3 * u), (cx + sx * 2.8 * u, cy + 1.8 * u)], fill=col, width=lw)


def small(d, x0, y0, x1, y1, kind):
    """mostrador pequeno: na coluna da esquerda (voltímetro, temperatura) o ponteiro sai da esquerda e o
    arco fica à direita; na da direita (econômetro, combustível) é o contrário. Mínimo embaixo."""
    panel(d, x0, y0, x1, y1, 1.2)
    left = kind in ('volt', 'water')
    g = dict(x=(x0 + 2.4) if left else (x1 - 2.4), y=(y0 + y1) / 2 + 1.6, r=9.0)
    lo, hi = (37.0, -37.0) if left else (A_LO, A_HI)
    n = 20
    ang = lambda f: lo + (hi - lo) * f
    arc = [at(g, ang(i / n), g['r']) for i in range(n + 1)]
    u = K * 0.55
    ix, iy = P((x0 + 4.6) if left else (x1 - 4.6), y0 + 3.4)

    def block(f, col, out=1.5):
        c = at(g, ang(f), g['r'] + out)
        d.rectangle([c[0] - 0.95 * K, c[1] - 0.95 * K, c[0] + 0.95 * K, c[1] + 0.95 * K], fill=col)

    if kind == 'vac':  # econômetro
        # verde em cima (pé leve, ponteiro alto) e âmbar embaixo (acelerando fundo o ponteiro desce: gasta mais)
        d.line(arc[:8], fill=AMBER, width=int(1.3 * K), joint='curve')
        d.line(arc[7:], fill=GREEN, width=int(1.3 * K), joint='curve')
        d.line([at(g, ang(i / n), g['r'] - 1.1) for i in range(n + 1)], fill=INK, width=int(0.35 * K), joint='curve')
        ico_pump(d, ix, iy, u)
    else:
        d.line(arc, fill=INK, width=int(0.5 * K), joint='curve')
        tick(d, g, ang(0.5), g['r'], g['r'] + 1.6, 0.5)
        if kind == 'volt':
            block(1, AMBER)
            block(0.12, RED, 2.4)
            for f in (0.2, 0.26, 0.32, 0.38):
                tick(d, g, ang(f), g['r'], g['r'] + 1.3, 0.35)
        elif kind == 'water':
            block(1, AMBER)
            block(0, BLUE)
        else:
            block(0, AMBER)
            tick(d, g, ang(1), g['r'], g['r'] + 1.6, 0.5)
        {'volt': ico_batt, 'water': ico_temp, 'fuel': ico_pump}[kind](d, ix, iy, u)
    return (round(g['x'], 1), round(g['y'], 1))


def lamps(d):
    """luzes-espia: fileira de janelas retangulares embaixo dos dois mostradores (o jogo acende as vermelhas: extra em COCKPIT_ART)"""
    for cx, reds in ((SPEED['x'], ()), (TACH['x'], (2, 3))):
        for i in range(5):
            x = cx - 23.0 + i * 9.4
            a, b = P(x, 87.3), P(x + 8.2, 91.0)
            d.rectangle([a[0], a[1], b[0], b[1]], fill=(38, 37, 37))  # apagadas: o jogo acende óleo e freio de mão na hora certa


def main():
    out = sys.argv[1]
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    speed(d)
    tach(d)
    x0, x1, y0, y1 = MID
    xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
    piv = {}
    piv['volt'] = small(d, x0, y0, xm - 0.6, ym - 0.7, 'volt')
    piv['vac'] = small(d, xm + 0.6, y0, x1, ym - 0.7, 'vac')
    piv['water'] = small(d, x0, ym + 0.7, xm - 0.6, y1, 'water')
    piv['fuel'] = small(d, xm + 0.6, ym + 0.7, x1, y1, 'fuel')
    lamps(d)
    fin = im.resize((W * KO // K, H * KO // K), Image.LANCZOS)
    draw_labels(fin)
    fin.save(os.path.join(out, OUT), optimize=True)
    print('quadro', (X0, Y0), (X1 - X0, Y1 - Y0), 'pivôs', piv)


if __name__ == '__main__':
    main()
