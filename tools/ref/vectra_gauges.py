"""Quadro do Vetor GSi copiando a FOTO DO QUADRO REAL do Vectra GSi (1ª geração) que o Victor mandou; a arte nova
tem quatro mostradores redondos, mas a foto manda (CLAUDE.md): a placa cobre a moldura toda da arte com o
quadro de verdade:
- fundo cinza-escuro liso com os três nichos; NÚMEROS POR FORA e as marcações POR DENTRO (como na foto),
  algarismos brancos em grotesca seminegrita
- conta-giros 0-8 à esquerda: o 0 às 9h (178°) e o 8 em cima à direita (308°), marcas a cada meio mil, as
  do 7 ao 8 vermelhas; "ELECTRONIC x1000 min-1" embaixo à esquerda
- velocímetro 20-240 km/h no meio: o 20 às 9h e o 240 embaixo à direita (0,877° por km/h), marcas de 10 em 10;
  hodômetro de seis casas em cima ("km") e parcial de quatro embaixo; "km/h" embaixo à esquerda
- à direita, no mesmo nicho, temperatura (frio azul às 9h, 90 e 100, quente vermelho em cima, termômetro e
  "°C") e combustível (reserva vermelha às 9h, 30 e 60, bomba e "Ltr")
- embaixo, a fileira de luzes-espia em retângulos, APAGADAS (o jogo acende bateria e óleo)
Sem marca no mostrador. À noite os números e marcações acendem em âmbar sobre o fundo escuro.
O jogo desenha os ponteiros brancos em barra com o disco escuro grande por cima, os tambores e as luzes
(pumaGauges em cockpit.ts).
Saídas: br-vectra-cluster.png, br-vectra-cluster-lit.png, br-vectra-lamps.png
Uso: python3 tools/ref/vectra_gauges.py <src/assets/cockpit>
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import onca_gte_gauges as G  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

G.X0, G.Y0, G.X1, G.Y1 = 98.6, 43.8, 208.6, 84.8
G.W, G.H = int(round((G.X1 - G.X0) * G.K)), int(round((G.Y1 - G.Y0) * G.K))
G.KO = 8
TACH = dict(x=124.1, y=65.8, R=16.5)
SPEED = dict(x=155.6, y=65.8, R=19.5)
TEMP = dict(x=188.6, y=66.8, R=8.5)
FUEL = dict(x=202.0, y=66.8, R=8.5)
tach_a = lambda k: 178.0 + k * 16.25
speed_a = lambda v: 180.0 + (v - 20) * 0.877
temp_a = lambda t: 180.0 + (t - 50) * 90.0 / 80      # 50 °C frio (9h) a 130 °C quente (12h)
fuel_a = lambda f: 186.0 + 66.0 * f
DAY = dict(G.DAY, face=(38, 40, 46), ink=(238, 238, 236), red=(220, 40, 30), icon_off=(70, 70, 76), drum=(20, 20, 24), white=(214, 212, 204))
LIT = dict(G.LIT, face=(16, 14, 14), ink=(255, 170, 72), dim=(220, 130, 50), red=(255, 70, 40), icon_off=(64, 44, 24), drum=(10, 9, 8), white=(150, 110, 60))
BLUE = (60, 150, 230)
ROW_Y = 80.4
LAMP_X = [103.1, 106.9, 110.7, 114.5, 118.3, 122.1, 125.9, 133.6, 152.1, 165.6, 176.6, 184.1, 191.6, 199.1]
LAMPS = [('batt', 2), ('oil', 8)]  # índice em LAMP_X


def scale(im, d, g, pal, ang, v0, v1, step, major, labels, redfrom=None, lr=0.86, lh=0.13):
    R = g['R']
    n = int(round((v1 - v0) / step))
    for i in range(n + 1):
        v = v0 + i * step
        big = abs((v - v0) / major - round((v - v0) / major)) < 1e-6
        col = pal['red'] if redfrom is not None and v >= redfrom - 1e-6 else pal['ink']
        G.tick(d, g, ang(v), R * (0.58 if big else 0.65), R * 0.73, R * (0.032 if big else 0.018), col)
    for v, s in labels:
        G.label(im, g, ang(v), s, R * lr, R * lh, pal['ink'], 0.85)


def nicho(d, g, rr, pal, dx=0.0):
    G.ell(d, g, rr, fill=tuple(max(0, c - 8) for c in pal['face']), dx=dx)


def build(pal, lamps_lit=False):
    im = Image.new('RGBA', (G.W, G.H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    a, b = G.P(G.X0, G.Y0), G.P(G.X1, G.Y1)
    d.rounded_rectangle([a, b], radius=int(G.K * 3), fill=pal['face'])
    nicho(d, TACH, TACH['R'] * 1.02, pal)
    nicho(d, SPEED, SPEED['R'] * 1.02, pal)
    nicho(d, dict(TEMP, x=(TEMP['x'] + FUEL['x']) / 2), 12.5, pal)
    scale(im, d, TACH, pal, tach_a, 0, 8, 0.5, 1, [(k, str(k)) for k in range(9)], redfrom=7)
    for t, y in (('ELECTRONIC', 0.34), ('x1000', 0.46), ('min-1', 0.58)):
        G.text(im, t, TACH['x'] - 0.62 * TACH['R'], TACH['y'] + y * TACH['R'] * G.PY, TACH['R'] * 0.06, pal['ink'], G.FM)
    scale(im, d, SPEED, pal, speed_a, 20, 240, 10, 20, [(v, str(v)) for v in range(20, 241, 20)], lr=0.88, lh=0.1)
    G.drums(d, SPEED, 6, -0.27, 0.1, 0.085, 0.13, pal, False)
    G.drums(d, SPEED, 4, 0.33, 0.1, 0.085, 0.13, pal, True)
    G.text(im, 'km', SPEED['x'], SPEED['y'] - 0.44 * SPEED['R'] * G.PY, SPEED['R'] * 0.055, pal['ink'], G.FM)
    G.text(im, 'km/h', SPEED['x'] - 0.66 * SPEED['R'], SPEED['y'] + 0.32 * SPEED['R'] * G.PY, SPEED['R'] * 0.065, pal['ink'], G.FM)
    for g, ang, v0, v1, labels, cold, hot, unit, icon in (
            (TEMP, temp_a, 50, 130, [(90, '90'), (110, '100')], (50, 56), (122, 130), '°C', G.icon_thermo),
            (FUEL, fuel_a, 0, 1, [(0.5, '30'), (1, '60')], None, (0, 0.12), 'Ltr', G.icon_pump)):
        R = g['R']
        step = (v1 - v0) / 8
        for i in range(9):
            v = v0 + i * step
            col = BLUE if cold and cold[0] - 1e-6 <= v <= cold[1] + 1e-6 else pal['red'] if hot[0] - 1e-6 <= v <= hot[1] + 1e-6 else pal['ink']
            G.tick(d, g, ang(v), R * (0.62 if i % 4 == 0 else 0.72), R * 0.9, R * (0.05 if i % 4 == 0 else 0.03), col)
        for v, s in labels:
            G.label(im, g, ang(v), s, R * 1.08, R * 0.18, pal['ink'], 0.8)
        G.text(im, unit, g['x'] - 0.55 * R, g['y'] + 0.5 * R * G.PY, R * 0.18, pal['ink'], G.FM)
        icon(d, g, 0.05 * R, -1.5 * R, 0.17 * R, pal['ink'])
    # fileira de luzes-espia (retângulos), apagadas
    for i, x in enumerate(LAMP_X):
        w = 1.6 if i < 7 else 3.4
        p0, p1 = G.P(x - w, ROW_Y - 1.4), G.P(x + w, ROW_Y + 1.4)
        d.rectangle([p0, p1], fill=(20, 18, 20), outline=(60, 60, 66), width=2)
        if i < 7 or i == 8:
            q0, q1 = G.P(x - w * 0.55, ROW_Y - 0.8), G.P(x + w * 0.55, ROW_Y + 0.8)
            d.rectangle([q0, q1], fill=(70, 24, 18))
    if lamps_lit:
        for name, i in LAMPS:
            x = LAMP_X[i]
            w = 1.6 if i < 7 else 3.4
            q0, q1 = G.P(x - w * 0.8, ROW_Y - 1.1), G.P(x + w * 0.8, ROW_Y + 1.1)
            d.rectangle([q0, q1], fill=(255, 60, 36))
    return im.resize((int((G.X1 - G.X0) * G.KO), int((G.Y1 - G.Y0) * G.KO)), Image.LANCZOS)


def main():
    out = sys.argv[1]
    build(DAY).save(os.path.join(out, 'br-vectra-cluster.png'), optimize=True)
    build(LIT).save(os.path.join(out, 'br-vectra-cluster-lit.png'), optimize=True)
    build(DAY, True).save(os.path.join(out, 'br-vectra-lamps.png'), optimize=True)
    print('placa', G.X0, G.Y0, G.X1 - G.X0, G.Y1 - G.Y0)
    for name, i in LAMPS:
        w = 1.6 if i < 7 else 3.4
        print(name, LAMP_X[i], ROW_Y, round(2 * w, 2))


if __name__ == '__main__':
    main()
