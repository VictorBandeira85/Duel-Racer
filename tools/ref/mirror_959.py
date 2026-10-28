"""Retrovisor esquerdo do 959 completo, a partir do pedaço desenhado no canto da arte.

No desenho do interior o retrovisor aparece cortado pela borda esquerda (só a metade da
direita: vidro branco, moldura arredondada). Aqui a metade que falta é o espelho da que existe,
o fundo vira transparente e o resultado é reduzido na escala da cabine (0,36). O jogo desenha
esse sprite por cima da arte, com a borda direita no mesmo lugar do original, e usa o vidro
como retrovisor funcionando.
Uso: python3 tools/ref/mirror_959.py <interior do 959> src/assets/cockpit/959-mirror.png
"""
import sys

import cv2
import numpy as np
from PIL import Image

src = cv2.cvtColor(cv2.imread(sys.argv[1]), cv2.COLOR_BGR2RGB)
half = src[147:253, 0:57]  # metade direita do retrovisor (moldura e vidro)
full = np.concatenate([half[:, :0:-1], half], axis=1)  # a esquerda é o espelho da direita
h, w = full.shape[:2]
# contorno: retângulo de cantos bem arredondados (a moldura do desenho); fora dele, transparente
alpha = np.zeros((h, w), np.uint8)
cv2.rectangle(alpha, (0, 0), (w - 1, h - 1), 1, -1)
r = 26
cut = np.ones((h, w), np.uint8)
for cx, cy in ((r, r), (w - 1 - r, r), (r, h - 1 - r), (w - 1 - r, h - 1 - r)):
    yy, xx = np.mgrid[0:h, 0:w]
    corner = ((xx < r) if cx == r else (xx > w - 1 - r)) & ((yy < r) if cy == r else (yy > h - 1 - r))
    cut[corner & (((xx - cx) ** 2 + (yy - cy) ** 2) > r * r)] = 0
alpha = (alpha & cut).astype(np.float32)
nw, nh = round(w * 0.3), round(h * 0.3)  # um pouco menor que a cabine (0,36): cabe inteiro antes do triângulo da porta
rgb = cv2.resize(full.astype(np.float32), (nw, nh), interpolation=cv2.INTER_AREA)
a = cv2.resize(alpha, (nw, nh), interpolation=cv2.INTER_AREA) >= 0.5
# franja: o branco do fundo que sobrou nos cantos (claro encostado no transparente) sai
for _ in range(4):
    out = ~a
    near = cv2.dilate(out.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    a &= ~(near & (rgb.min(axis=2) > 170))
# vidro levemente azulado (o jogo reconhece o vidro pela cor clara e azulada)
glass = a & (rgb.min(axis=2) > 200)
rgb[glass] = rgb[glass] * np.array([0.9, 0.95, 1.0])
Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), (a * 255).astype(np.uint8)]), 'RGBA').save(sys.argv[2])
print(sys.argv[2], nw, nh, 'vidro', int(glass.sum()))
