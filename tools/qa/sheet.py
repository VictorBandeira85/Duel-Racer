"""Monta a folha de conferência de cada carro a partir dos prints de cockpit_shots.cjs: a tela
inteira de cada situação e, ampliados, o canto esquerdo (retrovisor e coluna) e o quadro.
Uso: python3 tools/qa/sheet.py <pasta dos prints>   -> <pasta>/<carro>.png
"""
import glob
import os
import sys
from collections import defaultdict

from PIL import Image, ImageDraw


def main():
    d = sys.argv[1]
    groups = defaultdict(list)
    for f in sorted(glob.glob(os.path.join(d, '*_*_*.png'))):
        groups[os.path.basename(f).split('_')[0]].append(f)
    for car, fs in groups.items():
        rows = []
        for f in fs:
            im = Image.open(f).convert('RGB')
            W, H = im.size
            full = im.resize((W // 4, H // 4))
            left = im.crop((0, int(H * 0.3), int(W * 0.25), int(H * 0.8))).resize((int(W * 0.25 / 2), int(H * 0.5 / 2)), Image.NEAREST)
            clu = im.crop((int(W * 0.3), int(H * 0.55), int(W * 0.7), int(H * 0.85))).resize((int(W * 0.4 / 2), int(H * 0.3 / 2)), Image.NEAREST)
            rows.append((os.path.basename(f), full, left, clu))
        wmax = max(r[1].width + r[2].width + r[3].width for r in rows) + 30
        hsum = sum(max(r[1].height, r[2].height, r[3].height) + 18 for r in rows)
        sheet = Image.new('RGB', (wmax, hsum), (24, 24, 26))
        dr = ImageDraw.Draw(sheet)
        y = 0
        for name, a, b, c in rows:
            dr.text((4, y + 2), name, fill=(255, 220, 80))
            sheet.paste(a, (0, y + 16))
            sheet.paste(b, (a.width + 10, y + 16))
            sheet.paste(c, (a.width + b.width + 20, y + 16))
            y += max(a.height, b.height, c.height) + 18
        sheet.save(os.path.join(d, f'{car}.png'))
        print(car, len(rows))


if __name__ == '__main__':
    main()
