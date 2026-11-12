"""Savana GLS, lateral: a lanterna de trás vista de lado é UMA lente só, âmbar (o canto de fora da
lanterna traseira dando a volta), sem divisória no meio. A arte trazia um bloco âmbar em cima, um
vermelho embaixo e uma faixa preta entre os dois: a lente inteira passa a âmbar de um tom só (com um
filete mais claro em cima, a luz do céu) e a faixa preta do meio some (só o contorno de fora fica).
Uso: python3 tools/ref/santana_side_lamp.py   (rodar depois do santana_sprites.py)"""
import os
import numpy as np
from PIL import Image

CARS = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/cars')
p = os.path.join(CARS, 'br-santana-side.png')
a = np.array(Image.open(p).convert('RGBA'))
X0, X1, Y0, Y1 = 378, 398, 50, 69   # caixa da lanterna no sprite de 400 px (medida)
AMBER, TOP = (240, 124, 12), (252, 160, 32)
rgb = a[..., :3].astype(int)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
# lente = pixels saturados vermelhos/âmbar dentro da caixa
lens = np.zeros(a.shape[:2], bool)
lens[Y0:Y1 + 1, X0:X1 + 1] = True
lens &= (a[..., 3] > 0) & (r > 70) & (r > g + 35) & (r > b + 50)
# divisória: pixels escuros com lente logo acima e logo abaixo (até 2 linhas) na mesma coluna
dark = (a[..., 3] > 0) & (rgb.max(2) < 70)
div = np.zeros_like(lens)
for y in range(Y0 + 1, Y1):
    for x in range(X0, X1 + 1):
        if not dark[y, x]:
            continue
        up = lens[max(Y0, y - 2):y, x].any()
        dn = lens[y + 1:min(Y1, y + 2) + 1, x].any()
        if up and dn:
            div[y, x] = True
# só a linha da divisória (escura de lado a lado da lente); o contorno de fora fica
for y in range(H := a.shape[0]):
    if div[y].sum() < 5:
        div[y] = False
fill = lens | div
top = fill & ~np.roll(fill, 1, 0)          # primeira linha da lente: filete mais claro
a[fill, :3] = AMBER
a[top, :3] = TOP
n = int(fill.sum())
# contorno preto: onde a lente encosta direto na lataria (sem o traço preto da arte), o pixel da borda
# da lente vira contorno, como no resto da lanterna
near_body = np.zeros_like(fill)
for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
    nb = np.roll(np.roll(fill, -dy, 0), -dx, 1)
    v = np.roll(np.roll(a[..., :3].astype(int), -dy, 0), -dx, 1).max(2)
    near_body |= fill & ~nb & (v > 110)
a[near_body, :3] = (0, 2, 4)
Image.fromarray(a, 'RGBA').save(p, optimize=True)
print('lanterna lateral: pixels', n)
