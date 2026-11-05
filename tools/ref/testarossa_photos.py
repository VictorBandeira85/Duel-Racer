"""Fotos da revista da Furia TR (Testarossa, pixel art do Victor): o cavalinho e os escudos reais
viram o escudo da marca fictícia Fúria (src/assets/brands.json), os letreiros "testarossa" somem
e o "Ferrari" das tampas do motor vira "Fúria".
Depois reduz para 560 x 315 (o tamanho das fotos das capas e do carregamento).

Uso: python3 tools/ref/testarossa_photos.py <pasta com ph-*.png e cab.png> <src/assets/photos>
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
BR = json.load(open(os.path.join(ROOT, 'src/assets/brands.json'), encoding='utf-8'))

# emblemas: (cx, cy, meia largura, meia altura, lado do escudo[, opacidade (reflexos)])
EMB = {
  'collage': [(296, 132, 11, 12, 18), (852, 655, 17, 11, 20), (1236, 742, 13, 15, 22), (1532, 722, 10, 14, 18),
              (493, 497, 12, 13, 20), (170, 885, 10, 10, 0)],
  'miami': [(1270, 622, 15, 23, 26), (406, 657, 11, 15, 18), (812, 750, 15, 19, 26), (607, 590, 6, 6, 10)],
  'campo': [(681, 500, 19, 11, 22), (1243, 625, 7, 13, 12), (1503, 578, 6, 11, 10)],
  'trio': [(130, 412, 7, 6, 10), (116, 462, 7, 10, 12), (356, 460, 10, 13, 18), (391, 385, 5, 7, 8), (510, 330, 6, 7, 8),
           (500, 505, 13, 19, 24), (503, 463, 6, 6, 8), (852, 625, 17, 23, 30), (1352, 572, 15, 19, 26),
           (1381, 428, 9, 13, 16), (1585, 428, 6, 9, 10), (1344, 370, 5, 7, 8), (1567, 392, 7, 6, 10),
           (355, 580, 10, 13, 16, 0.45), (852, 833, 17, 23, 28, 0.45), (1352, 738, 15, 19, 24, 0.45)],
  'cab': [(672, 492, 40, 40, 52)],
}
TXT = {'miami': [(1352, 553, 1405, 573)], 'trio': [(555, 466, 603, 487)]}
# tampas do motor: polígono do baixo-relevo com o letreiro, ângulo e corpo do texto novo
MOTOR = [([(196, 445), (368, 404), (382, 450), (208, 490)], -13, 40, (288, 448)),
         ([(428, 693), (640, 640), (656, 690), (442, 738)], -14, 46, (542, 690))]
OUT = {'collage': 'tr-ensaio', 'miami': 'tr-miami', 'campo': 'tr-campo', 'trio': 'tr-trio', 'motor': 'tr-motor', 'cab': 'tr-cabine'}


def logo(size):
  pal = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in BR['palette'].items()}
  rows = BR['brands']['furia']['logo']
  a = np.zeros((9, 9, 4), np.uint8)
  for j, r in enumerate(rows):
    for i, ch in enumerate(r):
      if ch != '.':
        a[j, i] = (*pal[ch], 255)
  big = np.zeros((11, 11, 4), np.uint8)
  big[1:10, 1:10] = a
  solid = big[..., 3] > 0
  edge = np.zeros_like(solid)
  for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
    edge |= np.roll(np.roll(solid, dy, 0), dx, 1)
  edge &= ~solid
  big[edge] = (30, 18, 18, 255)
  return np.array(Image.fromarray(big, 'RGBA').resize((size, size), Image.NEAREST))


def main():
  src, out = sys.argv[1], sys.argv[2]
  for k, name in OUT.items():
    fn = 'cab.png' if k == 'cab' else f'ph-{k}.png'
    a = np.array(Image.open(os.path.join(src, fn)).convert('RGB'))
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    for e in EMB.get(k, []):
      cx, cy, hw, hh, sz = e[:5]
      op = e[5] if len(e) > 5 else 1.0
      box = (((xx - cx) / (hw + 2)) ** 2 + ((yy - cy) / (hh + 2)) ** 2) <= 1
      ring = ((((xx - cx) / (hw + 7)) ** 2 + ((yy - cy) / (hh + 7)) ** 2) <= 1) & ~box
      body = np.median(a[ring], axis=0)
      a[box] = (a[box] * (1 - op) + body * op).astype(np.uint8)
      if sz:
        lg = logo(sz)
        x0, y0 = cx - sz // 2, cy - sz // 2
        m = lg[..., 3] > 0
        reg = a[y0:y0 + sz, x0:x0 + sz]
        reg[m] = (reg[m] * (1 - op) + lg[..., :3][m] * op).astype(np.uint8)
    for x0, y0, x1, y1 in TXT.get(k, []):
      for y in range(y0, y1):
        row = a[y, x0:x1].astype(int)
        col = np.median(row, axis=0)
        dev = np.abs(row - col).sum(axis=1) > 50
        row[dev] = col
        a[y, x0:x1] = row.astype(np.uint8)
    im = Image.fromarray(a)
    if k == 'motor':
      for poly, ang, size, (tx, ty) in MOTOR:
        m = Image.new('L', im.size, 0)
        ImageDraw.Draw(m).polygon(poly, fill=255)
        mk = np.array(m) > 0
        inner = np.array(im).astype(int)[mk]
        lum = inner.mean(axis=1)
        base = np.median(inner[(lum > np.percentile(lum, 30)) & (lum < np.percentile(lum, 70))], axis=0)
        arr = np.array(im)
        arr[mk] = base.astype(np.uint8)
        im = Image.fromarray(arr)
        f = ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf', size)
        lay = Image.new('RGBA', (size * 5, size * 2), (0, 0, 0, 0))
        dl = ImageDraw.Draw(lay)
        dl.text((size * 2.5, size), 'Fúria', font=f, fill=(46, 48, 56, 255), anchor='mm', stroke_width=2, stroke_fill=(214, 218, 226, 255))
        lay = lay.rotate(-ang, resample=Image.BICUBIC, expand=False)
        im.alpha_composite(lay, (int(tx - lay.width / 2), int(ty - lay.height / 2))) if im.mode == 'RGBA' else None
        im = im.convert('RGBA'); im.alpha_composite(lay, (int(tx - lay.width / 2), int(ty - lay.height / 2))); im = im.convert('RGB')
    th = int(round(W * 315 / 560))
    if th < H:
      top = (H - th) // 2
      im = im.crop((0, top, W, top + th))
    im = im.resize((560, 315), Image.LANCZOS)
    im = im.quantize(160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    im.save(os.path.join(out, f'{name}.png'), optimize=True)
    print(name, im.size)


if __name__ == '__main__':
  main()
