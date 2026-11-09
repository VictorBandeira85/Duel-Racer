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


def main():
    assets = sys.argv[1]
    cars = os.path.join(assets, 'cars')
    s, m = load(cars, 'side')
    # a lateral do Diablo olha para a esquerda; as medidas abaixo são da arte espelhada (frente à
    # direita): espelha, pinta e volta, e só então desenha brasão, letreiro e giroflex
    s, m = s[:, ::-1].copy(), m[:, ::-1].copy()
    door = np.zeros(m.shape, np.uint8)
    cv2.fillPoly(door, [np.array(DOOR, np.int32)], 1)
    repaint(s, m & (door == 0), 10, 70)
    repaint(s, m & (door > 0), 170, 250)
    s = s[:, ::-1].copy()
    W = s.shape[1]
    badge(s, W - 152 - 7, 30)
    text(s, 'POLICE', W - 30 - 23, 21, (236, 236, 236, 255))
    s = pad_top(s, 5)
    lightbar(s, W - 172, W - 140, 1, 'red', 'blue')
    Image.fromarray(s, 'RGBA').save(os.path.join(cars, 'patrolsv-side.png'))

    f, m = load(cars, 'front')
    repaint(f, m, 10, 70)
    text(f, 'POLICE', 88, 84, (236, 236, 236, 255))
    f = pad_top(f, 2)
    lightbar(f, 64, 136, 6, 'red', 'blue')
    Image.fromarray(f, 'RGBA').save(os.path.join(cars, 'patrolsv-front.png'))

    r, m = load(cars, 'rear')
    repaint(r, m, 10, 70)
    r = pad_top(r, 5)
    lightbar(r, 64, 136, 1, 'blue', 'red')
    Image.fromarray(r, 'RGBA').save(os.path.join(cars, 'patrolsv-rear.png'))
    for v, a in (('front', f), ('rear', r)):
        Image.fromarray(a, 'RGBA').save(os.path.join(assets, 'traffic', f'policesv-{v}.png'))
    print('viatura', s.shape[1::-1], f.shape[1::-1], r.shape[1::-1])


if __name__ == '__main__':
    main()
