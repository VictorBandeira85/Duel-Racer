"""Sprites a partir de artes do Victor sem grade de pixel fixa (NSX e F40 de 2026-11): fundo
transparente/branco/xadrez sai, recorta o carro, reduz por área para a largura do jogo e o alfa
vira binário. Opcional: o verde da pintura vira vermelho (traseira e frente do NSX vieram verdes).
Máscara de pintura: red_mask. Emblemas e letreiros reais saem depois (brand_badges.py e TEXT).

Uso: python3 tools/ref/art_sprites.py <art> <pasta com prep-*.png> <src/assets/cars>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
from vectra_sprites import red_mask  # noqa: E402

# text: letreiros (cada linha vira a cor da coluna logo à esquerda); cut: fora da pintura
# (lanternas, bancos vistos pelo vidro); holes: o fundo claro preso dentro (vão da asa) sai
CFG = {
    'nsx': {'width': {'side': 300, 'rear': 200, 'front': 200}, 'green2red': ('rear', 'front'), 'holes': (),
            'text': {}, 'cut': {'rear': [(4, 36, 196, 63)]}},
    'f40': {'width': {'side': 300, 'rear': 200, 'front': 200}, 'green2red': (), 'holes': ('rear', 'front'),
            'text': {'rear': [(85, 33, 117, 40)], 'side': [(203, 47, 218, 55)]},
            'cut': {'rear': [(15, 40, 185, 61)], 'front': [(45, 4, 155, 34)]}},
}


def match_v(a, m, ref_v):
    """o brilho da pintura convertida segue a distribuição da lateral (mesmo vermelho nas 3 vistas)"""
    hsv = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV_FULL)
    v = hsv[..., 2][m].astype(float)
    ranks = np.argsort(np.argsort(v)) / max(1, len(v) - 1)
    hsv[..., 2][m] = np.percentile(ref_v, ranks * 100).astype(np.uint8)
    a[..., :3] = np.where(m[..., None], cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB_FULL), a[..., :3])


def green_to_red(a):
    hsv = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV_FULL).astype(int)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = (h > 85) & (h < 140) & (s > 60) & (a[..., 3] > 0)  # verde-azulado da pintura
    hsv[..., 0] = np.where(m, 0, h)
    hsv[..., 1] = np.where(m, np.clip(s * 1.15 + 30, 0, 255), s)
    hsv[..., 2] = np.where(m, np.clip(v * 1.45 + 25, 0, 255), v)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB_FULL)
    a[..., :3] = np.where(m[..., None], out, a[..., :3])
    return m


def main():
    art, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
    cfg = CFG[art]
    ref_v = None
    for k, tw in cfg['width'].items():
        rgb = np.array(Image.open(os.path.join(src, f'prep-{k}.png')).convert('RGB'))
        white = (rgb.min(axis=2) > 245)
        n, lab = cv2.connectedComponents(white.astype(np.uint8), connectivity=4)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        al = ~np.isin(lab, list(border))
        if k in cfg['holes']:
            # xadrez/branco preso entre a asa e a carroceria: claro, sem cor, mancha grande
            lt = ((rgb.min(axis=2) > 200) & (rgb.max(axis=2).astype(int) - rgb.min(axis=2) < 14)).astype(np.uint8)
            n2, lab2, st2, _ = cv2.connectedComponentsWithStats(lt, 4)
            for i in range(1, n2):
                if st2[i, cv2.CC_STAT_AREA] > 1500:
                    al[lab2 == i] = False
        al = cv2.morphologyEx(al.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
        n, lab, st, _ = cv2.connectedComponentsWithStats(al.astype(np.uint8), 8)
        al = lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
        ys, xs = np.nonzero(al)
        rgb, al = rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1], al[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        th = round(rgb.shape[0] * tw / rgb.shape[1])
        pm = np.dstack([rgb * al[..., None], al * 255]).astype(np.float32)
        sm = cv2.resize(pm, (tw, th), interpolation=cv2.INTER_AREA)
        a8 = sm[..., 3]
        colr = np.clip(sm[..., :3] / np.maximum(a8[..., None] / 255, 1e-3), 0, 255)
        a = np.dstack([colr, np.where(a8 >= 128, 255, 0)]).astype(np.uint8)
        if k in cfg['green2red']:
            gm = green_to_red(a)
            if ref_v is not None:
                match_v(a, gm, ref_v)
        for x0, y0, x1, y1 in cfg['text'].get(k, []):
            for y in range(y0, y1):
                a[y, x0:x1, :3] = a[y, x0 - 2, :3]
        m = red_mask(a, cut=cfg['cut'].get(k, []))
        if k == 'side':
            ref_v = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV_FULL)[..., 2][m]
        Image.fromarray(a, 'RGBA').save(os.path.join(out, f'{art}-{k}.png'), optimize=True)
        mk = np.zeros_like(a)
        mk[..., :3] = np.where(m[..., None], 255, 0)
        mk[..., 3] = a[..., 3]
        Image.fromarray(mk, 'RGBA').save(os.path.join(out, f'{art}-{k}-mask.png'), optimize=True)
        print(art, k, a.shape[1], a.shape[0], int(m.sum()))


if __name__ == '__main__':
    main()
