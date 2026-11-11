"""Sprites do Toro V12 (Diablo SV roxo, pixel art do Victor em PNG transparente) no padrão do Viper e
do NSX: cada bloco da arte vira um pixel (grade medida: lateral e traseira ~3,9 px, frente ~7,5 px),
cor do miolo do bloco, sem redução por área e sem paleta de 22 cores (a versão antiga mudava os tons).
A lateral vem com a frente para a direita: é espelhada. Marcas reais somem: "Diablo SV" e o touro da
traseira (a grade continua), o escudo do capô e os miolos das rodas (o emblema da Toro entra com
brand_badges.py). Máscara de pintura: o roxo da lataria e os reflexos dela.
Depois: python3 tools/ref/brand_badges.py --only diablo  e  python3 tools/ref/patrolsv_sprites.py src/assets
Uso: python3 tools/ref/diablosv_sprites.py <pasta com src-*.png> <src/assets/cars>   (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink, rowfill  # noqa: E402

PERIOD = {'side': 3.9, 'rear': 3.874, 'front': 7.48}


def debrand(a, k):
    if k == 'rear':
        for x0, y0, x1, y1 in ((500, 384, 780, 446), (1150, 360, 1260, 462)):
            for y in range(y0, y1):  # a grade é de riscos horizontais: cada linha repete o trecho liso do meio
                a[y, x0:x1, :3] = np.median(a[y, 830:960, :3], axis=0).astype(np.uint8)
    elif k == 'front':
        rgb = a[..., :3].copy()
        rowfill(rgb, 838, 480, 932, 568)
        a[..., :3] = rgb
    else:
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        for cx, cy in ((330, 548), (1420, 553)):
            d = np.hypot(xx - cx, yy - cy)
            a[..., :3][d <= 21] = np.median(a[..., :3][(d > 22) & (d < 27)], axis=0).astype(np.uint8)


def paint_mask(s):
    hsv = cv2.cvtColor(np.ascontiguousarray(s[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    al = s[..., 3] > 0
    pur = (hue > 262) & (hue < 338)
    m = al & pur & (hsv[..., 1] > 70) & (hsv[..., 2] > 45)
    for _ in range(3):  # reflexos claros encostados na pintura
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= al & near & pur & (hsv[..., 1] > 18) & (hsv[..., 2] > 150)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    return np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 4])


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    for k, per in PERIOD.items():
        a = np.array(Image.open(os.path.join(src, f'src-{k}.png')).convert('RGBA'))
        car = a[..., 3] > 128
        car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(car, 8)
        car = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 300])
        debrand(a, k)
        rgb = a[..., :3]
        if k == 'side':
            rgb, car = rgb[:, ::-1], car[:, ::-1]
        xs = np.nonzero(car.any(axis=0))[0]
        tw = int(round((xs.max() + 1 - xs.min()) / per))
        s, (ox, oy, f) = shrink(np.ascontiguousarray(rgb), np.ascontiguousarray(car), tw, colors=96)
        # furinhos transparentes dentro do carro (falhas do alfa da arte, ex.: no vidro lateral): fecham
        n2, lab2, st2, _ = cv2.connectedComponentsWithStats((s[..., 3] == 0).astype(np.uint8), 4)
        for i in range(1, n2):
            if st2[i, cv2.CC_STAT_AREA] <= (200 if k == 'side' else 0):  # (na traseira os vãos do aerofólio são de verdade)
                hole = lab2 == i
                ring = (cv2.dilate(hole.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & (s[..., 3] > 0)
                if ring.any():
                    s[hole] = (*np.median(s[..., :3][ring], axis=0).astype(np.uint8), 255)
        m = paint_mask(s)
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'diablo-{k}.png'), optimize=True)
        Image.fromarray((m * 255).astype(np.uint8), 'L').convert('RGBA').save(os.path.join(out, f'diablo-{k}-mask.png'), optimize=True)
        print(k, s.shape[1], s.shape[0], 'origem', ox, oy, 'fator', round(f, 3), 'máscara', int(m.sum()))
        if dbg:
            z = 2 if s.shape[1] > 300 else 4
            v = np.array(Image.fromarray(s).resize((s.shape[1] * z, s.shape[0] * z), Image.NEAREST))
            bg = np.zeros_like(v[..., :3]); bg[:] = (0, 200, 0)
            al = v[..., 3:] / 255
            Image.fromarray((v[..., :3] * al + bg * (1 - al)).astype(np.uint8)).save(os.path.join(dbg, f'out-{k}.png'))
            mm = np.array(Image.fromarray((m * 255).astype(np.uint8)).resize((s.shape[1] * z, s.shape[0] * z), Image.NEAREST)) > 0
            bl = v[..., :3].copy(); bl[mm] = bl[mm][:, [1, 2, 0]]
            Image.fromarray((bl * al + bg * (1 - al)).astype(np.uint8)).save(os.path.join(dbg, f'blue-{k}.png'))


if __name__ == '__main__':
    main()
