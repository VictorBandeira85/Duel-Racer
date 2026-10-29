"""Sprites do Onça GTB (Puma GTB S2) a partir da arte ampliada: reamostra na grade nativa
(regrid.py), troca o branco das janelas laterais (o fundo aparecendo pelo vidro) por vidro,
alisa o chuvisco da lataria e gera a máscara de pintura só da lataria prata: fora dela ficam
vidros, para-choques e frisos pretos, a faixa GTB, faróis, lanternas, refletores, cromados,
retrovisores e rodas (o que é claro mas não é lataria: ilhas pequenas, longe do corpo).

Uso: python3 tools/ref/onca_sprites.py <pasta com src-side/rear/front.png> <src/assets/cars>
"""
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from vectra_sprites import flatten, outline  # noqa: E402

PERIOD = {'side': 10.05, 'rear': 9.51, 'front': 9.51}
K8 = np.ones((3, 3), np.uint8)


def side_glass(a):
    """Janelas laterais: branco cercado pela moldura preta vira vidro azul-acinzentado."""
    H = a.shape[0]
    rgb = a[..., :3].astype(int)
    white = (a[..., 3] > 0) & (rgb.min(axis=2) > 225)
    white[int(H * 0.5):] = False
    n, lab, st, _ = cv2.connectedComponentsWithStats(white.astype(np.uint8), 8)
    out = np.zeros(white.shape, bool)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 8:
            continue
        m = lab == i
        out |= m
        ys = np.nonzero(m)[0]
        y0, y1 = ys.min(), ys.max()
        for y in range(y0, y1 + 1):
            t = (y - y0) / max(1, y1 - y0)
            a[y, m[y], :3] = (np.array([172, 190, 206]) * (1 - t) + np.array([92, 110, 130]) * t).astype(np.uint8)
        xs = np.nonzero(m[y0])[0]
        for k in range(2):  # reflexo
            yy, xx = y0 + 1 + k, xs.min() + 2 + k * 2
            if yy < H and xx + 1 < a.shape[1] and m[yy, xx]:
                a[yy, xx:xx + 2, :3] = (214, 224, 232)
    return out


def body_mask(a, view, glass):
    H, W = a.shape[:2]
    op = a[..., 3] > 0
    rgb = a[..., :3].astype(int)
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    body = op & (sat < 26) & (lum > (72 if view == 'side' else 110)) & ~glass
    # vidro de frente/traseira (cinza-azulado escuro) fica fora
    body &= ~((rgb[..., 2] - rgb[..., 0] >= 6) & (lum < 170))
    # lanternas, piscas, faixa dourada: coloridos e 1 px em volta (refletores brancos colados)
    lamp = op & (sat > 50)
    body &= ~(cv2.dilate(lamp.astype(np.uint8), np.ones((3, 5), np.uint8)) > 0)
    if view == 'side':
        # rodas (aro prata): círculo em volta de cada pneu escuro na metade de baixo
        dark = (op & (lum < 60)).astype(np.uint8)
        dark[: int(H * 0.45)] = 0
        n, lab, st, cen = cv2.connectedComponentsWithStats(dark, 8)
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] < 40 or st[i, cv2.CC_STAT_HEIGHT] < H * 0.25:
                continue
            x, y, w, h = st[i, :4]
            cv2.ellipse(body.view(np.uint8), (x + w // 2, y + h // 2), (w // 2 + 1, h // 2 + 1), 0, 0, 360, 0, -1)
    else:
        body[int(H * 0.88):] = False
    allowed = body.copy()
    # buracos de 1-2 px dentro da lataria (chuvisco) entram, desde que sejam claros o bastante
    closed = cv2.morphologyEx(body.astype(np.uint8), cv2.MORPH_CLOSE, K8) > 0
    body = closed & op & (sat < 30) & (lum > 55) & ~glass & ~(cv2.dilate(lamp.astype(np.uint8), np.ones((3, 5), np.uint8)) > 0)
    if view == 'side':
        body &= allowed | ~(lum < 72)  # o fechamento não invade frisos escuros
    body &= cv2.erode(op.astype(np.uint8), np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)) > 0
    # superfícies grandes (lataria) e os retrovisores (ilhas pequenas mas bem claras);
    # o resto das ilhas são cromados, faróis e refletores
    n, lab, st, _ = cv2.connectedComponentsWithStats(body.astype(np.uint8), 4)
    keep = np.zeros_like(body)
    for i in range(1, n):
        comp = lab == i
        if st[i, cv2.CC_STAT_AREA] >= 60 or (view != 'side' and st[i, cv2.CC_STAT_AREA] >= 8 and lum[comp].mean() > 190 and st[i, cv2.CC_STAT_TOP] < H * 0.4
                                                  and (st[i, cv2.CC_STAT_LEFT] < W * 0.15 or st[i, cv2.CC_STAT_LEFT] + st[i, cv2.CC_STAT_WIDTH] > W * 0.85)):
            keep |= comp
    return keep


def main():
    src, cars = sys.argv[1], sys.argv[2]
    for view in ('side', 'rear', 'front'):
        out = os.path.join(cars, f'br-pumagtb-{view}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'src-{view}.png'), out, str(PERIOD[view])], check=True)
        a = np.array(Image.open(out).convert('RGBA'))
        g = side_glass(a) if view == 'side' else np.zeros(a.shape[:2], bool)
        m = body_mask(a, view, g)
        flatten(a, m, 10)
        outline(a)
        Image.fromarray(a, 'RGBA').save(out)
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(out.replace('.png', '-mask.png'))
        print(view, a.shape[1], a.shape[0], 'máscara', int(m.sum()))


if __name__ == '__main__':
    main()
