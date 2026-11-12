"""Kaze NX, traseira: a máscara de pintura parava numa linha reta abaixo das lanternas, e a lataria em
volta delas (os ombros dos para-lamas dos dois lados, o aerofólio por cima e as carcaças dos
retrovisores) ficava vermelha com qualquer cor: parecia a lanterna "vazando" para fora do desenho.
Acrescenta à máscara os tons de lataria acima dessa linha, FORA do contorno das lanternas (medido na
arte: a borda de fora da lanterna sobe inclinada, de x=10 em y=60 a x=26 em y=38).
Uso: python3 tools/ref/nx_rear_mask_fix.py"""
import os
import numpy as np
from PIL import Image

CARS = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/cars')
a = np.array(Image.open(os.path.join(CARS, 'nsx-rear.png')).convert('RGBA')).astype(int)
mp = os.path.join(CARS, 'nsx-rear-mask.png')
m0 = Image.open(mp)
m = np.array(m0.convert('RGBA'))
H, W = a.shape[:2]
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
yy, xx = np.mgrid[0:H, 0:W]
xl = np.interp(yy, [38, 40, 44, 50, 60, 61], [26, 23, 19.5, 15, 10, 10])   # borda de fora da lanterna
lantern = (yy >= 38) & (yy <= 61) & (xx >= xl) & (xx <= W - xl)
body = (al > 0) & (yy >= 30) & (yy <= 61) & ~lantern & (r > 150) & (r > g * 1.6) & (r > b * 1.6)
# reflexos claros/rosados encostados na lataria (bordas) também recebem a cor
near = body.copy()
for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
    near |= np.roll(np.roll(body, dy, axis=0), dx, axis=1)
light = (al > 0) & (yy >= 30) & (yy <= 61) & ~lantern & (r > 200) & (r >= g) & (r >= b) & (r - b > 25) & near
add = body | light
m[add] = 255
Image.fromarray(m, 'RGBA').convert(m0.mode).save(mp, optimize=True)
print('acrescentados', int(add.sum()))
