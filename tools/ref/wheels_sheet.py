"""Rodas aftermarket (folha de pixel art do Victor, 8 x 5 rodas em quadros de fundo preto): acha o aro
de cada quadro (o que não é preto dentro do quadro), recorta em círculo e grava 64 x 64 com alfa em
src/assets/wheels/rNN.png. As muito parecidas entre si foram descartadas (fica uma de cada desenho):
KEEP lista as que entram, por linha e coluna (1..5, 1..8). O catálogo está em src/tuning.ts (WHEELS).
Uso: python3 tools/ref/wheels_sheet.py <folha.png> <src/assets/wheels>   (DBG=<pasta> grava a conferência)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

COLS, ROWS, SIZE = 8, 5, 64
# (linha, coluna, nome). Descartadas por serem repetidas: 1-5, 2-6 e 4-4 (5 raios como a 1-1); 3-1 e
# 3-4 (5 raios duplos como a 1-2); 4-3 (como a 4-2); 4-7 e 5-2 (multirraios como a 1-6); 5-1 (aro
# vermelho como a 1-7); 5-4 (como a 2-4); 5-5 (tela como a 1-8); 5-7 (como a 3-7); 5-8 (turbina como a 2-8)
KEEP = [
    (1, 1, 'Cinco raios'), (1, 2, 'Raios duplos'), (1, 3, 'Seis raios'), (1, 4, 'Raios em Y'), (1, 6, 'Doze raios'),
    (1, 7, 'Preta aro vermelho'), (1, 8, 'Tela fina'),
    (2, 1, 'Dourada 5 raios'), (2, 2, 'Grafite em Y'), (2, 3, 'Oito raios'), (2, 4, 'Três peças'), (2, 5, 'Raiada'),
    (2, 7, 'Grafite raiada'), (2, 8, 'Turbina'),
    (3, 2, 'Furos'), (3, 3, 'Tela dourada'), (3, 5, 'Preta e vermelha'), (3, 6, 'Dez raios'), (3, 7, 'Pás largas'),
    (3, 8, 'Colmeia'),
    (4, 1, 'Estrela'), (4, 2, 'Grafite 6 raios'), (4, 5, 'Garras'), (4, 6, 'Dourada 10 raios'), (4, 8, 'Cinco furos'),
    (5, 3, 'Raios curvos'), (5, 6, 'Preta aro azul'),
]


def find(a, r, c):
    H, W = a.shape[:2]
    # quadros medidos na folha de 1536 x 1024: o primeiro começa em (47, 42), passo 181,6 x 187
    k = W / 1536
    x0, x1 = int((47 + c * 181.6 + 9) * k), int((47 + c * 181.6 + 169) * k)
    y0, y1 = int((42 + r * 187 + 9) * k), int((42 + r * 187 + 171) * k)
    cell = a[y0:y1, x0:x1].astype(int)
    lum = cell.mean(axis=2)
    purple = (cell[..., 2] > cell[..., 1] + 30) & (cell[..., 0] > cell[..., 1] + 10) & (cell[..., 2] > cell[..., 0])  # moldura
    m = (lum > 58) & ~purple
    ys, xs = np.nonzero(m)
    xa, xb = np.percentile(xs, [0.5, 99.5])
    ya, yb = np.percentile(ys, [0.5, 99.5])
    return x0 + (xa + xb) / 2 + 0.5, y0 + (ya + yb) / 2 + 0.5, max(xb - xa, yb - ya) / 2 + 1.5


def main():
    src, out = sys.argv[1], sys.argv[2]
    im = Image.open(src).convert('RGB')
    a = np.array(im)
    tiles = []
    for n, (r, c, name) in enumerate(KEEP, 1):
        cx, cy, R = find(a, r - 1, c - 1)
        t = im.crop((int(round(cx - R)), int(round(cy - R)), int(round(cx + R)), int(round(cy + R)))).resize((SIZE, SIZE), Image.LANCZOS).convert('RGBA')
        m = Image.new('L', (SIZE * 4, SIZE * 4), 0)
        ImageDraw.Draw(m).ellipse([2, 2, SIZE * 4 - 3, SIZE * 4 - 3], fill=255)
        al = np.array(m.resize((SIZE, SIZE), Image.LANCZOS))
        t.putalpha(Image.fromarray(np.where(al > 127, 255, 0).astype(np.uint8)))
        t.save(os.path.join(out, f'r{n:02d}.png'), optimize=True)
        tiles.append((n, name, t))
    print(len(tiles), 'rodas')
    for n, name, _ in tiles:
        print(f"  {{ id: 'r{n:02d}', name: '{name}' }},")
    if os.environ.get('DBG'):
        s = Image.new('RGB', (9 * 132, 3 * 150), (0, 150, 0))
        d = ImageDraw.Draw(s)
        for i, (n, name, t) in enumerate(tiles):
            bg = Image.new('RGBA', t.size, (0, 150, 0, 255))
            bg.alpha_composite(t)
            s.paste(bg.convert('RGB').resize((128, 128), Image.NEAREST), ((i % 9) * 132, (i // 9) * 150))
            d.text(((i % 9) * 132 + 2, (i // 9) * 150 + 130), f'{n:02d} {name}', fill=(255, 255, 255))
        s.save(os.path.join(os.environ['DBG'], 'rodas.png'))


if __name__ == '__main__':
    main()
