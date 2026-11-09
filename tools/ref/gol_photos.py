"""Fotos da revista do Gaúcho GTI (Gol GTI 1993, pixel art do Victor): os emblemas reais viram o logo da
Ipê (src/assets/brands.json), a placa "Gol GTI" vira uma placa de época e a marca da bateria some.
Reduz para 560 x 315.
Uso: python3 tools/ref/gol_photos.py <pasta com ph-*.png> <src/assets/photos>
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402

# (cx, cy, meia largura, meia altura, lado do logo)
EMB = {'preto': [(1306, 519, 24, 22, 40)], 'amarelo': [(262, 485, 16, 16, 28)], 'giro': [(830, 683, 26, 24, 44)],
       'motor': [(555, 688, 46, 40, 64), (1455, 745, 44, 50, 0)]}
FILL = {'motor': [(458, 300, 742, 352)], 'preto': [(1244, 612, 1384, 658)]}
PLATE = {'preto': ('GTI-1993', (1314, 636), 30)}
OUT = {'preto': 'gol-preto', 'amarelo': 'gol-amarelo', 'giro': 'gol-giro', 'motor': 'gol-motor'}


def main():
    src, out = sys.argv[1], sys.argv[2]
    for k, name in OUT.items():
        a = np.array(Image.open(os.path.join(src, f'ph-{k}.png')).convert('RGB'))
        H, W = a.shape[:2]
        yy, xx = np.mgrid[0:H, 0:W]
        for x0, y0, x1, y1 in FILL.get(k, []):
            reg = a[y0:y1, x0:x1].reshape(-1, 3).astype(int)
            lum = reg.mean(axis=1)
            a[y0:y1, x0:x1] = np.median(reg[lum > np.percentile(lum, 50)], axis=0).astype(np.uint8)
        for cx, cy, hw, hh, sz in EMB.get(k, []):
            box = (((xx - cx) / (hw + 2)) ** 2 + ((yy - cy) / (hh + 2)) ** 2) <= 1
            ring = ((((xx - cx) / (hw + 6)) ** 2 + ((yy - cy) / (hh + 6)) ** 2) <= 1) & ~box
            a[box] = np.median(a[ring], axis=0).astype(np.uint8)
            if sz:
                lg = logo_img('ipe', sz)
                m = lg[..., 3] > 0
                a[cy - sz // 2:cy - sz // 2 + sz, cx - sz // 2:cx - sz // 2 + sz][m] = lg[..., :3][m]
        im = Image.fromarray(a)
        if k in PLATE:
            t, (tx, ty), size = PLATE[k]
            ImageDraw.Draw(im).text((tx, ty), t, font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', size), fill=(30, 30, 34), anchor='mm')
        th = int(round(W * 315 / 560))
        if th < H:
            im = im.crop((0, (H - th) // 2, W, (H - th) // 2 + th))
        im = im.resize((560, 315), Image.LANCZOS).quantize(160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        im.save(os.path.join(out, f'{name}.png'), optimize=True)
        if os.environ.get('DBG'):
            Image.fromarray(np.array(Image.fromarray(a))).save(os.path.join(os.environ['DBG'], f'full-{k}.png'))
        print(name)


if __name__ == '__main__':
    main()
