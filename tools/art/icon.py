"""Ícone do app (pixel art): céu de pôr do sol em faixas, estrada e a traseira do F40.

Desenha em 64x64 e amplia sem suavizar para 180, 192 e 512 px.
Uso: python3 tools/art/icon.py
"""
import os

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
S = 64
im = Image.new('RGB', (S, S))
d = ImageDraw.Draw(im)
bands = ['#2a1a5e', '#4a2378', '#7a2a7a', '#b8366a', '#e85a4a', '#f89a3a', '#ffd25a']
hz = 34
for i, c in enumerate(bands):
    d.rectangle([0, i * hz // len(bands), S, (i + 1) * hz // len(bands)], fill=c)
d.ellipse([22, 18, 42, 38], fill='#ffe88a')                     # sol
for y in (24, 28, 31):
    d.line([0, y, S, y], fill=bands[4 if y < 28 else 5])
d.polygon([(0, hz), (14, hz - 6), (24, hz - 2), (36, hz - 7), (50, hz - 3), (64, hz - 6), (64, hz), (0, hz)], fill='#2a1a40')
d.rectangle([0, hz, S, S], fill='#1e6a1e')
for y in range(hz, S, 2):
    d.line([0, y, S, y], fill='#2a8a2a' if (y // 2) % 2 else '#1e6a1e')
d.polygon([(30, hz), (34, hz), (S + 8, S), (-8, S)], fill='#3a3a40')
for k in range(4):
    y0 = hz + 3 + k * k * 2 + k * 3
    d.rectangle([31, y0, 32, y0 + 1 + k], fill='#ffd400')
car = Image.open(os.path.join(ROOT, 'src/assets/cars/f40-rear.png')).convert('RGBA')
w = 40
car = car.resize((w, round(car.height * w / car.width)), Image.NEAREST)
im.paste(car, ((S - w) // 2, S - car.height - 3), car)
out = os.path.join(ROOT, 'public/icons')
for n in (180, 192, 512):
    im.resize((n, n), Image.NEAREST).save(f'{out}/icon-{n}.png')
print('ok')
