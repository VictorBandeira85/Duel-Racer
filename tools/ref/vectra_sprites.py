"""Sprites do Vetor GSi (Vectra GSi) a partir da arte ampliada (versão vermelha): reamostra na
grade nativa (regrid.py), troca o branco das janelas (o fundo visto pelo vidro) por vidro
azulado, alisa o chuvisco da lataria e gera as máscaras de pintura pelo matiz vermelho, sem as
lanternas, a luz de freio central e os emblemas (vermelhos como a lataria).

Uso: python3 tools/ref/vectra_sprites.py <pasta com src-side/rear/front.png> <src/assets/cars>
"""
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from glass_fix import fix_glass  # noqa: E402
K4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)
PERIOD = {'side': 6.34, 'rear': 6.74, 'front': 5.50}


def flatten(a, m, thr=9):
    """Tira o chuvisco da lataria: onde o pixel quase não difere da mediana em volta, vira a
    mediana (superfície lisa); frisos, vincos e reflexos fortes (diferença grande) ficam."""
    rgb = a[..., :3]
    lum = rgb.astype(int).mean(axis=2)
    med = cv2.medianBlur(np.ascontiguousarray(rgb), 3)
    mlum = med.astype(int).mean(axis=2)
    sel = m & (np.abs(lum - mlum) < thr)
    rgb[sel] = med[sel]


def outline(a):
    al = a[..., 3] > 0
    edge = al & (cv2.erode(al.astype(np.uint8), K4) == 0)
    rgb = a[..., :3].astype(np.float32)
    sel = edge & (rgb.max(axis=2) > 60)
    rgb[sel] = rgb[sel] * 0.3 + np.array([14, 14, 16]) * 0.7
    a[..., :3] = rgb.astype(np.uint8)


def glass(a):
    """Branco das janelas (metade de cima) vira vidro azul-acinzentado, mais claro em cima."""
    H = a.shape[0]
    rgb = a[..., :3].astype(int)
    white = (a[..., 3] > 0) & (rgb.min(axis=2) > 200)
    white[int(H * 0.5):] = False
    n, lab, st, _ = cv2.connectedComponentsWithStats(white.astype(np.uint8), 8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 12:
            continue
        m = lab == i
        ys = np.nonzero(m)[0]
        y0, y1 = ys.min(), ys.max()
        for y in range(y0, y1 + 1):
            t = (y - y0) / max(1, y1 - y0)
            a[y, m[y], :3] = (np.array([180, 198, 214]) * (1 - t) + np.array([98, 116, 136]) * t).astype(np.uint8)
        xs = np.nonzero(m[y0])[0]
        for k in range(3):  # reflexo diagonal
            yy, xx = y0 + 1 + k, xs.min() + 3 + k * 2
            if yy < H and xx + 1 < a.shape[1] and m[yy, xx]:
                a[yy, xx:xx + 2, :3] = (216, 226, 234)


def red_mask(a, exclude=(), cut=()):
    hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(float)
    hue = hsv[..., 0] * 360 / 256
    m = ((hue >= 340) | (hue <= 14)) & (hsv[..., 1] > 110) & (hsv[..., 2] > 50) & (a[..., 3] > 0)
    # em cada retângulo, só sai o que fica dentro do contorno preto da peça (lanterna, luz de
    # freio, emblema): o claro que encosta na borda do retângulo é lataria e continua
    lum = a[..., :3].astype(int).mean(axis=2)
    for x0, y0, x1, y1 in exclude:
        sub = (lum[y0:y1, x0:x1] > 45) & (a[y0:y1, x0:x1, 3] > 0)
        n, lab = cv2.connectedComponents(sub.astype(np.uint8), connectivity=4)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
        inner = sub & ~np.isin(lab, list(border))
        inner = cv2.dilate(inner.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m[y0:y1, x0:x1] &= ~inner
    for x0, y0, x1, y1 in cut:  # peças com o retângulo exato (lanternas): sai tudo
        m[y0:y1, x0:x1] = False
    m &= cv2.erode((a[..., 3] > 0).astype(np.uint8), K4) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    keep = np.zeros(m.shape, bool)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 12:
            keep |= lab == i
    return keep


def main():
    src, cars = sys.argv[1], sys.argv[2]
    for view in ('side', 'rear', 'front'):
        out = os.path.join(cars, f'br-vectra-{view}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'src-{view}.png'), out, str(PERIOD[view])], check=True)
        a = np.array(Image.open(out).convert('RGBA'))
        H, W = a.shape[:2]
        if view != 'front':  # de frente o para-brisa já é azulado na arte
            glass(a)
        # fora da pintura: lanternas, luz de freio central, emblema GSi
        excl = {
            'rear': [(48, 16, 68, 24), (78, 28, 92, 34)],
            'side': [(W - 14, 20, W, 40), (58, 33, 70, 39)],
            'front': [],
        }[view]
        cut = [(5, 28, 23, 46), (94, 28, 108, 46)] if view == 'rear' else []
        m = red_mask(a, excl, cut)
        flatten(a, m)
        outline(a)
        fix_glass(a, m, view)  # branco que sobrou nos vidros vira vidro (vale para todo carro)
        Image.fromarray(a, 'RGBA').save(out)
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(out.replace('.png', '-mask.png'))
        print(view, W, H, 'máscara', int(m.sum()))


if __name__ == '__main__':
    main()
