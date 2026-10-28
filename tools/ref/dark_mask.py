"""Máscara de pintura para carro escuro (preto, cinza-chumbo), onde não dá para separar a
carroceria pela cor: a lataria é o escuro pouco saturado, menos os vidros (e o que aparece
dentro deles), os pneus (em volta das rodas prateadas na lateral; a faixa de baixo na frente e
na traseira), lanternas e faróis (cores e claros) e o contorno da silhueta.
Uso: python3 tools/ref/dark_mask.py <png> side|front|rear
"""
import sys

import cv2
import numpy as np
from PIL import Image

fn, view = sys.argv[1], sys.argv[2]
a = np.array(Image.open(fn).convert('RGBA')).astype(int)
H, W = a.shape[:2]
rgb = a[..., :3]
al = a[..., 3] > 0
lum = rgb.mean(axis=2)
sat = rgb.max(axis=2) - rgb.min(axis=2)
body = al & (lum >= 8) & (lum <= 150) & (sat < 34)  # inclui o reflexo do capô
# vidros: azulados/claros; tudo dentro do contorno deles (bancos, colunas internas) fica de fora
glass = (al & (((rgb[..., 2] > rgb[..., 0] + 6) & (lum > 95)) | (lum > 170))).astype(np.uint8)
glass = cv2.morphologyEx(glass, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(glass, 8)
gm = np.zeros((H, W), np.uint8)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] < 25:
        continue
    pts = np.column_stack(np.nonzero(lab == i)[::-1]).astype(np.int32)
    cv2.fillPoly(gm, [cv2.convexHull(pts)], 1)
gm = cv2.dilate(gm, np.ones((3, 3), np.uint8))
body &= gm == 0
if view == 'side':
    # rodas prateadas: o pneu é o anel escuro em volta
    silver = (al & (lum > 140) & (sat < 30)).astype(np.uint8)
    silver[: int(H * 0.45)] = 0
    n, lab, st, cen = cv2.connectedComponentsWithStats(silver, 8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 60:
            continue
        r = max(st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]) / 2
        cv2.circle(body.view(np.uint8), (int(cen[i][0]), int(cen[i][1])), int(r * 1.5), 0, -1)
else:
    body[int(H * 0.86):] = False  # pneus e chão embaixo
if view == 'front':
    # grade (entre os faróis) e tomada de ar de baixo (entre os faróis de neblina): preto fosco
    bright = (al & (lum > 150)).astype(np.uint8)
    bright[: int(H * 0.35)] = 0
    n, lab, st, cen = cv2.connectedComponentsWithStats(bright, 8)
    blobs = [st[i] for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 6]
    rows = {}
    for b in blobs:
        rows.setdefault(round(b[cv2.CC_STAT_TOP] / 6), []).append(b)
    for grp in rows.values():
        left = [b for b in grp if b[0] + b[2] / 2 < W / 2]
        right = [b for b in grp if b[0] + b[2] / 2 >= W / 2]
        if left and right:
            x0 = max(b[0] + b[2] for b in left)
            x1 = min(b[0] for b in right)
            y0 = min(b[1] for b in grp) - 1
            y1 = max(b[1] + b[3] for b in grp) + 1
            body[y0:y1, x0:x1] = False
# contorno escuro da silhueta não é pintura
edge = al & (cv2.erode(al.astype(np.uint8), np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)) == 0)
body &= ~edge
m = cv2.morphologyEx(body.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(m, 4)
keep = np.zeros((H, W), bool)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] >= 40:
        keep |= lab == i
Image.fromarray((keep * 255).astype(np.uint8)).convert('1').save(fn.replace('.png', '-mask.png'))
print(fn, int(keep.sum()), 'px')
