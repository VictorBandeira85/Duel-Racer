"""Sprites do Vetor GSi (Vectra GSi) a partir da arte ampliada: reamostra na grade nativa
(regrid.py), troca o branco dos vidros por vidro azulado, fecha a silhueta com contorno escuro
e gera as máscaras de pintura. Os frisos e vincos das portas (os escuros dentro da lataria)
entram na máscara: com a repintura proporcional (svgsprites.ts) eles continuam escuros em
qualquer cor, como na pintura preta original.

Uso: python3 tools/ref/vectra_sprites.py <pasta com src-side/rear/front.png> <src/assets/cars>
     e depois python3 tools/ref/vectra_paint_fix.py <src/assets/cars> (pintura coerente)
"""
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
K4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)


def glass(a, view):
    """Branco de dentro (vidro sem nada atrás) vira vidro: azul-acinzentado, mais claro em cima."""
    rgb = a[..., :3].astype(int)
    al = a[..., 3] > 0
    white = al & (rgb.min(axis=2) > 195)
    if view != 'side':  # de frente e de trás o vidro é azulado claro, sempre na metade de cima
        white = al & (rgb.min(axis=2) > 140) & (rgb[..., 2] >= rgb[..., 0] - 4)
        white[int(a.shape[0] * 0.5):] = False
    n, lab, st, _ = cv2.connectedComponentsWithStats(white.astype(np.uint8), 8)
    out = np.zeros(white.shape, bool)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 12:
            continue
        m = lab == i
        out |= m
        ys = np.nonzero(m)[0]
        y0, y1 = ys.min(), ys.max()
        for y in range(y0, y1 + 1):
            t = (y - y0) / max(1, y1 - y0)
            col = np.array([176, 192, 206]) * (1 - t) + np.array([96, 112, 130]) * t
            row = m[y]
            a[y, row, :3] = col.astype(np.uint8)
        # reflexo: diagonal clara no canto de cima
        xs = np.nonzero(m[y0])[0]
        if len(xs) and view == 'side':
            for k in range(3):
                yy, xx = y0 + 1 + k, xs.min() + 3 + k * 2
                if 0 <= yy < m.shape[0] and xx + 1 < m.shape[1] and m[yy, xx]:
                    a[yy, xx:xx + 2, :3] = (214, 224, 232)
    return out


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


def mask(a, view, glass_px):
    H, W = a.shape[:2]
    rgb = a[..., :3].astype(int)
    al = a[..., 3] > 0
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    body = al & (lum <= 120) & (sat < 30)
    # vidros e o que aparece através deles (bancos, colunas internas): fecho convexo de cada vidro
    gm = np.zeros((H, W), np.uint8)
    see = (al & glass_px).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(see, 8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 8:
            continue
        pts = np.column_stack(np.nonzero(lab == i)[::-1]).astype(np.int32)
        cv2.fillPoly(gm, [cv2.convexHull(pts)], 1)
    body &= cv2.dilate(gm, K4) == 0
    if view == 'side':
        silver = (al & (lum > 120) & (sat < 30)).astype(np.uint8)
        silver[: int(H * 0.5)] = 0
        n, lab, st, cen = cv2.connectedComponentsWithStats(silver, 8)
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] < 30:
                continue
            r = max(st[i, cv2.CC_STAT_WIDTH], st[i, cv2.CC_STAT_HEIGHT]) / 2
            cv2.circle(body.view(np.uint8), (int(round(cen[i][0])), int(round(cen[i][1]))), int(round(r * 1.42)), 0, -1)
    else:
        body[int(H * 0.86):] = False
    if view == 'front':
        # grade e tomada de ar: preto fosco entre os faróis
        bright = (al & (lum > 140)).astype(np.uint8)
        bright[: int(H * 0.35)] = 0
        n, lab, st, _ = cv2.connectedComponentsWithStats(bright, 8)
        blobs = [st[i] for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 3]
        rows = {}
        for b in blobs:
            rows.setdefault(round(b[cv2.CC_STAT_TOP] / 4), []).append(b)
        for grp in rows.values():
            left = [b for b in grp if b[0] + b[2] / 2 < W / 2]
            right = [b for b in grp if b[0] + b[2] / 2 >= W / 2]
            if left and right:
                x0 = max(b[0] + b[2] for b in left)
                x1 = min(b[0] for b in right)
                body[min(b[1] for b in grp) - 1:max(b[1] + b[3] for b in grp) + 1, x0:x1] = False
    # contorno da silhueta não é pintura; pedacinhos soltos também não
    body &= cv2.erode(al.astype(np.uint8), K4) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(body.astype(np.uint8), 4)
    keep = np.zeros((H, W), bool)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 20:
            keep |= lab == i
    return keep


def main():
    src, cars = sys.argv[1], sys.argv[2]
    for view in ('side', 'rear', 'front'):
        out = os.path.join(cars, f'br-vectra-{view}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'src-{view}.png'), out], check=True)
        a = np.array(Image.open(out).convert('RGBA'))
        g = glass(a, view)
        outline(a)
        m = mask(a, view, g)
        # de frente o capô tem os reflexos riscados da arte: alisa mais
        for _ in range(3 if view == 'front' else 2):
            flatten(a, m, 18 if view == 'front' else 9)
        Image.fromarray(a, 'RGBA').save(out)
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(out.replace('.png', '-mask.png'))
        print(view, a.shape[1], a.shape[0], 'máscara', int(m.sum()))


if __name__ == '__main__':
    main()
