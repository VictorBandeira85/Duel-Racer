"""Savana GLS, lateral: a lanterna de trás aparece de lado como um bloco âmbar em cima e um vermelho
embaixo; na traseira ela é âmbar no canto de fora (o pisca que dá a volta na lateral). Para as duas
vistas baterem, a parte de baixo (e os pixels vermelhos soltos da de cima) passa para âmbar, com o
mesmo brilho de cada pixel (a forma e o brilho da lente ficam).
Uso: python3 tools/ref/santana_side_lamp.py   (rodar depois do santana_sprites.py)"""
import colorsys
import os
import numpy as np
from PIL import Image

CARS = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/cars')
p = os.path.join(CARS, 'br-santana-side.png')
a = np.array(Image.open(p).convert('RGBA'))
X0, X1, Y0, Y1 = 380, 396, 51, 68   # caixa da lanterna no sprite de 400 px (medida)
n = 0
for y in range(Y0, Y1 + 1):
    for x in range(X0, X1 + 1):
        r, g, b, al = (int(v) for v in a[y, x])
        if not al:
            continue
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s > 0.5 and v > 0.25 and (h < 0.05 or h > 0.95):
            # âmbar das lentes da traseira: matiz ~0,09; um pouco mais claro que o vermelho de mesmo brilho
            # o vermelho da lente é bem mais escuro que o âmbar: o brilho é levado para a faixa do âmbar de
            # cima (0,78 a 1), mantendo a ordem do mais escuro para o mais claro
            nr, ng, nb = colorsys.hsv_to_rgb(0.085 if v < 0.9 else 0.11, 0.95, 0.78 + 0.22 * min(1, (v - 0.25) / 0.6))
            a[y, x, :3] = (int(nr * 255), int(ng * 255), int(nb * 255))
            n += 1
Image.fromarray(a, 'RGBA').save(p, optimize=True)
print('lanterna lateral: pixels', n)
