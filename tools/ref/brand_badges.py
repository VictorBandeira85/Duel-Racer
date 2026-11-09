"""Grava o emblema da marca fictícia (src/assets/brands.json) nos sprites de frente e de trás
de cada carro, no lugar onde fica o emblema no carro de verdade, e nos cubos dos volantes.

Uso: python3 tools/ref/brand_badges.py [--preview pasta]
Roda sobre a arte limpa (sem emblemas ainda); com --preview só grava recortes ampliados
(antes/depois) na pasta indicada, sem mexer nos arquivos do jogo.

Cada ponto: (cx, cy, tamanho, limpar) — centro do emblema em pixels da arte, lado em pixels
e o raio da área repintada com a cor da carroceria em volta (apaga o emblema antigo), ou 0.
A máscara de pintura recebe preto embaixo do emblema, para a troca de cor não tingir a logo.
"""
import json, sys, os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
DATA = json.load(open(os.path.join(ROOT, 'src/assets/brands.json'), encoding='utf-8'))
CARS = os.path.join(ROOT, 'src/assets/cars')
COCK = os.path.join(ROOT, 'src/assets/cockpit')

# arte -> marca (a arte de cada carro; patrolsv é o Diablo da polícia)
ART_BRAND = {
  'f40': 'furia', 'testarossa': 'furia', 'diablo': 'toro', 'countach': 'toro', 'patrolsv': 'toro',
  '959': 'silber', 'zr1': 'vanguarda', 'patrol': 'vanguarda', 'nsx': 'kaze', 'viper': 'serpe',
  'br-vectra': 'vanguarda', 'br-kadett': 'vanguarda', 'br-corsa': 'vanguarda', 'br-uno': 'fiore',
  'br-golgti': 'ipe', 'br-passat': 'ipe', 'br-pumagtb': 'onca', 'br-pumagte': 'onca',
}

SPOTS = {
  'f40':        {'rear': (100, 51, 9, 6),  'front': (100, 71, 7, 4), 'side': [(100, 42, 7, 5)]},
  'testarossa': {'rear': (136, 78, 11, 8), 'front': (91, 59, 7, 4), 'side': [(81.5, 68.5, 5, 6.6), (283.5, 68.5, 5, 6.6)]},
  'diablo':     {'rear': (139, 46, 9, 0),  'front': (99.5, 59.5, 9, 6), 'side': [(52, 53, 5, 4), (229, 53, 5, 4.5)]},
  'patrolsv':   {'rear': (100, 46, 9, 0),  'front': (100, 76, 9, 0)},
  'countach':   {'rear': (112, 70, 9, 0),  'front': (92, 69, 9, 5)},
  '959':        {'rear': (100, 70, 9, 0),  'front': (100, 64, 9, 0)},
  'zr1':        {'rear': (100, 46, 9, 0),  'front': (100, 52, 9, 0)},
  'nsx':        {'rear': (100, 56, 7, 5),  'front': (100, 65, 7, 5), 'side': [(62, 59, 5, 3.5), (232, 59, 5, 3.5)]},
  'viper':      {'rear': (118, 55, 7, 0),  'front': (90, 74, 7, 0)},
  'patrol':     {'rear': (100, 76, 9, 0),  'front': (100, 87, 9, 0)},
  'br-vectra':  {'rear': (56, 26, 6, 3),   'front': (80, 62, 7, 0)},
  'br-uno':     {'rear': (60, 80, 7, 0),   'front': (120, 107, 11, 7)},
  'br-golgti':  {'rear': (66, 30, 7, 0),   'front': (89, 67, 11, 7)},
  'br-kadett':  {'rear': (46, 26, 5, 0),   'front': (64, 48, 6, 0)},
  'br-corsa':   {'rear': (115, 88, 9, 6),  'front': (96, 88, 9, 6)},
  'br-pumagtb': {'rear': (47, 18, 5, 3),   'front': (47, 26, 5, 0)},
  'br-passat':  {'rear': (85, 50, 7, 3),   'front': (83, 64, 11, 7)},
  'br-pumagte': {'rear': (49, 30, 5, 0),   'front': (82, 72, 7, 0)},
}

# cubos dos volantes (src/assets/cockpit/<arte>-wheel.png): no lugar da buzina/emblema
WHEELS = {
  'f40': (128, 117, 15, 0), '959': (128.5, 97, 13, 10), 'patrol': (129, 121, 11, 0),
  'diablo': (128.7, 131, 15, 0), 'br-vectra': (129, 108, 13, 0), 'br-golgti': (128, 148, 13, 0),
  'br-kadett': (128, 104, 11, 0), 'br-uno': (128, 106, 11, 7), 'br-corsa': (127, 112, 13, 8),
  'br-passat': (129, 112, 13, 8), 'br-pumagtb': (128.5, 127, 13, 9), 'br-pumagte': (128.5, 116, 13, 10),
  'zr1': (128, 90, 13, 0), 'testarossa': (128, 117, 15, 0), 'nsx': (129.1, 115.9, 21, 0),
  'viper': (131, 125, 17, 0), 'countach': (127.5, 117, 13, 11),
}
ZR1_CLEAR = (128, 90, 15, 13)  # elipse do emblema largo do C4
ELL = {'zr1': ZR1_CLEAR, 'testarossa': (128, 117, 13.6, 15.8), 'f40': (128, 117, 13.6, 15.8), 'diablo': (128.7, 132, 14.5, 17)}  # emblemas apagados por uma elipse


def hexrgb(h):
  h = h.lstrip('#')
  return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def logo_img(bid, size):
  pal = {k: hexrgb(v) for k, v in DATA['palette'].items()}
  rows = DATA['brands'][bid]['logo']
  a = np.zeros((len(rows), len(rows[0]), 4), np.uint8)
  for j, row in enumerate(rows):
    for i, ch in enumerate(row):
      if ch != '.':
        a[j, i] = (*pal[ch], 255)
  im = Image.fromarray(a, 'RGBA')
  if size == im.width:
    return np.array(im)
  if size > im.width:
    return np.array(im.resize((size, size), Image.NEAREST))
  # redução: média por área (com alfa pré-multiplicado) e alfa binário, para ficar em pixel
  big = im.resize((im.width * size, im.height * size), Image.NEAREST)
  out = np.array(big.resize((size, size), Image.BOX)).astype(np.int32)
  out[..., 3] = np.where(out[..., 3] >= 110, 255, 0)
  return out.astype(np.uint8)


def ring_color(a, cx, cy, r):
  h, w = a.shape[:2]
  yy, xx = np.mgrid[0:h, 0:w]
  d = np.hypot(xx - cx, yy - cy)
  sel = (d >= r + 0.5) & (d < r + 2.5) & (a[..., 3] > 0)
  return np.median(a[sel][:, :3], axis=0).astype(np.uint8)


def stamp(a, mask, bid, spot, ell=None):
  cx, cy, size, clear = spot
  if ell:
    ex, ey, rx, ry = ell
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    e = ((xx - ex) / rx) ** 2 + ((yy - ey) / ry) ** 2
    ringsel = (e > 1.15) & (e < 1.6) & (a[..., 3] > 0)
    col = np.median(a[ringsel][:, :3], axis=0).astype(np.uint8)
    a[(e <= 1) & (a[..., 3] > 0), :3] = col
  if clear:
    col = ring_color(a, cx, cy, clear)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    sel = (np.hypot(xx - cx, yy - cy) <= clear) & (a[..., 3] > 0)
    a[sel, :3] = col
  lg = logo_img(bid, size)
  x0, y0 = int(round(cx - size / 2)), int(round(cy - size / 2))
  for j in range(size):
    for i in range(size):
      if lg[j, i, 3]:
        a[y0 + j, x0 + i] = lg[j, i]
        if mask is not None:
          mask[y0 + j, x0 + i] = 0


def load_mask(path):
  if not os.path.exists(path):
    return None, None
  im = Image.open(path)
  return np.array(im.convert('L')), im.mode


def save_mask(path, m, mode):
  im = Image.fromarray(m, 'L')
  if mode == '1':
    im = im.point(lambda v: 255 if v >= 128 else 0).convert('1')
  elif mode in ('RGBA', 'RGB', 'LA'):
    im = im.convert(mode)
  im.save(path, optimize=True)


def zoom(a, cx, cy, k=6, R=18):
  h, w = a.shape[:2]
  x0, y0, x1, y1 = max(0, cx - R), max(0, cy - R), min(w, cx + R), min(h, cy + R)
  c = Image.fromarray(a[y0:y1, x0:x1], 'RGBA')
  bg = Image.new('RGBA', c.size, (90, 140, 90, 255))
  bg.alpha_composite(c)
  return bg.resize((c.width * k, c.height * k), Image.NEAREST)


def main():
  prev = None
  only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else None
  if only:
    for k in list(SPOTS):
      if k not in only:
        del SPOTS[k]
    for k in list(WHEELS):
      if k not in only:
        del WHEELS[k]
  if '--preview' in sys.argv:
    prev = sys.argv[sys.argv.index('--preview') + 1]
    os.makedirs(prev, exist_ok=True)
  tiles = []
  for art, views in SPOTS.items():
    bid = ART_BRAND[art]
    for view, spot in views.items():
      p = os.path.join(CARS, f'{art}-{view}.png')
      if not os.path.exists(p):
        continue
      a = np.array(Image.open(p).convert('RGBA'))
      before = a.copy()
      mp = os.path.join(CARS, f'{art}-{view}-mask.png')
      m, mode = load_mask(mp)
      for sp in (spot if isinstance(spot, list) else [spot]):
        stamp(a, m, bid, sp)
      if prev:
        k = 2 if a.shape[1] > 150 else 4
        c = Image.fromarray(a, 'RGBA')
        t = Image.new('RGBA', c.size, (90, 140, 90, 255)); t.alpha_composite(c)
        tiles.append((f'{art}-{view}', t.resize((c.width * k, c.height * k), Image.NEAREST)))
      else:
        Image.fromarray(a, 'RGBA').save(p, optimize=True)
        if m is not None:
          save_mask(mp, m, mode)
  for art, spot in WHEELS.items():
    p = os.path.join(COCK, f'{art}-wheel.png')
    a = np.array(Image.open(p).convert('RGBA'))
    stamp(a, None, ART_BRAND[art], spot, ELL.get(art))
    if prev:
      cx, cy = int(spot[0]), int(spot[1])
      c = Image.fromarray(a[cy - 24:cy + 24, cx - 32:cx + 32], 'RGBA')
      t = Image.new('RGBA', c.size, (90, 140, 90, 255)); t.alpha_composite(c)
      tiles.append((f'{art}-wheel', t.resize((c.width * 4, c.height * 4), Image.NEAREST)))
    else:
      Image.fromarray(a, 'RGBA').save(p, optimize=True)
  if prev:
    from PIL import ImageDraw
    cols = 3
    tw = max(t.width for _, t in tiles); th = max(t.height for _, t in tiles) + 12
    for page in range(0, len(tiles), 12):
      chunk = tiles[page:page + 12]
      rows = (len(chunk) + cols - 1) // cols
      sheet = Image.new('RGBA', (tw * cols, th * rows), (30, 30, 30, 255))
      d = ImageDraw.Draw(sheet)
      for k, (name, t) in enumerate(chunk):
        x, y = (k % cols) * tw, (k // cols) * th
        sheet.paste(t, (x, y + 12)); d.text((x + 2, y), name, fill=(255, 255, 0, 255))
      sheet.save(os.path.join(prev, f'badges{page // 12}.png'))


if __name__ == '__main__':
  main()
