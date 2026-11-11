"""Viatura Toro V12 (Diablo da polícia) a partir dos sprites novos do Diablo (diablo-*.png, já com
os emblemas da Toro): lataria preta e portas brancas mantendo o sombreado da arte (pela máscara de
pintura), giroflex no teto, brasão na porta e "POLICE" no paralama e no para-choque.
Uso: python3 tools/ref/patrolsv_sprites.py <src/assets>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from diablo_sprites import lightbar, pad_top, repaint, text  # noqa: E402

DOOR = [(124, 21), (200, 19), (212, 28), (204, 44), (200, 56), (126, 60), (123, 40)]  # lateral 300x77


def load(cars, v):
    a = np.array(Image.open(os.path.join(cars, f'diablo-{v}.png')).convert('RGBA'))
    m = np.array(Image.open(os.path.join(cars, f'diablo-{v}-mask.png')).convert('L')) > 127
    # restos roxos fora da máscara (contornos e reflexos da lataria): também viram pintura
    hsv = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    purple = (hue > 255) & (hue < 345) & (hsv[..., 1] > 45) & (hsv[..., 2] > 30)
    return a, (m | purple) & (a[..., 3] > 0)


def badge(a, bx, by):
    a[by:by + 7, bx:bx + 7] = (30, 60, 150, 255)
    a[by, bx:bx + 7] = (16, 30, 80, 255)
    for (yy, xx) in [(1, 3), (2, 2), (2, 3), (2, 4), (3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (4, 2), (4, 4), (5, 1), (5, 5)]:
        a[by + yy, bx + xx] = (240, 200, 40, 255)


def big(fn, k):
    """desenha com a função de 1 px numa tela pequena e amplia k vezes (letreiro, brasão e giroflex
    acompanham o tamanho do sprite)"""
    def draw(a, x, y, w, h, *args):
        t = np.zeros((h, w, 4), np.uint8)
        fn(t, *args)
        t = np.kron(t, np.ones((k, k, 1), np.uint8))
        sel = t[..., 3] > 0
        reg = a[y:y + h * k, x:x + w * k]
        reg[sel[:reg.shape[0], :reg.shape[1]]] = t[:reg.shape[0], :reg.shape[1]][sel[:reg.shape[0], :reg.shape[1]]]
    return draw


def main():
    """medidas originais para lateral 300x77 e frente/traseira 200 de largura: escaladas pelo tamanho real"""
    assets = sys.argv[1]
    cars = os.path.join(assets, 'cars')
    s, m = load(cars, 'side')
    s, m = s[:, ::-1].copy(), m[:, ::-1].copy()  # medidas da lateral com a frente à direita
    H, W = s.shape[:2]
    fx, fy = W / 300, H / 77
    k = max(1, int(round(fx)))
    door = np.zeros(m.shape, np.uint8)
    cv2.fillPoly(door, [np.array([(x * fx, y * fy) for x, y in DOOR], np.int32)], 1)
    repaint(s, m & (door == 0), 10, 70)
    repaint(s, m & (door > 0), 170, 250)
    s = s[:, ::-1].copy()
    big(lambda t: badge(t, 0, 0), k)(s, W - int(152 * fx) - 7 * k, int(30 * fy), 7, 7)
    big(lambda t: text(t, 'POLICE', 0, 0, (236, 236, 236, 255)), k)(s, W - int(30 * fx) - 23 * k, int(21 * fy), 23, 5)
    s = pad_top(s, 5 * k)
    big(lambda t: lightbar(t, 0, 32, 0, 'red', 'blue'), k)(s, W - int(172 * fx), k, 32, 5)
    Image.fromarray(s, 'RGBA').save(os.path.join(cars, 'patrolsv-side.png'), optimize=True)

    out = {}
    for v, lb in (('front', ('red', 'blue')), ('rear', ('blue', 'red'))):
        a, m = load(cars, v)
        H, W = a.shape[:2]
        fx, fy = W / 200, H / 102.5
        k = max(1, int(round(fx)))
        repaint(a, m, 10, 70)
        if v == 'front':
            big(lambda t: text(t, 'POLICE', 0, 0, (236, 236, 236, 255)), k)(a, int(100 * fx) - 23 * k // 2, int(84 * fy), 23, 5)
        a = pad_top(a, (2 if v == 'front' else 5) * k)
        big(lambda t: lightbar(t, 0, 72, 0, *lb), k)(a, int(100 * fx) - 36 * k, (6 if v == 'front' else 1) * k, 72, 5)
        out[v] = a
        Image.fromarray(a, 'RGBA').save(os.path.join(cars, f'patrolsv-{v}.png'), optimize=True)
        Image.fromarray(a, 'RGBA').save(os.path.join(assets, 'traffic', f'policesv-{v}.png'), optimize=True)
    print('viatura', s.shape[1::-1], out['front'].shape[1::-1], out['rear'].shape[1::-1])


if __name__ == '__main__':
    main()
