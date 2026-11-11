"""Alinha as rodas da vista lateral (WHEELS em src/cars.ts) para o giro não ficar torto: acha o aro de
cada roda no sprite (pixels claros e pouco coloridos perto do centro anotado), ajusta um círculo por
mínimos quadrados na borda de fora do aro e devolve centro e raio em frações do sprite. O raio que o
jogo gira é o do ARO (com 4% de folga), não o do pneu: o alto do pneu fica na sombra do para-lama e,
girando junto, fazia a roda parecer torta. Também mede o quanto o aro é redondo (resíduo, em px).
Uso: python3 tools/qa/wheel_fit.py <arte> [<arte> ...]      -> linhas prontas para WHEELS
     python3 tools/qa/wheel_fit.py --check <arte> ...       -> compara com o que está em cars.ts
     (DBG=<pasta> grava <arte>-wheels.png com o círculo achado)
     python3 tools/qa/wheel_fit.py --sheet <saida.png> <arte> ...  -> cada roda girada em 4 ângulos com os
     valores de cars.ts: se o aro aparecer dobrado ou saindo do pneu, o centro está errado
"""
import os
import re
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
CARS = os.path.join(ROOT, 'src/assets/cars')


def current():
    src = open(os.path.join(ROOT, 'src/cars.ts'), encoding='utf-8').read()
    blk = src[src.index('const WHEELS'):]
    blk = blk[:blk.index('};')]
    out = {}
    for m in re.finditer(r"'?([\w-]+)'?:\s*\[\[([\d., ]+)\],\s*\[([\d., ]+)\]\]", blk):
        out[m.group(1)] = [[float(v) for v in m.group(2).split(',')], [float(v) for v in m.group(3).split(',')]]
    return out


def fit(a, cx, cy, r):
    """círculo do aro perto de (cx, cy), raio aproximado r (px): em cada direção, a partir do centro,
    acha onde o aro (claro) vira pneu (escuro por 3 px seguidos); ajusta o círculo nesses pontos e
    repete jogando fora os que ficam longe (raios do aro, reflexos, sombra do para-lama)"""
    H, W = a.shape[:2]
    lum = a[..., :3].astype(int).mean(axis=2)
    lum[a[..., 3] == 0] = 255
    pts = []
    for ang in np.radians(np.arange(0, 360, 3)):
        ca, sa = np.cos(ang), np.sin(ang)
        prev_light = False
        for d in np.arange(r * 0.35, r * 1.15, 0.5):
            x, y = int(round(cx + ca * d)), int(round(cy + sa * d))
            x2, y2 = int(round(cx + ca * (d + 1.5))), int(round(cy + sa * (d + 1.5)))
            x3, y3 = int(round(cx + ca * (d + 3))), int(round(cy + sa * (d + 3)))
            if not (0 <= x3 < W and 0 <= y3 < H):
                break
            dark = lum[y, x] < 62 and lum[y2, x2] < 62 and lum[y3, x3] < 62
            if dark and prev_light:
                pts.append((cx + ca * d, cy + sa * d))
            prev_light = lum[y, x] > 95
        # fica o último (a borda de fora do aro) desta direção
    if len(pts) < 12:
        return None
    pts = np.array(pts)
    keep = np.ones(len(pts), bool)
    for _ in range(6):
        q = pts[keep]
        A = np.c_[2 * q[:, 0], 2 * q[:, 1], np.ones(len(q))]
        (x0, y0, c), *_ = np.linalg.lstsq(A, (q ** 2).sum(axis=1), rcond=None)
        R = np.sqrt(c + x0 * x0 + y0 * y0)
        d = np.abs(np.hypot(pts[:, 0] - x0, pts[:, 1] - y0) - R)
        keep = d <= max(0.8, np.median(d[keep]) * 2.0)
        if keep.sum() < 10:
            return None
    return refine(lum, float(x0), float(y0), float(R))


def profile(lum, x, y, radii, angs):
    H, W = lum.shape
    xs = np.clip(np.round(x + np.outer(radii, np.cos(angs))).astype(int), 0, W - 1)
    ys = np.clip(np.round(y + np.outer(radii, np.sin(angs))).astype(int), 0, H - 1)
    return lum[ys, xs]


def refine(lum, x0, y0, R):
    """acerta o centro pelo que a roda tem de redondo: na faixa do friso do aro e do pneu (0,8 a 1,2 R),
    olhando só a metade de baixo e os lados (em cima fica a sombra do para-lama), o brilho deve ser o
    mesmo em todas as direções; procura o centro (±4 px) que deixa essa faixa mais igual. Depois o raio:
    onde o brilho médio cai do aro para o pneu."""
    angs = np.radians(np.arange(-20, 201, 4))
    best = None
    for dy in np.arange(-4, 4.01, 0.5):
        for dx in np.arange(-4, 4.01, 0.5):
            P = profile(lum, x0 + dx, y0 + dy, np.arange(R * 0.8, R * 1.2, 0.5), angs)
            v = P.var(axis=1).mean()
            if best is None or v < best[0]:
                best = (v, x0 + dx, y0 + dy)
    v, x, y = best
    radii = np.arange(R * 0.6, R * 1.3, 0.25)
    m = profile(lum, x, y, radii, angs).mean(axis=1)
    g = m[4:] - m[:-4]
    Rn = float(radii[int(np.argmin(g)) + 2])
    return x, y, Rn, float(np.sqrt(v))


def sheet(out, arts, cur):
    im0 = Image.new('RGB', (2 * 4 * 230, len(arts) * 235), (0, 160, 0))
    for i, n in enumerate(arts):
        im = Image.open(os.path.join(CARS, f'{n}-side.png')).convert('RGBA')
        W, H = im.size
        for w, (u, v, rr) in enumerate(cur[n]):
            cx, cy, R = u * W, v * H, rr * W - 0.5
            box = (int(cx - R * 1.6), int(cy - R * 1.6), int(cx + R * 1.6), int(cy + R * 1.6))
            base = im.crop(box)
            lc = (cx - box[0], cy - box[1])
            for k, ang in enumerate((0, 60, 120, 200)):
                t = base.copy()
                m = Image.new('L', base.size, 0)
                ImageDraw.Draw(m).ellipse([lc[0] - R, lc[1] - R, lc[0] + R, lc[1] + R], fill=255)
                t.paste(base.rotate(-ang, resample=Image.BICUBIC, center=lc), (0, 0), m)
                bg = Image.new('RGBA', t.size, (0, 160, 0, 255))
                bg.alpha_composite(t)
                im0.paste(bg.convert('RGB').resize((225, 225), Image.NEAREST), ((w * 4 + k) * 230, i * 235))
    im0.save(out)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    cur = current()
    if '--sheet' in sys.argv:
        return sheet(args[0], args[1:], cur)
    dbg = os.environ.get('DBG')
    for art in args:
        if art not in cur:
            print(art, ': sem entrada em WHEELS (anotar um centro aproximado primeiro)')
            continue
        im = Image.open(os.path.join(CARS, f'{art}-side.png')).convert('RGBA')
        a = np.array(im)
        H, W = a.shape[:2]
        out, notes = [], []
        for u, v, rr in cur[art]:
            f = fit(a, u * W, v * H, rr * W)
            if not f:
                out.append([u, v, rr])
                notes.append('aro não achado')
                continue
            x0, y0, R, res = f
            out.append([round(float(x0 / W), 4), round(float(y0 / H), 4), round(float((R + 0.6) / W), 4)])
            notes.append(f'andou {x0 - u * W:+.1f},{y0 - v * H:+.1f} px, raio {rr * W:.1f}->{R + 0.6:.1f}, desvio do brilho na faixa {res:.1f}')
        print(f"  '{art}': {out},  // " + ' | '.join(notes))
        if dbg:
            z = 4
            big = im.resize((W * z, H * z), Image.NEAREST)
            d = ImageDraw.Draw(big)
            for u, v, rr in out:
                cx, cy, R = u * W * z, v * H * z, rr * W * z
                d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(0, 255, 0, 255))
                d.line([cx - 6, cy, cx + 6, cy], fill=(0, 255, 0, 255))
                d.line([cx, cy - 6, cx, cy + 6], fill=(0, 255, 0, 255))
            big.crop((0, int(H * z * 0.45), W * z, H * z)).save(os.path.join(dbg, f'{art}-wheels.png'))


if __name__ == '__main__':
    main()
