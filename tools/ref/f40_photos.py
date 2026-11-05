"""Fotos da revista da Furia F4 (F40, pixel art do Victor): o escudo/cavalinho vira o escudo da Fúria,
textos e títulos reais saem (recorte); reduz para 560 x 315. As artes com marcas reais em toda parte
(capas de revista, salão da FIAT, carro de corrida com patrocínios) não são usadas.
Uso: python3 tools/ref/f40_photos.py <pasta com ph-*.png> <src/assets/photos>
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from testarossa_photos import logo  # noqa: E402  (mesmo escudo da Fúria)

# (cx, cy, meia largura, meia altura, lado do escudo); crop: (x0, y0, x1, y1) antes de reduzir
SETS = {
    'raiox': {'emb': [(1405, 318, 16, 22, 26), (1048, 262, 12, 12, 14)], 'txt': [(272, 676, 338, 702)], 'crop': None, 'out': 'f4-raiox'},
    'spectacular': {'emb': [(568, 395, 14, 20, 24), (1308, 497, 9, 7, 12)], 'txt': [], 'crop': None, 'out': 'f4-pista',
                    'fill': [(0, 92, 92)], 'inpaint': (684, 941)},  # título de cima: repete o céu; o de baixo: letras claras refeitas
}


def main():
    src, out = sys.argv[1], sys.argv[2]
    for k, c in SETS.items():
        a = np.array(Image.open(os.path.join(src, f'ph-{k}.png')).convert('RGB'))
        H, W = a.shape[:2]
        yy, xx = np.mgrid[0:H, 0:W]
        for cx, cy, hw, hh, sz in c['emb']:
            box = (((xx - cx) / (hw + 2)) ** 2 + ((yy - cy) / (hh + 2)) ** 2) <= 1
            ring = ((((xx - cx) / (hw + 7)) ** 2 + ((yy - cy) / (hh + 7)) ** 2) <= 1) & ~box
            a[box] = np.median(a[ring], axis=0).astype(np.uint8)
            lg = logo(sz)
            m = lg[..., 3] > 0
            a[cy - sz // 2:cy - sz // 2 + sz, cx - sz // 2:cx - sz // 2 + sz][m] = lg[..., :3][m]
        for x0, y0, x1, y1 in c['txt']:
            for y in range(y0, y1):
                row = a[y, x0:x1].astype(int)
                col = np.median(row, axis=0)
                row[np.abs(row - col).sum(axis=1) > 50] = col
                a[y, x0:x1] = row.astype(np.uint8)
        for y0, y1, ys in c.get('fill', []):
            band = a[ys:ys + 46].copy()
            for y in range(y0, y1):
                a[y] = band[(y - y0) % len(band)]
        if c.get('inpaint'):
            import cv2
            y0, y1 = c['inpaint']
            m = np.zeros(a.shape[:2], np.uint8)
            m[y0:y1] = (a[y0:y1].astype(int).mean(axis=2) > 150) | (a[y0:y1].astype(int).mean(axis=2) < 30)
            m = cv2.dilate(m, np.ones((9, 9), np.uint8))
            m[:y0] = 0
            a = cv2.inpaint(a, m, 9, cv2.INPAINT_TELEA)
        im = Image.fromarray(a)
        if c['crop']:
            im = im.crop(c['crop'])
        w, h = im.size
        th = int(round(w * 315 / 560))
        if th < h:
            im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
        im = im.resize((560, 315), Image.LANCZOS).quantize(160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        im.save(os.path.join(out, f"{c['out']}.png"), optimize=True)
        print(c['out'], im.size)


if __name__ == '__main__':
    main()
