"""Retrovisor esquerdo do 959 em pixel art, no formato do original (foto de referência):
cabeça em gota — ponta estreita e arredondada à esquerda, borda de cima subindo para a direita,
lado direito alto e cheio —, moldura metálica fina com brilho em cima, vidro claro (o jogo
desenha nele a vista para trás) e a haste de metal descendo até a base na porta.

No desenho do interior o retrovisor aparece cortado pela borda; o jogo desenha este sprite no lugar.
Uso: python3 tools/ref/mirror_959.py src/assets/cockpit/959-mirror.png
"""
import sys

import cv2
import numpy as np
from PIL import Image

W, H = 37, 35
S = 4  # desenha em 4x e reduz (contornos mais limpos), depois limpa as cores

def pts(p):
    return (np.array(p, np.float32) * S).astype(np.int32)

# contorno da cabeça (em gota)
head = [(3, 14), (4, 10), (7, 6.5), (12, 4.5), (20, 2.5), (27, 1.2), (31.5, 1.5), (34.5, 4), (35.6, 9), (35.4, 14.5),
        (33.5, 18.6), (29.5, 21), (21, 22.2), (12, 22.2), (6.5, 20.4), (3.6, 17.4)]
# haste: sai de baixo da cabeça, à direita, e desce até a porta
arm = [(23, 20.5), (28, 20.5), (33.5, 30.5), (29.5, 31.5)]
base = [(27.5, 30), (36, 30), (36, 34), (27.5, 34)]

def mask(poly):
    m = np.zeros((H * S, W * S), np.uint8)
    cv2.fillPoly(m, [pts(poly)], 1)
    return m[S // 2::S, S // 2::S]  # forma na resolução da tela (centro de cada bloco)

small = np.zeros((H, W, 4), np.uint8)
cross = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)
headm = mask(head)
l1 = cv2.erode(headm, cross)        # tira o contorno (1 px)
l2 = cv2.erode(l1, cross)           # moldura de metal (1 px)
l3 = cv2.erode(l2, np.ones((2, 1), np.uint8))  # fresta escura embaixo/em cima
small[mask(base) > 0] = (20, 20, 24, 255)
armm = mask(arm) > 0
small[armm] = (70, 74, 80, 255)
yy = np.arange(H)[:, None] * np.ones((1, W))
small[headm > 0] = (14, 14, 18, 255)            # contorno
rim = (l1 > 0) & (l2 == 0)
small[rim] = (128, 134, 142, 255)
small[rim & (yy < 9)] = (200, 204, 212, 255)    # metal brilhando em cima
small[rim & (yy > 17)] = (88, 92, 100, 255)     # e mais escuro embaixo
small[(l2 > 0) & (l3 == 0)] = (34, 34, 40, 255)
gm = l3 > 0
g = np.clip(228 - yy * 2.4, 160, 230)
small[gm] = np.stack([g - 12, g - 2, np.minimum(255, g + 14), np.full_like(g, 255)], -1)[gm].astype(np.uint8)
# reflexo na haste
for y in range(H):
    xs = np.nonzero(armm[y] & (headm[y] == 0))[0]
    if len(xs):
        small[y, xs[0]] = (150, 154, 162, 255)
Image.fromarray(small, 'RGBA').save(sys.argv[1])
print(sys.argv[1], W, H, 'vidro', int(((small[..., 2] > 180) & (small[..., 3] > 0)).sum()))
