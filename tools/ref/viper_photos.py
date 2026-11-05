"""Fotos da revista do Serpe V10 (Viper RT/10, pixel art do Victor): os emblemas reais (a cobra)
viram o logotipo da marca fictícia Serpe (src/assets/brands.json); os letreiros VIPER RT/10, a
placa "VIPER" e o adesivo do para-brisa somem.
Depois reduz para 560 x 315 (o tamanho das fotos das capas e do carregamento).

Uso: python3 tools/ref/viper_photos.py <pasta com ph-*.png> <src/assets/photos>
"""
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
BR = json.load(open(os.path.join(ROOT, 'src/assets/brands.json'), encoding='utf-8'))

# emblemas: (cx, cy, meia largura, meia altura, lado do logotipo)
EMB = {
  'duo': [(697, 785, 17, 17, 28), (1376, 343, 13, 12, 20)],
  'parked': [(1262, 628, 19, 19, 30)],
  'xray': [(253, 561, 22, 20, 34), (237, 658, 21, 16, 28)],
  'cabin': [(397, 537, 30, 30, 36)],
}
# letreiros: em cada linha do retângulo, o que foge da cor da linha vira essa cor
TXT = {
  'side': [(1018, 560, 1152, 592), (835, 388, 872, 442)],
  'parked': [(706, 580, 774, 626)],
}
OUT = {'duo': 'vp-dupla', 'gauges': 'vp-mostradores', 'parked': 'vp-arcoiris', 'xray': 'vp-raiox', 'cabin': 'vp-cabine', 'side': 'vp-estrada'}
BRAND = 'serpe'


def logo(size):
  pal = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in BR['palette'].items()}
  rows = BR['brands'][BRAND]['logo']
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
      for y in range(y0, y1):
        row = a[y, x0:x1].astype(int)
        col = np.median(row, axis=0)
        dev = np.abs(row - col).sum(axis=1) > 60
        row[dev] = col
        a[y, x0:x1] = row.astype(np.uint8)
    # placa "VIPER": as letras escuras dentro da placa viram o branco da placa
    if k == 'parked':
      x0, y0, x1, y1 = 1236, 678, 1328, 758
      reg = a[y0:y1, x0:x1].astype(int)
      lum = reg.mean(axis=2)
      white = np.median(reg[lum > 190], axis=0)
      inner = np.zeros(lum.shape, bool)
      for j in range(lum.shape[0]):
        w = np.nonzero(lum[j] > 190)[0]
        if len(w) > 4:
          inner[j, w.min():w.max() + 1] = True
      for i in range(lum.shape[1]):
        w = np.nonzero(lum[:, i] > 190)[0]
        col = np.zeros(lum.shape[0], bool)
        if len(w) > 4:
          col[w.min():w.max() + 1] = True
        inner[:, i] &= col
      reg[inner & (lum <= 190)] = white
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
