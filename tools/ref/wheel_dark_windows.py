"""Escurece as janelas (vãos entre os raios) que vieram cinzentas na arte de uma roda aftermarket:
inunda a partir das sementes pelos tons médios (o contorno escuro do vão segura) e pinta de preto.
Uso: python3 tools/ref/wheel_dark_windows.py src/assets/wheels/r11.png 17,17 46,17"""
import sys
from PIL import Image
path = sys.argv[1]
im = Image.open(path).convert('RGBA'); p = im.load(); W, H = im.size
lum = lambda x, y: sum(p[x, y][:3]) // 3
for seed in sys.argv[2:]:
    sx, sy = map(int, seed.split(','))
    seen, st = set(), [(sx, sy)]
    while st:
        x, y = st.pop()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H) or not (96 <= lum(x, y) < 232): continue
        seen.add((x, y)); st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    assert len(seen) < 260, f'vazou: {len(seen)}'
    edge = {(x + dx, y + dy) for x, y in seen for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - seen
    for x, y in seen: p[x, y] = (10, 10, 12, p[x, y][3])
    for x, y in edge:  # borda meio-tom do vão (suavização) também escurece
        if 56 <= lum(x, y) < 96: p[x, y] = (10, 10, 12, p[x, y][3])
    print(seed, len(seen))
im.save(path)
