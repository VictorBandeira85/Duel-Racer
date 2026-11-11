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
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'  # grotesca larga e negrita, como a VW dos 90
FI = '/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf'
FR = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
FACE, EDGE = (52, 52, 54), (18, 18, 20)
INK = (246, 112, 46)
WHITE = (226, 226, 222)
# geometria medida na foto: 20 km/h embaixo à esquerda (134°) até 240 embaixo à direita (45°);
# no conta-giros o 1 fica pouco acima da horizontal (194°) e o 7 quase nela (4°)
SPEED = dict(x=93.6, y=54.4, r=19.6, a0=134, sweep=271 * 240 / 220, max=240, v0=20)
TACH = dict(x=154.5, y=54.4, r=19.6, a0=165.7, sweep=226.7, max=8)
# temperatura e combustível: pivôs no pé do conta-giros, arcos curtos virados para fora
TEMP = dict(x=144.3, y=65.1, r=6.4, a0=170, a1=100)   # frio -> quente (faixa laranja embaixo)
FUEL = dict(x=164.7, y=65.1, r=6.4, a0=80, a1=10)     # reserva (laranja embaixo) -> cheio
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


# algarismos da VW dos anos 90 (os do quadro do Gol): quadrados, largos, traço grosso e cantos
# arredondados, desenhados à mão numa caixa 4 x 6 (x, y em unidades da caixa)
SQ = {
    '0': [[(0, 0), (4, 0), (4, 6), (0, 6), (0, 0)]],
    '1': [[(1.6, 1.2), (3, 0), (3, 6)]],
    '2': [[(0, 0), (4, 0), (4, 3), (0, 3), (0, 6), (4, 6)]],
    '3': [[(0, 0), (4, 0), (4, 6), (0, 6)], [(1.2, 3), (4, 3)]],
    '4': [[(0, 0), (0, 3.6), (4, 3.6)], [(3.2, 1.6), (3.2, 6)]],
    '5': [[(4, 0), (0, 0), (0, 3), (4, 3), (4, 6), (0, 6)]],
    '6': [[(4, 0), (0, 0), (0, 6), (4, 6), (4, 3), (0, 3)]],
    '7': [[(0, 0), (4, 0), (4, 6)]],
    '8': [[(0, 0), (4, 0), (4, 6), (0, 6), (0, 0)], [(0, 3), (4, 3)]],
    '9': [[(4, 3), (0, 3), (0, 0), (4, 0), (4, 6), (0, 6)]],
}


def sq_number(s, h, col):
    """número no estilo VW: imagem RGBA (desenhada em 8x e reduzida), altura h px"""
    S = 8
    u = h * S / 7.2  # unidade da caixa (6 de altura + traço)
    t = u * 1.8  # grossura do traço (negrito como o da VW)
    adv = u * 6.3
    w = int(adv * len(s) + t * 2)
    lay = Image.new('L', (w, int(u * 6 + t * 2)), 0)
    dd = ImageDraw.Draw(lay)
    for i, ch in enumerate(s):
        ox = t + i * adv
        for path in SQ.get(ch, []):
            pts = [(ox + x * u, t + y * u) for x, y in path]
            dd.line(pts, fill=255, width=int(t), joint='curve')
            for x, y in pts:
                dd.ellipse([x - t / 2, y - t / 2, x + t / 2, y + t / 2], fill=255)
    lay = lay.resize((max(1, w // S), max(1, lay.height // S)), Image.LANCZOS)
    img = Image.new('RGBA', lay.size, col + (0,))
    img.putalpha(lay)
    return img


def draw_labels(im):
    for s, cx, cy, size, font, sq, col in LABELS:
        if font == 'SQ':
            g = sq_number(s, size * KO * 0.86, col)
            g = g.resize((max(1, int(g.width * sq)), g.height), Image.LANCZOS)
            im.alpha_composite(g, (int(round(cx * KO - g.width / 2)), int(round(cy * KO - g.height / 2))))
            continue
        f = ImageFont.truetype(font, int(round(size * KO * 4)))
        bx0, by0, bx1, by1 = ImageDraw.Draw(Image.new('L', (4, 4))).textbbox((0, 0), s, font=f)
        lay = Image.new('L', (bx1 - bx0 + 8, by1 - by0 + 8), 0)
        ImageDraw.Draw(lay).text((4 - bx0, 4 - by0), s, font=f, fill=255)
        lay = lay.resize((max(1, int(lay.width * sq / 4)), max(1, int(lay.height / 4))), Image.LANCZOS)
        im.paste(col + (255,), (int(round(cx * KO - lay.width / 2)), int(round(cy * KO - lay.height / 2))), lay)


def speed(d):
    g = SPEED
    fr = lambda v: g['a0'] + g['sweep'] * (v - g['v0']) / g['max']
    for v in range(20, 241, 5):
        if v % 20 == 0:
            tick(d, g, fr(v), g['r'] - 3.2, g['r'] - 0.2, 0.85)
        else:
            tick(d, g, fr(v), g['r'] - 1.8, g['r'] - 0.2, 0.6)
    for v in range(20, 241, 20):
        x, y = at(g, fr(v), g['r'] - 6.9)
        label(str(v), x, y, 2.9, 'SQ', squeeze=0.74 if v >= 100 else 0.95)
    x, y = P(g['x'], g['y'])
    label('vdo', x, y - K * 12.2, 1.6, FB, col=WHITE)
    label('km', x, y - K * 9.9, 1.9, FB, col=WHITE)
    label('km/h', x, y + K * 13.6, 2.1, FB, col=WHITE)
    for bx, by, bw in ((-6.0, -7.4, 12), (-4.2, 6.6, 8.4)):   # janelas do hodômetro e do parcial
        x0, y0 = P(g['x'] + bx, g['y'] + by)
        d.rectangle([x0 - K * 0.3, y0 - K * 0.3, x0 + (bw + 0.3) * K, y0 + 3.8 * K], fill=(10, 10, 12))
    for sx in (-1, 1):  # parafusos dos lados do eixo
        cx, cy = P(g['x'] + sx * 6.6, g['y'] - 0.6)
        d.ellipse([cx - K * 0.55, cy - K * 0.55, cx + K * 0.55, cy + K * 0.55], fill=(16, 16, 18))
    cx, cy = P(g['x'], g['y'] + g['r'] * 1.0 * PY)   # botão de zerar o parcial, na borda de baixo
    d.ellipse([cx - K * 1.1, cy - K * 1.1, cx + K * 1.1, cy + K * 1.1], fill=(14, 14, 16))
    d.ellipse([cx - K * 0.6, cy - K * 0.8, cx + K * 0.3, cy - K * 0.1], fill=(120, 120, 124))


def lobe(d, gg, side):
    """placa de baixo do conta-giros: os dois lóbulos (temperatura e combustível) com borda escura"""
    cx, cy = P(gg['x'], gg['y'])
    R = gg['r'] * 1.12
    d.ellipse([cx - R * K, cy - R * K * PY, cx + R * K, cy + R * K * PY], fill=(16, 16, 18))
    R2 = R - 0.4
    d.ellipse([cx - R2 * K, cy - R2 * K * PY, cx + R2 * K, cy + R2 * K * PY], fill=(46, 46, 48))


def tach(d):
    g = TACH
    fr = lambda v: g['a0'] + g['sweep'] * v / g['max']
    # placa de baixo (lóbulos) primeiro: o arco de marcações do conta-giros passa por cima
    lobe(d, TEMP, -1)
    lobe(d, FUEL, 1)
    cx, cy = P(g['x'], g['y'])
    v = 0.5
    while v <= 7.5 + 1e-6:
        if 6.25 <= v <= 7.25:
            pass
        elif abs(v - round(v)) < 1e-6:
            tick(d, g, fr(v), g['r'] - 3.2, g['r'] - 0.2, 0.85)
        else:
            tick(d, g, fr(v), g['r'] - 1.8, g['r'] - 0.2, 0.6)
        v += 0.25
    # faixa de corte: laranja com hachura escura (como na foto)
    for k in range(44):
        vv = 6.25 + k / 44
        tick(d, g, fr(vv), g['r'] - 3.0, g['r'] - 0.2, 0.3, INK if k % 3 else (120, 40, 20))
    for n in range(1, 8):
        x, y = at(g, fr(n), g['r'] - 6.4)
        label(str(n), x, y, 3.5, 'SQ', squeeze=1.0)
    label('VDO', cx, cy - K * 9.6, 1.3, FR, col=WHITE)
    label('1/min x 1000', cx, cy + K * 6.6, 2.0, FR, squeeze=0.86, col=WHITE)
    c0 = P(g['x'] + 5.2, g['y'])
    d.ellipse([c0[0] - K * 0.55, c0[1] - K * 0.55, c0[0] + K * 0.55, c0[1] + K * 0.55], fill=(16, 16, 18))
    for gg in (TEMP, FUEL):
        a0, a1 = gg['a0'], gg['a1']
        for i in range(5):
            a = a0 + (a1 - a0) * i / 4
            tick(d, gg, a, gg['r'] - 1.4, gg['r'] + 0.6, 0.6)
        # bloco laranja do alerta (quente / reserva), na ponta de baixo do arco
        aw = a1 if gg is TEMP else a0
        for k in range(10):
            tick(d, gg, aw + (a0 - a1) * 0.16 * (k / 9) * (1 if gg is TEMP else -1), gg['r'] - 1.6, gg['r'] + 0.8, 0.35)
    u = K * 0.5
    tx, ty = P(g['x'] - 3.4, g['y'] + 12.6)  # termômetro com ondas
    d.rectangle([tx - 0.35 * u, ty - 2.2 * u, tx + 0.35 * u, ty + 0.4 * u], fill=INK)
    d.ellipse([tx - 0.9 * u, ty, tx + 0.9 * u, ty + 1.6 * u], fill=INK)
    for k in (0, 1):
        d.line([(tx - 2.4 * u, ty + (0.6 + k * 0.9) * u), (tx + 2.4 * u, ty + (0.6 + k * 0.9) * u)], fill=INK, width=max(1, int(0.3 * u)))
    fx, fy = P(g['x'] + 3.6, g['y'] + 12.6)  # bomba de gasolina
    d.rectangle([fx - 1.4 * u, fy - 1.8 * u, fx + 0.6 * u, fy + 1.6 * u], fill=INK)
    d.rectangle([fx - 1.0 * u, fy - 1.4 * u, fx + 0.2 * u, fy - 0.5 * u], fill=FACE)
    d.line([(fx + 0.6 * u, fy - 0.8 * u), (fx + 1.5 * u, fy - 0.2 * u), (fx + 1.5 * u, fy + 1.0 * u)], fill=INK, width=max(1, int(0.35 * u)))


def gti_logo(d, cx, cy):
    """'GT' prateado em itálico e o 'i' laranja inclinado, num retângulo escuro"""
    LABELS.append(('GT', cx / K - 1.2, cy / K, 3.4, FI, 0.9, (220, 222, 228)))
    # o i: barra inclinada laranja com o pingo
    for k in range(int(K * 2.6)):
        y = cy - K * 0.9 + k
        x = cx + K * 2.6 + (cy - y) * 0.32
        d.line([(x - K * 0.55, y), (x + K * 0.55, y)], fill=INK)
    d.ellipse([cx + K * 2.6, cy - K * 2.2, cx + K * 3.5, cy - K * 1.4], fill=INK)


def icons(d, x0, x1):
    """pictogramas brancos das luzes-espia (como na foto): em cima setas, bateria ... almotolia e
    farol; embaixo injeção/motor, temperatura e freio de mão"""
    u = K * 0.36
    W_ = WHITE
    col = lambda i: P(x0 + 2.6 + i * (x1 - x0 - 5.2) / 4, 0)[0]
    yt, yb = P(0, 44.0)[1], P(0, 53.4)[1]
    lw = max(1, int(0.45 * u))
    # setas do pisca
    cx = col(0)
    d.polygon([(cx - 3 * u, yt), (cx - 1.4 * u, yt - 1.3 * u), (cx - 1.4 * u, yt + 1.3 * u)], fill=W_)
    d.polygon([(cx + 3 * u, yt), (cx + 1.4 * u, yt - 1.3 * u), (cx + 1.4 * u, yt + 1.3 * u)], fill=W_)
    # bateria
    cx = col(1)
    d.rectangle([cx - 2.4 * u, yt - 1.2 * u, cx + 2.4 * u, yt + 1.5 * u], outline=W_, width=lw)
    d.rectangle([cx - 1.8 * u, yt - 1.9 * u, cx - 0.9 * u, yt - 1.2 * u], fill=W_)
    d.rectangle([cx + 0.9 * u, yt - 1.9 * u, cx + 1.8 * u, yt - 1.2 * u], fill=W_)
    # almotolia de óleo
    cx = col(3)
    d.polygon([(cx - 2.4 * u, yt - 0.3 * u), (cx + 0.8 * u, yt - 0.3 * u), (cx + 2.6 * u, yt - 1.3 * u), (cx + 1.2 * u, yt + 1.2 * u), (cx - 2.4 * u, yt + 1.2 * u)], fill=W_)
    d.rectangle([cx - 1.6 * u, yt - 1.3 * u, cx - 0.6 * u, yt - 0.3 * u], fill=W_)
    # farol
    cx = col(4)
    d.chord([cx - 2.6 * u, yt - 1.6 * u, cx + 0.6 * u, yt + 1.6 * u], 270, 90, fill=W_)
    for k in (-1, 0, 1):
        d.line([(cx + 1.0 * u, yt + k * 1.0 * u), (cx + 2.8 * u, yt + k * 1.0 * u)], fill=W_, width=lw)
    # motor (injeção)
    cx = col(1)
    d.rectangle([cx - 2.0 * u, yb - 1.0 * u, cx + 1.6 * u, yb + 1.4 * u], outline=W_, width=lw)
    d.rectangle([cx - 1.0 * u, yb - 1.8 * u, cx + 0.6 * u, yb - 1.0 * u], fill=W_)
    d.line([(cx + 1.6 * u, yb), (cx + 2.6 * u, yb)], fill=W_, width=lw)
    # temperatura (termômetro com ondas)
    cx = col(2)
    d.rectangle([cx - 0.35 * u, yb - 2.0 * u, cx + 0.35 * u, yb + 0.6 * u], fill=W_)
    d.ellipse([cx - 0.9 * u, yb + 0.2 * u, cx + 0.9 * u, yb + 1.8 * u], fill=W_)
    d.line([(cx - 2.4 * u, yb + 1.0 * u), (cx + 2.4 * u, yb + 1.0 * u)], fill=W_, width=lw)
    # freio de mão: (!) dentro de um círculo com arcos
    cx = col(3)
    d.ellipse([cx - 1.6 * u, yb - 1.6 * u, cx + 1.6 * u, yb + 1.6 * u], outline=W_, width=lw)
    d.rectangle([cx - 0.3 * u, yb - 1.0 * u, cx + 0.3 * u, yb + 0.4 * u], fill=W_)
    d.rectangle([cx - 0.3 * u, yb + 0.8 * u, cx + 0.3 * u, yb + 1.1 * u], fill=W_)
    for sx in (-1, 1):
        d.arc([cx - 2.6 * u, yb - 2.2 * u, cx + 2.6 * u, yb + 2.2 * u], 140 if sx < 0 else -40, 220 if sx < 0 else 40, fill=W_, width=lw)


def middle(d):
    x0, x1 = MID
    a, b = P(x0, 34.0), P(x1, 75.0)
    d.rectangle([a[0], a[1], b[0], b[1]], fill=(34, 34, 36))
    d.rectangle([a[0], a[1], b[0], a[1] + K * 0.4], fill=(62, 62, 64))
    p0, p1 = P(x0 + 2.0, 35.4), P(x1 - 2.0, 41.4)
    d.rectangle([p0[0], p0[1], p1[0], p1[1]], fill=(20, 20, 22))
    cx = (x0 + x1) / 2
    gti_logo(d, P(cx, 0)[0], P(0, 38.4)[1])
    # ícones de cima (setas, bateria ... óleo, farol) e de baixo (motor, água, freio), em branco
    icons(d, x0, x1)
    # luzes-espia: duas fileiras de cinco (apagadas, cores da lente)
    cols = [(60, 110, 50), (200, 190, 120), (120, 30, 30), (120, 30, 30), (30, 50, 120)]
    cols2 = [(110, 30, 26), (190, 170, 90), (120, 30, 30), (120, 30, 30), (26, 26, 28)]
    for row, cc in ((46.8, cols), (50.4, cols2)):
        for i, col in enumerate(cc):
            x = x0 + 2.6 + i * (x1 - x0 - 5.2) / 4
            c0 = P(x, row)
            # janelinhas quadradas (como na foto), não redondas
            d.rectangle([c0[0] - K * 1.3, c0[1] - K * 1.3 * PY, c0[0] + K * 1.3, c0[1] + K * 1.3 * PY], fill=(12, 12, 14))
            d.rectangle([c0[0] - K * 1.0, c0[1] - K * 1.0 * PY, c0[0] + K * 1.0, c0[1] + K * 1.0 * PY], fill=col)
    q0, q1 = P(x0 + 2.0, 60.2), P(x1 - 2.0, 66.4)  # relógio de cristal líquido
    d.rectangle([q0[0] - K * 0.5, q0[1] - K * 0.5, q1[0] + K * 0.5, q1[1] + K * 0.5], fill=(14, 14, 16))
    d.rectangle([q0[0], q0[1], q1[0], q1[1]], fill=(150, 154, 132))
    for sx in (x0 + 0.6, x1 - 0.6):  # parafusos embaixo, nas emendas
        c0 = P(sx, 73.5)
        d.ellipse([c0[0] - K * 0.8, c0[1] - K * 0.8, c0[0] + K * 0.8, c0[1] + K * 0.8], fill=(90, 90, 94))
        d.ellipse([c0[0] - K * 0.4, c0[1] - K * 0.4, c0[0] + K * 0.4, c0[1] + K * 0.4], fill=(40, 40, 44))


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
