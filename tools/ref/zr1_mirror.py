"""Cabine do Vortex ZR: o retrovisor esquerdo da arte termina cortado na borda da imagem (sem a
moldura do lado de fora). Fecha o lado esquerdo: moldura vermelha de 2 px com o contorno escuro,
cantos arredondados, linha a linha da carcaça.

Uso: python3 tools/ref/zr1_mirror.py src/assets/cockpit
"""
import os
import sys

import numpy as np
from PIL import Image

RED, RED2, INK = (214, 22, 18, 255), (160, 14, 12, 255), (16, 14, 14, 255)


def main():
    d = sys.argv[1]
    tp, dp = os.path.join(d, 'zr1-top.png'), os.path.join(d, 'zr1-dash.png')
    t, dd = np.array(Image.open(tp).convert('RGBA')), np.array(Image.open(dp).convert('RGBA'))
    a = np.vstack([t, dd])
    rgb = a[..., :3].astype(int)
    # linhas da carcaça: o pixel mais à esquerda é vermelho (moldura) ou vidro claro
    rows = []
    for y in range(60, 125):
        xs = np.nonzero(a[y, :60, 3])[0]
        if not len(xs):
            continue
        x0 = xs[0]
        r, g, b = rgb[y, x0]
        if (r > 120 and g < 60) or min(r, g, b) > 150:
            rows.append((y, x0))
    if not rows:
        print('carcaça não encontrada'); return
    y0, y1 = rows[0][0], rows[-1][0]
    # todas as linhas entre a primeira e a última (algumas começam no contorno escuro)
    rows = [(y, np.nonzero(a[y, :60, 3])[0][0]) for y in range(y0, y1 + 1) if a[y, :60, 3].any()]
    for y, x0 in rows:
        edge = 1 if y in (y0, y1) else 0  # cantos arredondados
        k = x0 - 2 + edge
        a[y, k:x0] = RED if y - y0 < (y1 - y0) * 0.6 else RED2
        a[y, k - 1] = INK
    # contorno em cima e embaixo da parte nova
    a[y0 - 1, rows[0][1] - 2:rows[0][1]] = INK
    a[y1 + 1, rows[-1][1] - 2:rows[-1][1]] = INK
    Image.fromarray(a[:t.shape[0]], 'RGBA').save(tp)
    Image.fromarray(a[t.shape[0]:], 'RGBA').save(dp)
    print('retrovisor fechado: linhas', y0, '-', y1, 'coluna', rows[0][1])


if __name__ == '__main__':
    main()
