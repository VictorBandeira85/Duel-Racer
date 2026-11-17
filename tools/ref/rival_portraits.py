"""Retratos dos rivais (arte do Victor, busto em fundo magenta, ~1254 px) -> src/assets/rivals/rival-<id>.png
Fundo magenta vira transparente (inclusive a franja rosada do contorno) e a imagem é reduzida
pegando o pixel do meio de cada bloco (sem misturar cores: pixel art nítida), para OUT px.
Uso: python3 tools/ref/rival_portraits.py <id> <arte.png> [<id> <arte.png> ...]
"""
import os
import sys

import numpy as np
from PIL import Image

OUT = 192
DST = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'rivals')

args = sys.argv[1:]
for i in range(0, len(args), 2):
    rid, src = args[i], args[i + 1]
    a = np.array(Image.open(src).convert('RGB')).astype(int)
    H, W = a.shape[:2]
    # amostra no meio de cada bloco da grade de saída (vizinho mais próximo, sem borrar)
    ys = ((np.arange(OUT) + 0.5) * H / OUT).astype(int)
    xs = ((np.arange(OUT) + 0.5) * W / OUT).astype(int)
    s = a[ys][:, xs]
    r, g, b = s[..., 0], s[..., 1], s[..., 2]
    # magenta e a franja rosada: vermelho e azul altos e parecidos, verde bem mais baixo
    key = (r > 150) & (b > 150) & (g < 0.6 * np.minimum(r, b)) & (np.abs(r - b) < 90)
    alpha = np.where(key, 0, 255)
    out = np.dstack([s, alpha]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(os.path.join(DST, f'rival-{rid}.png'), optimize=True)
    print(rid, int(key.mean() * 100), '% transparente')
