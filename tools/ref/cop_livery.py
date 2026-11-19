"""Plotagem Duel Racer das viaturas: cada classe com a sua cor (CLASS_COLOR em src/cars.ts). Em cima a
lataria fica branca, embaixo na cor da classe, e um filete quadriculado preto e branco marca a divisa.
Grava <sprite>-liv.png ao lado da arte (as artes originais, inclusive as police-*.png retocadas à mão,
não são tocadas). A carroceria vem da máscara de pintura do carro ou, nas viaturas sem máscara, de uma
varredura pela cor dentro de uma caixa (preto/branco da lataria, sem luzes, vidros e pneus).
Uso: python3 tools/ref/cop_livery.py [PREVIEW=<png>]
"""
import colorsys
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'assets')
CLASS = {'D': '#3a9ad8', 'C': '#30b050', 'B': '#e0b020', 'A': '#e8641a', 'S': '#d02a8a'}
WHITE = '#f2f2f2'

# sprite: (classe, máscara (arquivo) ou caixa de varredura, divisa (fração da altura do sprite), modo)
#   modo 'mask': máscara de pintura; 'dark': lataria preta da arte; 'light': carenagem branca (moto)
JOBS = {
    'cars/br-santana-rear': ('D', 'cars/br-santana-rear-mask', 0.36, 'mask'),
    'cars/br-santana-front': ('D', 'cars/br-santana-front-mask', 0.31, 'mask'),
    'cars/nsx-rear': ('B', 'cars/nsx-rear-mask', 0.5, 'mask'),
    'cars/nsx-front': ('B', 'cars/nsx-front-mask', 0.5, 'mask'),
    'traffic/police-rear': ('C', (0.44, 0.74), 0.44, 'dark'),
    'traffic/police-front': ('C', (0.42, 0.7), 0.42, 'dark'),
    'traffic/policesv-rear': ('S', (0.06, 0.78), 0.42, 'dark'),
    'traffic/policesv-front': ('S', (0.4, 0.8), 0.45, 'dark'),
    'traffic/moto-cop-rear': ('A', (0.45, 0.9), 0.0, 'light'),
    'traffic/moto-cop-front': ('A', (0.45, 0.9), 0.0, 'light'),
    'traffic/moto-copf-rear': ('A', (0.45, 0.9), 0.0, 'light'),
    'traffic/moto-copf-front': ('A', (0.45, 0.9), 0.0, 'light'),
}


def hx(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def tint(px, sel, color):
    """como paintImage (src/svgsprites.ts): luminosidade relativa ao tom médio da carroceria"""
    r, g, b = [v / 255 for v in hx(color)]
    th, tl, ts = colorsys.rgb_to_hls(r, g, b)
    rgb = px[..., :3] / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    L = (mx + mn) / 2
    base = np.median(L[sel]) if sel.any() else 0.5
    nl = np.where(L < base, tl * (np.clip(L, 0, None) / max(base, 1e-3)) ** 0.6, tl + (L - base) * (1 - tl) / max(1 - base, 1e-3))
    nl = np.clip(nl, 0.04, 0.96)
    out = px.copy()
    ys, xs = np.nonzero(sel)
    for y, x in zip(ys, xs):
        rr, gg, bb = colorsys.hls_to_rgb(th, nl[y, x], ts)
        out[y, x, :3] = (rr * 255, gg * 255, bb * 255)
    return out


def livery(px, body, split, color, upper=None):
    H, W = body.shape
    out = px.copy()
    yy = np.arange(H)[:, None] + np.zeros((1, W), int)
    xx = np.arange(W)[None, :] + np.zeros((H, 1), int)
    s = int(round(split * H))
    cs = max(2, round(W / 80))  # casa do quadriculado
    up, lo = body & (yy < s), body & (yy >= s + 2 * cs)
    if split <= 0:  # moto: a carenagem inteira na cor da classe, filete no alto dela
        top = np.nonzero(body.any(1))[0]
        s = int(top[0]) if len(top) else 0
        up, lo = body & False, body & (yy >= s + 2 * cs)
    out = tint(out, up, upper or WHITE) if up.any() else out
    t = tint(px, lo, color)
    out[lo] = t[lo]
    chk = body & (yy >= s) & (yy < s + 2 * cs)
    dark = ((xx // cs + (yy - s) // cs) % 2) == 0
    out[chk & dark, :3] = (22, 22, 26)
    out[chk & ~dark, :3] = (240, 240, 236)
    return out


def main():
    prev = [a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('PREVIEW=')]
    shots = []
    for name, (k, src, split, mode) in JOBS.items():
        px = np.array(Image.open(os.path.join(ROOT, name + '.png')).convert('RGBA')).astype(float)
        if mode == 'mask':
            body = np.array(Image.open(os.path.join(ROOT, src + '.png')).convert('L').resize(px.shape[1::-1])) > 127
        else:  # varredura pela cor dentro da faixa de linhas da lataria
            H = px.shape[0]
            rgb = px[..., :3] / 255
            mx, mn = rgb.max(-1), rgb.min(-1)
            L, sat = (mx + mn) / 2, (mx - mn)
            rows = np.zeros(px.shape[:2], bool)
            rows[int(src[0] * H):int(src[1] * H)] = True
            pick = (L < 0.2) & (sat < 0.12) if mode == 'dark' else (L > 0.62) & (sat < 0.16)
            body = rows & pick
        body &= px[..., 3] > 0
        out = livery(px, body, split, CLASS[k], CLASS[k] if k == 'S' else None).clip(0, 255).astype(np.uint8)  # S: toda na cor da classe.clip(0, 255).astype(np.uint8)
        Image.fromarray(out).save(os.path.join(ROOT, name + '-liv.png'), optimize=True)
        shots.append(Image.fromarray(out))
        print(name, k, int(body.sum()))
    if prev:
        W = sum(i.width for i in shots) + 8 * len(shots)
        H = max(i.height for i in shots)
        sheet = Image.new('RGBA', (W, H), (90, 100, 120, 255))
        x = 0
        for i in shots:
            sheet.alpha_composite(i, (x, H - i.height))
            x += i.width + 8
        sheet.resize((W * 2, H * 2), Image.NEAREST).save(prev[0])


if __name__ == '__main__':
    main()
