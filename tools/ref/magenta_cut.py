"""Objeto em fundo magenta (arte do Victor) -> PNG transparente recortado no objeto, reduzido pegando o
pixel do meio de cada bloco (pixel art nítida, sem misturar cores) até `alto` px de altura.
Uso: python3 tools/ref/magenta_cut.py <arte.png> <saida.png> <alto>
"""
import sys

import numpy as np
from PIL import Image

src, dst, out_h = sys.argv[1], sys.argv[2], int(sys.argv[3])
a = np.array(Image.open(src).convert('RGB')).astype(int)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
key = (r > 150) & (b > 150) & (g < 0.6 * np.minimum(r, b)) & (np.abs(r - b) < 90)
ys, xs = np.where(~key)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
a, key = a[y0:y1, x0:x1], key[y0:y1, x0:x1]
H, W = a.shape[:2]
k = min(1.0, out_h / H)
oh, ow = max(1, round(H * k)), max(1, round(W * k))
yy = ((np.arange(oh) + 0.5) * H / oh).astype(int)
xx = ((np.arange(ow) + 0.5) * W / ow).astype(int)
s, m = a[yy][:, xx], key[yy][:, xx]
out = np.dstack([s, np.where(m, 0, 255)]).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(dst, optimize=True)
print(dst, ow, 'x', oh)
