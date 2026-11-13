"""Quadro da Onça GTE (Puma GTE 1976), copiando a FOTO DO QUADRO REAL que o Victor mandou (VDO do Puma) no
estilo, e a arte dele na posição dos mostradores no painel (velocímetro e conta-giros grandes à esquerda,
quatro pequenos à direita, cada um no aro cromado da arte, que fica):
- fundo preto fosco; NÚMEROS POR FORA e a marcação curta POR DENTRO de cada número (como na foto), só
  nos números (sem marcações intermediárias), algarismos brancos levemente mornos em grotesca seminegrita
- velocímetro 20-200 km/h: 1,5° por km/h, o 20 às 9h (180°), o 140 às 3h e o 200 às 6h; filete fino do
  140 ao 200 por dentro das marcações, do bege ao vermelho; hodômetro de cinco algarismos em cima e parcial
  de quatro embaixo (o último, dos décimos, em casa clara), "km/h"; luzes à esquerda embaixo: farol alto
  (azul), farol de neblina (verde) e a seta (lente verde redonda), APAGADAS
- conta-giros 0-6 "x1000 RPM": o 1 a 211,5° e 43,6° por mil (o 0, sem número, a 181°: o primeiro passo é
  mais curto, como na foto); filete do 4,5 ao 6 do bege ao vermelho; bateria (vermelha) e a lente
  vermelha do óleo com a almotolia impressa ao lado, APAGADAS
- pequenos (estilo dos do painel da foto: escala curta no alto, números por fora, ícone e unidade embaixo):
  pressão do óleo 0-3-5 kg/cm², temperatura do óleo 40-100-120 °C (passos da foto) com a marca vermelha no
  fim, temperatura do motor 40-90-130 °C (o termômetro da arte; motor a ar, sem as ondas da água) e
  combustível R-1/2-C com a faixa laranja da reserva e "Comb"
- a lente verde entre os dois grandes (a da arte, lanterna acesa) também fica apagada aqui
Sem marca nenhuma no mostrador (nada de VDO, nem o felino da Puma).
O jogo desenha os ponteiros brancos em barra (o eixo com o disco escuro embaixo), os algarismos dos
tambores e acende as luzes (pumaCluster em cockpit.ts). À noite (foto do quadro real aceso) o fundo
continua preto e acendem números, marcações e ícones em verde-menta claro, o filete do fim da escala do
verde ao amarelo-esverdeado; os ponteiros acendem vermelhos (cockpit.ts).
Saídas (4 px por pixel do jogo; placa X0..X1 x Y0..Y1 em pixels do painel, linhas 8:7):
  br-pumagte-cluster.png      de dia
  br-pumagte-cluster-lit.png  aceso (noite e túnel)
  br-pumagte-lamps.png        todas as luzes-espia acesas (o jogo copia a casa de cada uma)
Uso: python3 tools/ref/onca_gte_gauges.py <src/assets/cockpit>
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

K, KO, PY = 12, 4, 8 / 7
X0, Y0, X1, Y1 = 76.0, 38.0, 328.0, 96.0       # placa (pixels do painel), cobre os seis mostradores
W, H = int(round((X1 - X0) * K)), int(round((Y1 - Y0) * K))
FB = '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
FM = '/usr/share/fonts/opentype/inter/Inter-Medium.otf'
# centros e raios do fundo (pixels do painel: onca_gte_cockpit2.py, miolo dentro do aro cromado da arte)
SPEED = dict(x=100.8, y=66.83, R=24.3)
TACH = dict(x=155.2, y=66.83, R=24.3)
OILP = dict(x=194.64, y=54.4, R=12.1)
OILT = dict(x=230.68, y=56.73, R=15.5)
TEMP = dict(x=270.8, y=56.73, R=15.5)
FUEL = dict(x=310.92, y=56.73, R=15.5)
LENS = dict(x=128.0, y=46.2, R=1.0)            # lente verde entre os dois grandes (a da arte)
# escalas (graus, sentido horário a partir das 3h)
speed_a = lambda v: 180.0 + (v - 20) * 1.5
tach_a = lambda k: 181.0 + 30.5 * k if k <= 1 else 211.5 + 43.6 * (k - 1)


def pw(pts):
    """escala em trechos (valor, ângulo) -> função"""
    def f(v):
        for (v0, a0), (v1, a1) in zip(pts, pts[1:]):
            if v <= v1 or (v1, a1) == pts[-1]:
                return a0 + (a1 - a0) * (v - v0) / (v1 - v0)
    return f


oilp_a = pw([(0, 210.0), (3, 270.0), (5, 330.0)])
oilt_a = pw([(40, 214.0), (100, 277.0), (120, 318.0), (130, 338.0)])
temp_a = pw([(40, 210.0), (90, 270.0), (130, 330.0)])
fuel_a = lambda f: 206.0 + 128.0 * f
NUM_R, TICK_R0, TICK_R1 = 0.74, 0.50, 0.62     # grandes: centro dos números e a marcação (por dentro)
SNUM_R, STICK_R0, STICK_R1 = 0.66, 0.40, 0.52  # pequenos
DAY = dict(face=(12, 12, 14), ink=(234, 230, 220), dim=(150, 148, 142), tan=(196, 168, 118), red=(204, 44, 34), orange=(222, 118, 40),
           lens_red=(70, 16, 14), lens_green=(18, 46, 26), icon_off=(70, 70, 72), drum=(16, 16, 18), white=(214, 212, 204))
# aceso (foto do quadro real à noite): números, marcações e ícones verde-menta claros sobre o preto, o filete do
# fim da escala do verde ao amarelo-esverdeado, a reserva do combustível em vermelho
LIT = dict(face=(8, 12, 12), ink=(84, 230, 162), dim=(60, 186, 136), tan=(80, 226, 146), red=(190, 232, 84), orange=(240, 70, 50), warn=(240, 70, 50),
           lens_red=(32, 8, 7), lens_green=(9, 22, 13), icon_off=(26, 44, 36), drum=(8, 10, 10), white=(120, 150, 134))
# luzes-espia: centro relativo ao mostrador (em R), meio-lado da casa (em R), cor acesa
LAMPS = [('beam', SPEED, -0.62, 0.25, 0.11, (80, 150, 255)), ('fog', SPEED, -0.42, 0.49, 0.11, (70, 230, 90)),
         ('turn', SPEED, -0.22, 0.65, 0.09, (70, 240, 90)), ('batt', TACH, -0.66, 0.24, 0.11, (255, 56, 40)),
         ('oil', TACH, -0.24, 0.65, 0.085, (255, 50, 36)), ('park', LENS, 0.0, 0.0, 1.6, (90, 240, 110))]


def P(x, y):
    return ((x - X0) * K, (y - Y0) * K)


def at(g, ang, rr, dx=0.0, dy=0.0):
    a = math.radians(ang)
    return P(g['x'] + dx + math.cos(a) * rr, g['y'] + (dy + math.sin(a) * rr) * PY)


def ell(d, g, rr, fill=None, outline=None, width=1, dx=0.0, dy=0.0):
    cx, cy = P(g['x'] + dx, g['y'] + dy * PY)
    d.ellipse([cx - rr * K, cy - rr * K * PY, cx + rr * K, cy + rr * K * PY], fill=fill, outline=outline, width=width)


def tick(d, g, ang, r0, r1, w, col):
    a = math.radians(ang)
    nx, ny = -math.sin(a) * w / 2, math.cos(a) * w / 2
    pts = [P(g['x'] + math.cos(a) * rr + nx * s, g['y'] + (math.sin(a) * rr + ny * s) * PY) for rr, s in ((r0, 1), (r1, 1), (r1, -1), (r0, -1))]
    d.polygon(pts, fill=col)


def arc_band(d, g, a0, a1, r0, r1, col0, col1=None):
    """filete de a0 a a1; com col1, a cor passa de col0 para col1 ao longo do arco"""
    n = max(8, int(abs(a1 - a0)))
    col1 = col1 or col0
    for i in range(n):
        t = (i + 0.5) / n
        c = tuple(int(col0[k] * (1 - t) + col1[k] * t) for k in range(3))
        b0, b1 = a0 + (a1 - a0) * i / n, a0 + (a1 - a0) * (i + 1.15) / n
        d.polygon([at(g, b0, r1), at(g, b1, r1), at(g, b1, r0), at(g, b0, r0)], fill=c)


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


def label(im, g, ang, s, rr, h, col, wide=0.92):
    """número por fora da marcação: o centro recua conforme a largura do texto, para a borda de dentro
    ficar na mesma distância"""
    a = math.radians(ang)
    ww = h * 0.62 * len(s) * wide
    r = rr + abs(math.cos(a)) * ww * 0.18 + abs(math.sin(a)) * h * 0.1
    text(im, s, g['x'] + math.cos(a) * r, g['y'] + math.sin(a) * r * PY, h, col, FB, wide)


def face(d, g, pal):
    ell(d, g, g['R'], fill=pal['face'])


# ---------- pictogramas (centro relativo ao mostrador em colunas, tamanho s) ----------
def W_(s):
    return max(1, int(round(K * s)))


def icon_beam(d, g, cx, cy, s, col, low=False):
    """farol (meia-lua com os riscos para a frente, à esquerda); low: riscos inclinados (neblina: com a onda)"""
    x, y = g['x'] + cx, g['y'] + cy * PY
    w = W_(0.16 * s)
    a, b = P(x - 0.1 * s, y - 0.75 * s * PY), P(x + 1.1 * s, y + 0.75 * s * PY)
    d.chord([a[0] - (b[0] - a[0]), a[1], b[0], b[1]], -90, 90, fill=col)
    for k in range(4):
        yy = y + (-0.55 + k * 0.37) * s * PY
        dy = 0.25 * s * PY if low else 0
        d.line([P(x - 1.15 * s, yy + dy), P(x - 0.3 * s, yy)], fill=col, width=w)
    if low:   # risco ondulado do farol de neblina atravessando os raios
        pts = [P(x - 0.75 * s + 0.12 * s * math.sin(t / 3 * math.pi), y + (-0.9 + 1.8 * t / 12) * s * PY) for t in range(13)]
        d.line(pts, fill=col, width=w)


def icon_batt(d, g, cx, cy, s, col):
    x, y = g['x'] + cx, g['y'] + cy * PY
    w = W_(0.17 * s)
    d.rectangle([P(x - 1.0 * s, y - 0.55 * s * PY), P(x + 1.0 * s, y + 0.65 * s * PY)], outline=col, width=w)
    for sx in (-0.55, 0.55):
        d.rectangle([P(x + sx * s - 0.18 * s, y - 0.8 * s * PY), P(x + sx * s + 0.18 * s, y - 0.55 * s * PY)], fill=col)
    d.line([P(x - 0.75 * s, y + 0.05 * s * PY), P(x - 0.3 * s, y + 0.05 * s * PY)], fill=col, width=w)
    d.line([P(x + 0.3 * s, y + 0.05 * s * PY), P(x + 0.75 * s, y + 0.05 * s * PY)], fill=col, width=w)
    d.line([P(x - 0.525 * s, y - 0.2 * s * PY), P(x - 0.525 * s, y + 0.3 * s * PY)], fill=col, width=w)


def icon_oilcan(d, g, cx, cy, s, col, drop=True):
    """almotolia com a gota"""
    x, y = g['x'] + cx, g['y'] + cy * PY
    pts = [(-1.0, -0.05), (-0.55, -0.3), (0.35, -0.3), (1.0, -0.6), (1.05, -0.45), (0.45, 0.35), (-0.95, 0.35)]
    d.polygon([P(x + px * s, y + py * s * PY) for px, py in pts], fill=col)
    d.rectangle([P(x - 0.25 * s, y - 0.55 * s * PY), P(x + 0.1 * s, y - 0.3 * s * PY)], fill=col)
    if drop:
        ell(d, dict(x=x, y=y), 0.13 * s, fill=col, dx=1.1 * s, dy=0.15 * s)


def icon_thermo(d, g, cx, cy, s, col):
    x, y = g['x'] + cx, g['y'] + cy * PY
    w = W_(0.14 * s)
    d.rectangle([P(x - 0.13 * s, y - 0.95 * s * PY), P(x + 0.13 * s, y + 0.3 * s * PY)], fill=col)
    ell(d, dict(x=x, y=y), 0.3 * s, fill=col, dy=0.45 * s)
    for k in range(3):
        yy = y + (-0.75 + k * 0.3) * s * PY
        d.line([P(x + 0.2 * s, yy), P(x + 0.5 * s, yy)], fill=col, width=w)


def icon_pump(d, g, cx, cy, s, col):
    x, y = g['x'] + cx, g['y'] + cy * PY
    w = W_(0.2 * s)
    d.rectangle([P(x - 0.6 * s, y - 0.8 * s * PY), P(x + 0.25 * s, y + 0.8 * s * PY)], fill=col)
    d.rectangle([P(x - 0.42 * s, y - 0.6 * s * PY), P(x + 0.07 * s, y - 0.2 * s * PY)], fill=(10, 10, 12))
    d.line([P(x + 0.25 * s, y - 0.35 * s * PY), P(x + 0.6 * s, y - 0.1 * s * PY), P(x + 0.6 * s, y + 0.5 * s * PY)], fill=col, width=w)


def icon_oiltemp(d, g, cx, cy, s, col):
    """temperatura do óleo: almotolia com o termômetro em cima"""
    icon_oilcan(d, g, cx, cy + 0.2 * s, s, col, False)
    icon_thermo(d, g, cx - 0.1 * s, cy - 0.35 * s, s * 0.75, col)


def drums(d, g, n, cy, pitch, ww, hh, pal, last_white):
    """casas dos tambores (o jogo põe os algarismos)"""
    for i in range(n):
        x = g['x'] + (i - (n - 1) / 2) * pitch * g['R']
        a, b = P(x - ww * g['R'] / 2, g['y'] + (cy - hh / 2) * g['R'] * PY), P(x + ww * g['R'] / 2, g['y'] + (cy + hh / 2) * g['R'] * PY)
        d.rectangle([a[0] - K * 0.12, a[1] - K * 0.12, b[0] + K * 0.12, b[1] + K * 0.12], fill=(3, 3, 4))
        d.rectangle([a, b], fill=pal['white'] if last_white and i == n - 1 else pal['drum'])


def speed(im, d, pal):
    g, R = SPEED, SPEED['R']
    face(d, g, pal)
    arc_band(d, g, speed_a(140), speed_a(200), R * 0.455, R * 0.485, pal['tan'], pal['red'])
    for v in range(20, 201, 20):
        tick(d, g, speed_a(v), R * TICK_R0, R * TICK_R1, R * 0.03, pal['ink'])
        label(im, g, speed_a(v), str(v), R * NUM_R, R * 0.135, pal['ink'])
    drums(d, g, 5, -0.24, 0.115, 0.095, 0.14, pal, False)
    drums(d, g, 4, 0.22, 0.115, 0.095, 0.14, pal, True)
    text(im, 'km/h', g['x'], g['y'] + 0.37 * R * PY, R * 0.065, pal['ink'], FM)


def tach(im, d, pal):
    g, R = TACH, TACH['R']
    face(d, g, pal)
    arc_band(d, g, tach_a(4.5), tach_a(6.0), R * 0.455, R * 0.485, pal['tan'], pal['red'])
    for k in range(0, 7):
        tick(d, g, tach_a(k), R * TICK_R0, R * TICK_R1, R * 0.03, pal['ink'])
        if k:
            label(im, g, tach_a(k), str(k), R * NUM_R, R * 0.15, pal['ink'])
    text(im, 'x1000', g['x'] + 0.04 * R, g['y'] + 0.25 * R * PY, R * 0.07, pal['ink'], FM)
    text(im, 'RPM', g['x'] + 0.04 * R, g['y'] + 0.36 * R * PY, R * 0.07, pal['ink'], FM)
    icon_oilcan(d, g, -0.50 * R, 0.47 * R, 0.07 * R, pal['ink'])


def small(im, d, pal, g, fa, marks, labels, unit=None, icon=None, red=None, orange=None):
    R = g['R']
    face(d, g, pal)
    if red:
        arc_band(d, g, fa(red[0]), fa(red[1]), R * 0.36, R * 0.42, pal.get('warn', pal['red']))  # marca de alerta: vermelha também acesa
    if orange:
        arc_band(d, g, fa(orange[0]), fa(orange[1]), R * 0.36, R * 0.42, pal['orange'])
    for v in marks:
        tick(d, g, fa(v), R * STICK_R0, R * STICK_R1, R * 0.055, pal['ink'])
    for v, s in labels:
        label(im, g, fa(v), s, R * SNUM_R, R * 0.17, pal['ink'], 0.9)
    if unit:
        text(im, unit[0], g['x'] + unit[1] * R, g['y'] + unit[2] * R * PY, R * unit[3], pal['ink'], FM)
    if icon:
        icon[0](d, g, icon[1] * R, icon[2] * R, icon[3] * R, pal['ink'])


def build(pal, lamps_lit=False):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    speed(im, d, pal)
    tach(im, d, pal)
    small(im, d, pal, OILP, oilp_a, [0, 3, 5], [(0, '0'), (3, '3'), (5, '5')], ('kg/cm²', 0.22, 0.42, 0.12),
          (icon_oilcan, -0.42, 0.42, 0.10))
    small(im, d, pal, OILT, oilt_a, [40, 100, 120], [(40, '40'), (100, '100'), (120, '120')], ('°C', 0.3, 0.42, 0.13),
          (icon_oiltemp, -0.36, 0.42, 0.09), red=(120, 130))
    small(im, d, pal, TEMP, temp_a, [40, 90, 130], [(40, '40'), (90, '90'), (130, '130')], ('°C', 0.3, 0.42, 0.13),
          (icon_thermo, -0.28, 0.40, 0.16), red=(115, 130))
    small(im, d, pal, FUEL, fuel_a, [0, 0.5, 1], [(0, 'R'), (0.5, '1/2'), (1, 'C')], ('Comb', 0.22, 0.42, 0.11),
          (icon_pump, -0.36, 0.42, 0.13), orange=(0, 0.14))
    # luzes apagadas: lentes escuras e os ícones de farol/bateria em cinza (acendem com a cor)
    for name, g, lx, ly, ls, col in LAMPS:
        draw_lamp(d, name, g, lx, ly, ls, None, pal)
    if lamps_lit:
        for name, g, lx, ly, ls, col in LAMPS:
            draw_lamp(d, name, g, lx, ly, ls, col, pal)
    return im.resize((int((X1 - X0) * KO), int((Y1 - Y0) * KO)), Image.LANCZOS)


def draw_lamp(d, name, g, lx, ly, ls, col, pal):
    R = g['R']
    cx, cy = lx * R, ly * R
    off = col is None
    if name == 'beam':
        icon_beam(d, g, cx + 0.03 * R, cy, 0.075 * R, pal['icon_off'] if off else col)
    elif name == 'fog':
        icon_beam(d, g, cx + 0.03 * R, cy, 0.075 * R, pal['icon_off'] if off else col, True)
    elif name == 'batt':
        icon_batt(d, g, cx, cy, 0.075 * R, pal['icon_off'] if off else col)
    else:
        rr = (0.07 * R) if name != 'park' else 0.9
        if off:
            ell(d, g, rr + 0.25, fill=(4, 4, 5), dx=cx, dy=cy)
            ell(d, g, rr, fill=pal['lens_red'] if name == 'oil' else pal['lens_green'], dx=cx, dy=cy)
        else:
            ell(d, g, rr, fill=col, dx=cx, dy=cy)
            ell(d, g, rr * 0.45, fill=tuple(min(255, v + 90) for v in col), dx=cx - rr * 0.25, dy=cy - rr * 0.3)


def main():
    out = sys.argv[1]
    build(DAY).save(os.path.join(out, 'br-pumagte-cluster.png'), optimize=True)
    build(LIT).save(os.path.join(out, 'br-pumagte-cluster-lit.png'), optimize=True)
    build(DAY, True).save(os.path.join(out, 'br-pumagte-lamps.png'), optimize=True)
    for name, g, lx, ly, ls, _ in LAMPS:
        R = g['R'] if name != 'park' else 1.0
        print(name, round(g['x'] + lx * R, 2), round(g['y'] + ly * R * PY, 2), round(2 * (ls * R + 0.5), 2))


if __name__ == '__main__':
    main()
