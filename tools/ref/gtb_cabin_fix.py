"""Onça GTB: refaz o painel atrás do volante a partir da arte importada.

1. faixa do aro antigo (gtb_rim_fix.py) com margem maior (pegava ainda uma lista clara à
   esquerda) e média mais larga (sem riscos radiais)
2. embaixo do quadro, atrás do miolo, a importação deixou um borrão cinza e marrom (aparece
   pelos vãos do volante): vira o painel liso (cada linha passa da cor da esquerda para a da
   direita) com a capa escura da coluna de direção no meio

Uso: gtb_cabin_fix.py <dash importado.png> <saída br-pumagtb-dash.png>
"""
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(__file__)
shutil.copy(src, out)
subprocess.run([sys.executable, os.path.join(HERE, 'gtb_rim_fix.py'), out, '228.96', '128.3', '107.6', '127.3', '0.898', '0.13', 'nao', '12'], check=True)
a = np.array(Image.open(out).convert('RGBA')).astype(np.float32)
H = a.shape[0]
X0, X1, Y0 = 187, 273, 93
for y in range(Y0, H):
    l, r = a[y, X0 - 1, :3], a[y, X1, :3]
    for x in range(X0, X1):
        t = (x - X0 + 1) / (X1 - X0 + 1)
        a[y, x, :3] = l * (1 - t) + r * t
    a[y, X0:X1, 3] = 255
cx = 229
for y in range(Y0 + 4, H):
    half = 22 + (y - Y0 - 4) * 0.3
    x0, x1 = int(round(cx - half)), int(round(cx + half))
    a[y, x0:x1, :3] = (22, 22, 24)
    a[y, x0, :3] = (50, 50, 54)
    a[y, x1 - 1, :3] = (12, 12, 13)
a[Y0 + 4, int(cx - 22):int(cx + 22), :3] = (60, 60, 64)
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out)
print('painel atrás do volante refeito')
