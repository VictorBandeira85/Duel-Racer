"""Restos da cor de fábrica depois de repintar: mostra cada vista de um carro pintada de branco (pela
máscara de pintura) e marca em MAGENTA os pixels que continuam com o matiz da cor de fábrica FORA da
máscara. Lanternas e emblemas aparecem marcados também: o que interessa são os pontos soltos na lataria.
Uso: python3 tools/qa/paint_leftover.py <prefixo em src/assets/cars, ex. nsx> <saída.png> [matiz_graus tolerância]"""
import colorsys
import os
import sys
import numpy as np
from PIL import Image

CARS = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/cars')
name, out = sys.argv[1], sys.argv[2]
hue0 = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
tol = float(sys.argv[4]) if len(sys.argv) > 4 else 22.0
rows = []
for v in ('side', 'front', 'rear'):
    a = np.array(Image.open(os.path.join(CARS, f'{name}-{v}.png')).convert('RGBA'))
    m = np.array(Image.open(os.path.join(CARS, f'{name}-{v}-mask.png')).convert('L')) > 127
    rgb = a[..., :3].astype(float) / 255
    mx, mn = rgb.max(2), rgb.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    hue = np.zeros(mx.shape)
    for (y, x) in zip(*np.nonzero(a[..., 3] > 0)):
        hue[y, x] = colorsys.rgb_to_hsv(*rgb[y, x])[0] * 360
    dh = np.abs((hue - hue0 + 180) % 360 - 180)
    left = (a[..., 3] > 0) & ~m & (dh < tol) & (sat > 0.45) & (mx > 0.3)
    o = a.copy()
    lum = mx
    o[m, :3] = (lum[m][:, None] * 235).astype(np.uint8)
    o2 = o.copy()
    o2[left, :3] = (255, 0, 255)
    k = 4
    for arr in (o, o2):
        im = Image.fromarray(arr, 'RGBA')
        bg = Image.new('RGBA', im.size, (70, 80, 95, 255))
        bg.alpha_composite(im)
        rows.append(bg.resize((im.width * k, im.height * k), Image.NEAREST))
    print(v, 'restos fora da máscara:', int(left.sum()))
W = max(r.width for r in rows)
sheet = Image.new('RGB', (W, sum(r.height for r in rows)), (70, 80, 95))
y = 0
for r in rows:
    sheet.paste(r.convert('RGB'), (0, y)); y += r.height
sheet.save(out)
