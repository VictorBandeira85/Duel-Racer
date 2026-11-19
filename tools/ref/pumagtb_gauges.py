"""Quadro da Onça GTB (Puma GTB S2): o mesmo estilo do quadro da Onça GTE (onca_gte_gauges.py, pedido do
Victor: "semelhante ao do Onça GTE") com as escalas da FOTO DO QUADRO REAL do GTB que ele mandou, nos
mostradores da arte nova (pumagtb_cockpit.py):
- fundo preto fosco, números por fora e a marcação curta por dentro, só nos números; grotesca seminegrita
- velocímetro 20-220 km/h: 80 às 12h, 1,42° por km/h (o 220 passa das 6h); filete do 160 ao 220 do verde ao
  vermelho por dentro das marcações; hodômetro de cinco e parcial de quatro; "km/h"; seta (lente verde) embaixo
  à esquerda, APAGADA
- conta-giros 10-60 "x100 RPM": o 0 às 8h e 45° por mil (o 60 às 5h); filete do 45 ao 60 do verde ao vermelho;
  farol alto (azul) embaixo no meio, bateria (vermelha) e óleo (lente vermelha), APAGADOS
- quatro pequenos: combustível R-1/2-C (faixa laranja da reserva), temperatura da água 40-90-130 °C,
  pressão do óleo 0-3-5 kg/cm² e voltímetro 8-12-16 V
Sem marca no mostrador (o felino da Puma no meio sai). O jogo desenha os ponteiros vermelho-alaranjados em
barra (como na foto), os tambores e acende as luzes (pumaCluster em cockpit.ts, com a placa do GTB).
À noite acende em verde-menta, como a GTE.
Saídas: br-pumagtb-cluster.png, br-pumagtb-cluster-lit.png, br-pumagtb-lamps.png
Uso: python3 tools/ref/pumagtb_gauges.py <src/assets/cockpit>
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import onca_gte_gauges as G  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

G.X0, G.Y0, G.X1, G.Y1 = 82.0, 46.0, 330.0, 98.0
G.W, G.H = int(round((G.X1 - G.X0) * G.K)), int(round((G.Y1 - G.Y0) * G.K))
SPEED = dict(x=105.56, y=71.5, R=19.7)
TACH = dict(x=160.3, y=71.5, R=19.7)
FUEL = dict(x=226.26, y=73.05, R=10.9)
TEMP = dict(x=255.5, y=73.05, R=10.9)
OILP = dict(x=285.42, y=73.05, R=10.9)
VOLT = dict(x=314.32, y=73.05, R=10.9)
speed_a = lambda v: 270.0 + (v - 80) * 1.42
tach_a = lambda k: 150.0 + 45.0 * k
volt_a = G.pw([(8, 210.0), (12, 270.0), (16, 330.0)])
GREEN = (70, 190, 90)
LAMPS = [('turn', SPEED, -0.46, 0.40, 0.10, (70, 240, 90)), ('beam', TACH, -0.02, 0.68, 0.11, (80, 150, 255)),
         ('batt', TACH, -0.56, 0.38, 0.11, (255, 56, 40)), ('oil', TACH, -0.31, 0.60, 0.09, (255, 50, 36))]


def speed(im, d, pal):
    g, R = SPEED, SPEED['R']
    G.face(d, g, pal)
    G.arc_band(d, g, speed_a(160), speed_a(220), R * 0.455, R * 0.485, pal.get('green', GREEN), pal['red'])
    for v in range(20, 221, 20):
        G.tick(d, g, speed_a(v), R * G.TICK_R0, R * G.TICK_R1, R * 0.03, pal['ink'])
        G.label(im, g, speed_a(v), str(v), R * G.NUM_R, R * 0.14, pal['ink'])
    G.tick(d, g, speed_a(0), R * G.TICK_R0, R * G.TICK_R1, R * 0.03, pal['ink'])
    G.drums(d, g, 5, -0.24, 0.115, 0.095, 0.14, pal, False)
    G.drums(d, g, 4, 0.22, 0.115, 0.095, 0.14, pal, True)
    G.text(im, 'km/h', g['x'], g['y'] - 0.42 * R * G.PY, R * 0.07, pal['ink'], G.FM)


def tach(im, d, pal):
    g, R = TACH, TACH['R']
    G.face(d, g, pal)
    G.arc_band(d, g, tach_a(4.5), tach_a(6.0), R * 0.455, R * 0.485, pal.get('green', GREEN), pal['red'])
    for k in range(0, 7):
        G.tick(d, g, tach_a(k), R * G.TICK_R0, R * G.TICK_R1, R * 0.03, pal['ink'])
        if k:
            G.label(im, g, tach_a(k), str(k * 10), R * G.NUM_R, R * 0.15, pal['ink'])
    G.text(im, 'RPM', g['x'], g['y'] + 0.22 * R * G.PY, R * 0.075, pal['ink'], G.FM)
    G.text(im, 'x100', g['x'], g['y'] + 0.33 * R * G.PY, R * 0.075, pal['ink'], G.FM)


def build(pal, lamps_lit=False):
    im = Image.new('RGBA', (G.W, G.H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    speed(im, d, pal)
    tach(im, d, pal)
    G.small(im, d, pal, FUEL, G.fuel_a, [0, 0.5, 1], [(0, 'R'), (0.5, '1/2'), (1, 'C')], ('Comb', 0.22, 0.42, 0.11),
            (G.icon_pump, -0.36, 0.42, 0.13), orange=(0, 0.14))
    G.small(im, d, pal, TEMP, G.temp_a, [40, 90, 130], [(40, '40'), (90, '90'), (130, '130')], ('°C', 0.3, 0.42, 0.13),
            (G.icon_thermo, -0.28, 0.40, 0.16), red=(115, 130))
    G.small(im, d, pal, OILP, G.oilp_a, [0, 3, 5], [(0, '0'), (3, '3'), (5, '5')], ('kg/cm²', 0.22, 0.42, 0.12),
            (G.icon_oilcan, -0.42, 0.42, 0.10))
    G.small(im, d, pal, VOLT, volt_a, [8, 12, 16], [(8, '8'), (12, '12'), (16, '16')], ('V', 0.3, 0.42, 0.14),
            (G.icon_batt, -0.32, 0.42, 0.11), red=(8, 9))
    for name, g, lx, ly, ls, col in LAMPS:
        G.draw_lamp(d, name, g, lx, ly, ls, None, pal)
    if lamps_lit:
        for name, g, lx, ly, ls, col in LAMPS:
            G.draw_lamp(d, name, g, lx, ly, ls, col, pal)
    return im.resize((int((G.X1 - G.X0) * G.KO), int((G.Y1 - G.Y0) * G.KO)), Image.LANCZOS)


def main():
    out = sys.argv[1]
    lit = dict(G.LIT, green=(84, 230, 162))
    build(G.DAY).save(os.path.join(out, 'br-pumagtb-cluster.png'), optimize=True)
    build(lit).save(os.path.join(out, 'br-pumagtb-cluster-lit.png'), optimize=True)
    build(G.DAY, True).save(os.path.join(out, 'br-pumagtb-lamps.png'), optimize=True)
    print('placa', G.X0, G.Y0, G.X1 - G.X0, G.Y1 - G.Y0)
    for name, g, lx, ly, ls, _ in LAMPS:
        R = g['R']
        print(name, round(g['x'] + lx * R, 2), round(g['y'] + ly * R * G.PY, 2), round(2 * (ls * R + 0.5), 2))


if __name__ == '__main__':
    main()
