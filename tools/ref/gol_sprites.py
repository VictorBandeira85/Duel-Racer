"""Sprites do Gaúcho GTI (Gol GTI 1994) a partir da arte ampliada: reamostra na grade nativa
(regrid.py), troca o branco dos vidros por vidro azulado e alisa o chuvisco da lataria
(as funções do Vectra), corrige a faixa da carroceria entre as lanternas e o para-choque
traseiro (a arte deixava o cinza do para-choque subir nas pontas), desenha na frente os
faróis auxiliares redondos com as garras do para-choque (como no GTI de verdade) e gera as
máscaras de pintura pelo matiz vermelho (sem as lanternas).

Uso: python3 tools/ref/gol_sprites.py <pasta com src-side/rear/front.png> <src/assets/cars>
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

PERIOD = {'side': 5.95, 'rear': 5.98, 'front': 5.99}
INK = (20, 18, 16, 255)


def glass(a):
    """Branco dos vidros (na metade de cima; o da arte é amarelado) vira vidro azul-acinzentado,
    mais claro em cima, com um reflexo diagonal."""
    H = a.shape[0]
    rgb = a[..., :3].astype(int)
    white = (a[..., 3] > 0) & (rgb.min(axis=2) > 190)
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
            a[y, m[y], :3] = (np.array([180, 196, 210]) * (1 - t) + np.array([98, 114, 132]) * t).astype(np.uint8)
        xs = np.nonzero(m[y0])[0]
        for k in range(3):
            yy, xx = y0 + 1 + k, xs.min() + 3 + k * 2
            if yy < H and xx + 1 < a.shape[1] and m[yy, xx]:
                a[yy, xx:xx + 2, :3] = (216, 226, 234)


def reshape_side(a, belt=30, drop=5):
    """Proporção da lateral como no Gol de verdade: área envidraçada mais baixa (teto desce
    drop px, comprimindo só acima da linha das janelas) e o teto mais comprido atrás, com a
    tampa traseira mais curta e inclinada até o aerofólio (a arte deixava a traseira recuada)."""
    H, W = a.shape[:2]
    H2 = H - drop
    out = np.zeros((H2, W, 4), np.uint8)
    nb = belt - drop
    for ty in range(H2):
        sy = ty + drop if ty >= nb else min(belt - 1, int((ty + 0.5) * belt / nb))
        out[ty] = a[sy]
    # teto para trás: 150 fica, 172 (fim do teto) vai a 183, 200 (aerofólio) a 202
    src = np.array([0, 150, 172, 200, W - 1], float)
    dst = np.array([0, 150, 183, 202, W - 1], float)
    xs = np.arange(W) + 0.5
    for y in range(nb):
        w = 1.0 if y < nb - 8 else (nb - y) / 8  # some até a linha das janelas
        d = src + (dst - src) * w
        sx = np.interp(xs, d, src).astype(int).clip(0, W - 1)
        out[y] = out[y, sx]
    return out


def fix_rear(a):
    """Faixa vermelha contínua logo abaixo das lanternas, de ponta a ponta (linhas 55-56)."""
    H, W = a.shape[:2]
    al = a[..., 3] > 0
    for y, col in ((55, (192, 14, 14)), (56, (206, 20, 20))):
        xs = np.nonzero(al[y])[0]
        if not len(xs):
            continue
        x0, x1 = xs.min() + 2, xs.max() - 1
        a[y, x0:x1, :3] = col
        # nas pontas, o contorno escuro fecha a faixa
        a[y, x0 - 1, :3] = INK[:3]
        a[y, x1, :3] = INK[:3]
    return a


def disc(a, cx, cy, r, color):
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    m = (xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= r * r
    a[m] = color
    return m


def fog_lights(a):
    """Faróis auxiliares redondos à frente da grade (perto dos faróis), apoiados no para-choque
    por uma haste, e as garras pretas do para-choque logo por fora deles."""
    W = a.shape[1]
    mid = W / 2 - 0.5
    for side in (-1, 1):
        # garra do para-choque (borracha preta, com brilho na quina)
        gx = int(round(mid + side * 41.5))
        a[74:89, gx - 3:gx + 3] = (30, 30, 32, 255)
        a[74:89, gx - 3] = INK
        a[74:89, gx + 2] = INK
        a[74, gx - 3:gx + 3] = INK
        a[75:88, gx - 2] = (70, 70, 74, 255)
        # haste até o para-choque
        cx = mid + side * 29 + 0.5
        a[76:82, int(cx) - 1:int(cx) + 1] = (24, 24, 26, 255)
        # farol: aro escuro, cromado, lente creme com reflexo
        cy = 71.5
        disc(a, cx, cy, 7.6, INK)
        disc(a, cx, cy, 6.6, (176, 176, 180, 255))
        disc(a, cx, cy, 5.6, (232, 228, 214, 255))
        disc(a, cx + 0.8, cy + 0.8, 4.0, (214, 208, 190, 255))
        disc(a, cx, cy, 1.6, (246, 244, 236, 255))
        disc(a, cx - 2.2, cy - 2.4, 1.3, (255, 255, 255, 255))
        # aro cromado mais escuro embaixo (volume)
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        ring = ((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= 6.6 ** 2) & ((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 > 5.6 ** 2) & (yy + 0.5 > cy + 1)
        a[ring] = (110, 110, 116, 255)
    return a


def emblem(a):
    """Troca o emblema da marca na grade por um fictício: anel cromado com três traços de
    velocidade dentro. Antes, a grade (listras horizontais) é refeita por baixo."""
    x0, x1, y0, y1 = 80, 96, 59, 74
    for y in range(y0, y1 + 1):
        a[y, x0:x1] = a[y, 77]
    cx, cy = 88.0, 67.0
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    d = np.sqrt((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2)
    a[d <= 6.6] = INK
    ring = (d <= 6.0) & (d > 4.6)
    t = np.clip((yy + 0.5 - (cy - 6)) / 12, 0, 1)
    chrome = (np.array([244, 244, 246]) * (1 - t[..., None]) + np.array([150, 152, 158]) * t[..., None]).astype(np.uint8)
    a[ring, :3] = chrome[ring]
    inner = d <= 4.6
    a[inner, :3] = (14, 14, 18)
    # traços de velocidade, alinhados à direita (o de cima maior)
    for dy, n in ((-2, 6), (0, 4), (2, 2)):
        y = int(cy + dy)
        for x in range(int(cx + 3) - n, int(cx + 3)):
            if inner[y, x]:
                a[y, x, :3] = chrome[y, x]
    return a


def red_mask(a, exclude=()):
    hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(float)
    hue = hsv[..., 0] * 360 / 256
    m = ((hue >= 340) | (hue <= 14)) & (hsv[..., 1] > 120) & (hsv[..., 2] > 60) & (a[..., 3] > 0)
    for x0, y0, x1, y1 in exclude:
        m[y0:y1, x0:x1] = False
    m &= cv2.erode((a[..., 3] > 0).astype(np.uint8), np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    keep = np.zeros(m.shape, bool)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 12:
            keep |= lab == i
    return keep


def main():
    src, cars = sys.argv[1], sys.argv[2]
    for view in ('side', 'rear', 'front'):
        out = os.path.join(cars, f'br-golgti-{view}.png')
        subprocess.run([sys.executable, os.path.join(HERE, 'regrid.py'), os.path.join(src, f'src-{view}.png'), out, str(PERIOD[view])], check=True)
        a = np.array(Image.open(out).convert('RGBA'))
        if view == 'side':
            a = reshape_side(a)
        H, W = a.shape[:2]
        glass(a)
        if view == 'rear':
            fix_rear(a)
        # fora da pintura: lanternas (vermelhas como a lataria), a placa e o friso vermelho dos
        # para-choques (no GTI ele é sempre vermelho)
        excl = []
        if view == 'rear':
            excl = [(0, 43, W, 55), (48, 55, W - 48, 58), (0, 58, W, H)]
        elif view == 'side':
            excl = [(W - 10, 23, W, 41), (0, int(H * 0.66), W, H)]
        else:
            excl = [(0, 80, W, H)]
        m = red_mask(a, excl)
        flatten(a, m)
        if view == 'front':
            emblem(a)
            fog_lights(a)
            m = red_mask(a, excl)  # os faróis novos cobriram parte da faixa vermelha
        outline(a)
        Image.fromarray(a, 'RGBA').save(out)
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(out.replace('.png', '-mask.png'))
        print(view, W, H, 'máscara', int(m.sum()))


if __name__ == '__main__':
    main()
