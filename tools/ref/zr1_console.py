"""Corvette C4: console central e porta-luvas na área lisa à direita do volante (zr1-dash.png).

Pinta pixels absolutos (pode rodar de novo sem acumular). Coordenadas do PNG do painel (com as
102 colunas extras de cada lado): o volante vai até x≈303, o console começa atrás do aro.
"""
import sys
from PIL import Image

P = sys.argv[1] if len(sys.argv) > 1 else 'src/assets/cockpit/zr1-dash.png'
im = Image.open(P).convert('RGBA')
px = im.load()


def fill(x0, y0, x1, y1, c):  # inclusivo
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px[x, y] = (*c, 255)


def box(x0, y0, x1, y1, face, hi, lo):
    fill(x0, y0, x1, y1, face)
    fill(x0, y0, x1, y0, hi)
    fill(x0, y0, x0, y1, hi)
    fill(x0, y1, x1, y1, lo)
    fill(x1, y0, x1, y1, lo)


DIG = {  # 3x5
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '5': '111100111001111',
    '7': '111001001010010', '8': '111101111101111', '.': '000000000000010', 'C': '111100100100111',
    'F': '111100110100100', 'M': '101111111101101', 'A': '010101111101101', 'U': '101101101101111',
    'T': '111010010010010', 'O': '111101101101111', ' ': '000000000000000',
}


def text(x, y, s, c):
    for ch in s:
        g = DIG[ch]
        for k, b in enumerate(g):
            if b == '1':
                px[x + k % 3, y + k // 3] = (*c, 255)
        x += 4


def knob(cx, cy, r, c):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            d = (x - cx) ** 2 + (y - cy) ** 2
            if d <= r * r + r:
                k = 18 if (x - cx) + (y - cy) < 0 else -14
                px[x, y] = (*(max(0, min(255, v + k)) for v in c), 255)
    px[cx, cy - r + 1] = (200, 200, 205, 255)  # marca do botão


DARK, FACE, EDGE_HI, EDGE_LO = (14, 14, 15), (40, 40, 41), (84, 84, 86), (20, 20, 20)
# moldura do console (desce até a faixa de baixo do painel)
box(299, 35, 363, 113, FACE, EDGE_HI, EDGE_LO)
fill(364, 36, 365, 113, (34, 34, 34))  # sombra na lateral do console
# dois difusores quadrados com aletas horizontais
for x0 in (303, 333):
    box(x0, 39, x0 + 27, 55, (28, 28, 29), (18, 18, 18), (70, 70, 72))
    fill(x0 + 1, 40, x0 + 26, 54, DARK)
    for y in range(41, 54, 3):
        fill(x0 + 2, y, x0 + 25, y, (78, 78, 80))
        fill(x0 + 2, y + 1, x0 + 25, y + 1, (36, 36, 38))
    fill(x0 + 13, 45, x0 + 14, 49, (120, 120, 124))  # botão de direção da aleta
# rádio: botões giratórios, visor âmbar, teclas e a boca da fita
box(303, 58, 360, 78, (24, 24, 26), (60, 60, 62), (10, 10, 10))
knob(308, 64, 3, (92, 92, 96))
knob(355, 64, 3, (92, 92, 96))
fill(315, 60, 348, 67, (8, 20, 12))
text(318, 61, 'FM 101.5', (236, 160, 44))
for k in range(6):
    x = 309 + k * 7
    box(x, 70, x + 5, 72, (72, 72, 76), (110, 110, 114), (36, 36, 38))
fill(315, 75, 348, 76, (4, 4, 4))
fill(315, 74, 348, 74, (52, 52, 54))
# ar-condicionado digital: temperatura no visor e teclas dos lados
box(303, 81, 360, 96, (24, 24, 26), (60, 60, 62), (10, 10, 10))
fill(321, 83, 342, 90, (22, 10, 4))
text(323, 84, 'AUTO', (236, 160, 44))
text(323, 91, '   ', (0, 0, 0))
for (x, y) in [(306, 83), (313, 83), (306, 88), (313, 88), (346, 83), (353, 83), (346, 88), (353, 88)]:
    box(x, y, x + 5, y + 3, (72, 72, 76), (110, 110, 114), (36, 36, 38))
for k in range(5):  # ventilação: barrinhas verdes
    fill(323 + k * 4, 93, 325 + k * 4, 94, (60, 200, 70) if k < 3 else (20, 50, 24))
# acendedor e cinzeiro
knob(312, 104, 3, (70, 70, 74))
box(322, 100, 350, 109, (30, 30, 32), (64, 64, 66), (12, 12, 12))
fill(324, 104, 348, 104, (14, 14, 14))
# porta-luvas do passageiro (frisos na espuma do painel) com a fechadura
for x in range(378, 452):
    px[x, 46] = (40, 39, 38, 255)
    px[x, 47] = (78, 77, 75, 255)
    px[x, 93] = (40, 39, 38, 255)
    px[x, 94] = (78, 77, 75, 255)
for y in range(46, 95):
    px[378, y] = (40, 39, 38, 255)
    px[379, y] = (78, 77, 75, 255)
fill(384, 66, 393, 70, (26, 26, 27))
fill(385, 67, 392, 67, (120, 120, 124))
im.save(P)
