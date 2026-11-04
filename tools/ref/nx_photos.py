"""Fotos da revista do Kaze NX (pixel art do Victor): o emblema real (H) vira o logotipo da marca
fictícia Kaze (src/assets/brands.json) e o "NSX" das placas e da soleira some (placa lisa).
Depois reduz para 560 x 315 (o tamanho das fotos das capas e do carregamento).

Uso: python3 tools/ref/nx_photos.py <pasta com ph-*.png> <src/assets/photos>
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
BR = json.load(open(os.path.join(ROOT, 'src/assets/brands.json'), encoding='utf-8'))

# emblemas: (cx, cy, meia largura, meia altura do H, lado do logotipo)
EMB = {
  'senna': [(244, 524, 17, 22, 32)],
  'drift': [(128, 652, 9, 7, 13)],
  'wash': [(125, 770, 52, 27, 48)],
  'silver': [(307, 633, 29, 15, 28)],
  'xray': [(1521, 412, 16, 24, 26), (1078, 700, 11, 9, 16)],
  'serra': [(514, 550, 23, 15, 26)],
}
# letreiros "NSX": retângulo (x0, y0, x1, y1); o claro dentro dele vira o fundo escuro da placa
TXT = {
  'senna': [(176, 620, 238, 670)],
  'xray': [(496, 678, 570, 702), (1545, 485, 1605, 562)],
}
OUT = {'senna': 'nx-senna', 'drift': 'nx-drift', 'wash': 'nx-lavagem', 'silver': 'nx-prata', 'xray': 'nx-raiox', 'serra': 'nx-serra'}


def logo(size):
  pal = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in BR['palette'].items()}
  rows = BR['brands']['kaze']['logo']
  a = np.zeros((9, 9, 4), np.uint8)
  for j, r in enumerate(rows):
    for i, ch in enumerate(r):
      if ch != '.':
        a[j, i] = (*pal[ch], 255)
  # contorno escuro de 1 px da arte (para o emblema vermelho não sumir na lataria vermelha)
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
    a = np.array(Image.open(os.path.join(src, f'ph-{k}.png')).convert('RGB'))
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    for cx, cy, hw, hh, sz in EMB.get(k, []):
      box = (np.abs(xx - cx) <= hw + 2) & (np.abs(yy - cy) <= hh + 2)
      ring = (np.abs(xx - cx) <= hw + 8) & (np.abs(yy - cy) <= hh + 8) & ~box
      body = np.median(a[ring], axis=0)
      a[box] = body.astype(np.uint8)
      lg = logo(sz)
      x0, y0 = cx - sz // 2, cy - sz // 2
      m = lg[..., 3] > 0
      a[y0:y0 + sz, x0:x0 + sz][m] = lg[..., :3][m]
    for x0, y0, x1, y1 in TXT.get(k, []):
      reg = a[y0:y1, x0:x1].astype(int)
      lum = reg.mean(axis=2)
      dark = lum < 70
      fill = np.median(reg[dark], axis=0) if dark.any() else np.array([20, 20, 24])
      reg[lum >= 70] = fill
      a[y0:y1, x0:x1] = reg.astype(np.uint8)
    im = Image.fromarray(a)
    # 16:9 (560 x 315): corta o que sobra em cima e embaixo, centrado
    th = int(round(W * 315 / 560))
    if th < H:
      top = (H - th) // 2
      im = im.crop((0, top, W, top + th))
    im = im.resize((560, 315), Image.LANCZOS)
    # paleta de 160 cores (cara de pixel art e arquivo ~3x menor, como as fotos da LP5)
    im = im.quantize(160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    im.save(os.path.join(out, f'{name}.png'), optimize=True)
    print(name, im.size)


if __name__ == '__main__':
  main()
