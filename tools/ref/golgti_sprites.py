"""Sprites do Gaúcho GTI (Gol GTI 1993, pixel art do Victor): recorta pelas transparências, reduz por
área para a largura do jogo (lateral 300, traseira e frente 200) e o alfa vira binário.
A arte veio com a lateral bordô e a traseira/frente pretas: o carro do jogo é preto (cor de fábrica)
e a lateral passa a preto copiando o brilho da pintura da traseira. Máscaras de pintura:
lateral = o bordô original; traseira/frente = a lataria preta acima dos para-choques (sem vidro,
lanternas, grade, emblemas e o aerofólio preto fosco). Emblemas: brand_badges.py.
Uso: python3 tools/ref/golgti_sprites.py <pasta com src-*.png> <src/assets/cars>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

WIDTH = {'side': 300, 'rear': 200, 'front': 200}


def load(path, tw):
    a = np.array(Image.open(path).convert('RGBA'))
    al = a[..., 3] > 128
    al = cv2.morphologyEx(al.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    n, lab, st, _ = cv2.connectedComponentsWithStats(al.astype(np.uint8), 8)
    keep = np.zeros(n, bool)
    keep[1:] = st[1:, cv2.CC_STAT_AREA] > 200  # a antena fina fica (é outra mancha)
    al = keep[lab]
    ys, xs = np.nonzero(al)
    rgb = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1, :3].astype(np.float32)
    al = al[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    th = round(rgb.shape[0] * tw / rgb.shape[1])
    pm = np.dstack([rgb * al[..., None], al * 255.0]).astype(np.float32)
    sm = cv2.resize(pm, (tw, th), interpolation=cv2.INTER_AREA)
    a8 = sm[..., 3]
    col = np.clip(sm[..., :3] / np.maximum(a8[..., None] / 255, 1e-3), 0, 255)
    return np.dstack([col, np.where(a8 >= 110, 255, 0)]).astype(np.uint8)


def hsv(a):
    h = cv2.cvtColor(np.ascontiguousarray(a[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(int)
    return h[..., 0] * 360 / 256, h[..., 1], h[..., 2]


def clean(m, n=6):
    m &= np.ones_like(m)
    k, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    keep = np.zeros(k, bool)
    keep[1:] = st[1:, cv2.CC_STAT_AREA] >= n
    return keep[lab]


def glass_hull(a, y_max):
    """vidro (azul) com tudo o que fica dentro dele (bancos, retrovisor, antena): casco por linha"""
    h, sat, v = hsv(a)
    blue = (h > 180) & (h < 255) & (sat > 50) & (v > 50)
    blue[y_max:] = False
    blue = clean(blue, 30)
    g = np.zeros(blue.shape, bool)
    for y in range(blue.shape[0]):
        xs = np.nonzero(blue[y])[0]
        if len(xs) > 6:
            g[y, xs.min():xs.max() + 1] = True
    return cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0


def black_mask(a, y_max, cuts, keep_low=0, glass_max=None):
    """lataria preta: o contorno acima da linha dos faróis/lanternas, menos o vidro (e o que se vê
    por ele); as últimas keep_low linhas do vidro com pixels escuros e não azuis (o aerofólio
    passando na frente do vidro traseiro) voltam para a pintura"""
    h, sat, v = hsv(a)
    inner = cv2.erode((a[..., 3] > 0).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    g = glass_hull(a, glass_max or y_max)
    m = inner & ~g
    if keep_low:
        rows = np.nonzero(g.any(axis=1))[0]
        y1 = rows.max()
        band = np.zeros_like(g)
        band[y1 - keep_low:y1 + 1] = True
        m |= inner & g & band & (v < 90) & ~((h > 180) & (h < 255) & (sat > 35))
    m &= ~((v > 170) & (sat < 60) & ~g)  # cromados e letreiros claros
    m &= ~((sat > 120) & ((h < 50) | (h > 330)))  # lanternas e frisos vermelhos/âmbar
    m[y_max:] = False
    for x0, y0, x1, y1 in cuts:
        m[y0:y1, x0:x1] = False
    return clean(m, 10)


def main():
    src, out = sys.argv[1], sys.argv[2]
    A = {k: load(os.path.join(src, f'src-{k}.png'), w) for k, w in WIDTH.items()}
    for k, a in A.items():
        print(k, a.shape[1], a.shape[0])
    # ---- traseira e frente: máscara da lataria preta
    r, f = A['rear'], A['front']
    mr = black_mask(r, 108, [], keep_low=14)
    mf = black_mask(f, 83, [], glass_max=58)  # o capô preto é azulado: o vidro só até a base do para-brisa
    # ---- lateral: bordô -> preto com o brilho da traseira
    s = A['side']
    h, sat, v = hsv(s)
    ms = (s[..., 3] > 0) & (((h > 300) | (h < 18)) & (sat > 60) & (v > 30))
    # reflexos rosados do bordô (pouca cor), só na lataria acima dos frisos cinzas
    ms |= (s[..., 3] > 0) & ((h > 290) | (h < 25)) & (sat > 18) & (v > 110) & (np.arange(s.shape[0])[:, None] < 86)
    ms[89:] = False  # abaixo: frisos cinzas e o filete vermelho
    ms[73:89, 289:] = False  # lanterna traseira (fica com a cor dela)
    ms = clean(ms, 10)
    ref = r[..., :3][mr].astype(float)
    ref_l = ref.mean(axis=1)
    lum = s[..., :3][ms].astype(float).mean(axis=1)
    ranks = np.argsort(np.argsort(lum)) / max(1, len(lum) - 1)
    nl = np.percentile(ref_l, ranks * 100)
    tint = np.median(ref - ref_l[:, None], axis=0)  # leve puxado do preto da arte (azulado)
    s[..., :3][ms] = np.clip(nl[:, None] + tint[None, :], 0, 255).astype(np.uint8)
    for k, a, m in (('side', s, ms), ('rear', r, mr), ('front', f, mf)):
        Image.fromarray(a, 'RGBA').save(os.path.join(out, f'br-golgti-{k}.png'), optimize=True)
        Image.fromarray((m * 255).astype(np.uint8), 'L').convert('RGBA').save(os.path.join(out, f'br-golgti-{k}-mask.png'), optimize=True)
        print(k, 'máscara', int(m.sum()))


if __name__ == '__main__':
    main()
