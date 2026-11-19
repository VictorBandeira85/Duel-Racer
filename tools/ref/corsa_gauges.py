"""Quadro do Corsário GSi copiando as FOTOS DO QUADRO REAL do Corsa GSi que o Victor mandou, nos mostradores
da arte nova (corsa_cockpit2.py):
- fundo preto; marcações finas POR FORA (de 0,2 em 0,2 mil rpm e de 5 em 5 km/h, as dos números mais
  compridas) e os números POR DENTRO, brancos em grotesca seminegrita
- conta-giros 0-7 "x1000 min-1": o 0 embaixo à esquerda e o 7 embaixo à direita (270°); as marcações do
  6,5 ao 7 em vermelho
- velocímetro 20-220 km/h no mesmo arco, "km/h", hodômetro em cima e parcial embaixo
- pequenos: combustível (20, 40, "Ltr", bomba) com as marcações da reserva em vermelho e temperatura
  (90, 100, °C, termômetro) com as do fim em vermelho, arco no alto
- luzes-espia vermelhas à esquerda do conta-giros (bateria) e à direita do velocímetro (óleo), APAGADAS
Sem marca no mostrador. À noite (foto acesa) números e marcações acendem em âmbar sobre o preto.
O jogo desenha os ponteiros creme afinados, os tambores e acende as luzes (pumaGauges em cockpit.ts).
Saídas: br-corsa-cluster.png, br-corsa-cluster-lit.png, br-corsa-lamps.png
Uso: python3 tools/ref/corsa_gauges.py <src/assets/cockpit>
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import onca_gte_gauges as G  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

G.X0, G.Y0, G.X1, G.Y1 = 80.0, 62.0, 186.0, 113.0
G.W, G.H = int(round((G.X1 - G.X0) * G.K)), int(round((G.Y1 - G.Y0) * G.K))
G.KO = 8
TACH = dict(x=113.18, y=83.82, R=17.1)
SPEED = dict(x=147.0, y=83.82, R=17.1)
FUEL = dict(x=91.14, y=101.62, R=8.4)
TEMP = dict(x=171.32, y=101.62, R=8.4)
tach_a = lambda k: 135.0 + k * 270.0 / 7
speed_a = lambda v: 135.0 + (v - 20) * 270.0 / 200
fuel_a = lambda f: 205.0 + 130.0 * f
temp_a = lambda t: 205.0 + (t - 50) * 130.0 / 80
DAY = dict(G.DAY, ink=(236, 236, 232), red=(214, 40, 30))
LIT = dict(G.LIT, ink=(255, 168, 70), dim=(220, 130, 50), red=(255, 70, 40), face=(10, 8, 6), icon_off=(60, 40, 20))
LAMPS = [('batt', TACH, -1.44, 0.0, 0.11, (255, 56, 40)), ('oil', SPEED, 1.62, 0.0, 0.09, (255, 50, 36))]


def scale(im, d, g, pal, ang, v0, v1, step, major, labels, redfrom=None, lr=0.62, lh=0.15):
    R = g['R']
    G.face(d, g, pal)
    n = int(round((v1 - v0) / step))
    for i in range(n + 1):
        v = v0 + i * step
        big = abs((v - v0) / major - round((v - v0) / major)) < 1e-6
        col = pal['red'] if redfrom is not None and v >= redfrom - 1e-6 else pal['ink']
        G.tick(d, g, ang(v), R * (0.80 if big else 0.87), R * 0.97, R * (0.05 if big else 0.025), col)
    for v, s in labels:
        G.text(im, s, g['x'] + G.math.cos(G.math.radians(ang(v))) * R * lr, g['y'] + G.math.sin(G.math.radians(ang(v))) * R * lr * G.PY, R * lh, pal['ink'], G.FB, 0.85)


def build(pal, lamps_lit=False):
    im = Image.new('RGBA', (G.W, G.H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    scale(im, d, TACH, pal, tach_a, 0, 7, 0.2, 1, [(k, str(k)) for k in range(8)], redfrom=6.4)
    G.text(im, 'x1000', TACH['x'], TACH['y'] + 0.36 * TACH['R'] * G.PY, TACH['R'] * 0.07, pal['ink'], G.FM)
    G.text(im, 'min-1', TACH['x'], TACH['y'] + 0.47 * TACH['R'] * G.PY, TACH['R'] * 0.07, pal['ink'], G.FM)
    scale(im, d, SPEED, pal, speed_a, 20, 220, 5, 20, [(v, str(v)) for v in range(20, 221, 20)], lr=0.67, lh=0.115)
    G.drums(d, SPEED, 5, -0.24, 0.115, 0.095, 0.14, pal, False)
    G.drums(d, SPEED, 4, 0.22, 0.115, 0.095, 0.14, pal, True)
    G.text(im, 'km', SPEED['x'], SPEED['y'] - 0.40 * SPEED['R'] * G.PY, SPEED['R'] * 0.07, pal['ink'], G.FM)
    G.text(im, 'km/h', SPEED['x'], SPEED['y'] + 0.42 * SPEED['R'] * G.PY, SPEED['R'] * 0.08, pal['ink'], G.FM)
    for g, ang, v0, v1, labels, red, unit, icon in (
            (FUEL, fuel_a, 0, 1, [(0.5, '20'), (1, '40')], (0, 0.15), 'Ltr', G.icon_pump),
            (TEMP, temp_a, 50, 130, [(90, '90'), (115, '100')], (118, 130), '°C', G.icon_thermo)):
        R = g['R']
        G.face(d, g, pal)
        step = (v1 - v0) / 12
        for i in range(13):
            v = v0 + i * step
            col = pal['red'] if red[0] - 1e-6 <= v <= red[1] + 1e-6 else pal['ink']
            G.tick(d, g, ang(v), R * (0.66 if i % 3 == 0 else 0.74), R * 0.92, R * (0.07 if i % 3 == 0 else 0.04), col)
        for v, s in labels:
            G.label(im, g, ang(v), s, R * 0.44, R * 0.16, pal['ink'], 0.8)
        G.text(im, unit, g['x'] + 0.3 * R, g['y'] + 0.42 * R * G.PY, R * 0.17, pal['ink'], G.FM)
        icon(d, g, -0.36 * R, 0.42 * R, 0.16 * R, pal['ink'])
    for name, g, lx, ly, ls, col in LAMPS:
        G.draw_lamp(d, name, g, lx, ly, ls, None, pal)
    if lamps_lit:
        for name, g, lx, ly, ls, col in LAMPS:
            G.draw_lamp(d, name, g, lx, ly, ls, col, pal)
    return im.resize((int((G.X1 - G.X0) * G.KO), int((G.Y1 - G.Y0) * G.KO)), Image.LANCZOS)


def main():
    out = sys.argv[1]
    build(DAY).save(os.path.join(out, 'br-corsa-cluster.png'), optimize=True)
    build(LIT).save(os.path.join(out, 'br-corsa-cluster-lit.png'), optimize=True)
    build(DAY, True).save(os.path.join(out, 'br-corsa-lamps.png'), optimize=True)
    print('placa', G.X0, G.Y0, G.X1 - G.X0, G.Y1 - G.Y0)
    for name, g, lx, ly, ls, _ in LAMPS:
        R = g['R']
        print(name, round(g['x'] + lx * R, 2), round(g['y'] + ly * R * G.PY, 2), round(2 * (ls * R + 0.5), 2))


if __name__ == '__main__':
    main()
