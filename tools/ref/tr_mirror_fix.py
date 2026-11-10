"""Retrovisor esquerdo da Furia TR (depois de testarossa_cockpit.py): a carcaça vermelha tinha furos
transparentes na borda de cima e embaixo do vidro, junto da borda da arte (a estrada aparecia por
eles). Os furos que não são o vidro (o vidro é a área transparente ligada ao ponto (12, 96) do topo
+ painel empilhados) recebem a cor do pixel opaco mais próximo à direita na mesma linha.
Uso: python3 tools/ref/tr_mirror_fix.py <src/assets/cockpit>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image


def main():
    d = sys.argv[1]
    tp, dp = os.path.join(d, 'testarossa-top.png'), os.path.join(d, 'testarossa-dash.png')
    t, a = np.array(Image.open(tp).convert('RGBA')), np.array(Image.open(dp).convert('RGBA'))
    th = t.shape[0]
    st = np.concatenate([t, a], axis=0)
    tr = (st[..., 3] < 128).astype(np.uint8)
    # o vidro: só a faixa de linhas entre a moldura de cima e a de baixo (os furos da moldura
    # encostam nele e entrariam na mesma mancha)
    band = np.zeros_like(tr)
    band[75:115] = tr[75:115]
    n, lab = cv2.connectedComponents(band, connectivity=4)
    glass = lab == lab[96, 12]
    y0, y1, x1 = 71, 132, 36
    fixed = 0
    for y in range(y0, y1):
        for x in range(0, x1):
            if tr[y, x] and not glass[y, x]:
                xs = np.nonzero(st[y, x:x1 + 20, 3] >= 128)[0]
                if len(xs):
                    st[y, x] = st[y, x + xs[0]]
                    st[y, x, 3] = 255
                    fixed += 1
    # a linha solta acima da carcaça (restos da arte) sai
    st[66:71, :30, 3] = np.where(st[66:71, :30, 0] > st[66:71, :30, 2] + 40, 0, st[66:71, :30, 3])
    Image.fromarray(st[:th], 'RGBA').save(tp, optimize=True)
    Image.fromarray(st[th:], 'RGBA').save(dp, optimize=True)
    print('furos preenchidos', fixed)


if __name__ == '__main__':
    main()
