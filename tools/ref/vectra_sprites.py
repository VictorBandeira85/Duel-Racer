"""Sprites do Vetor GSi (Chevrolet Vectra GSi 2.0 16v 1994, pixel art nova do Victor, com cenário), no molde do
Ímola S/R (monza_sprites.py: recorte por inundação do fundo a partir das bordas, o contorno escuro segura;
sombra e asfalto de baixo saem por geometria) e a máscara do carro branco do Cadete (kadett_sprites.py).
As três vistas vieram BRANCAS (a cor de fábrica nova, `color` em carsbr.ts); a lateral, com a frente para a
direita, é espelhada. Marcas reais saem: gravata da grade, da tampa e das rodas (emblema da Vanguarda na grade
e na tampa, miolo liso nas rodas), "CHEVROLET" e o "VECTRA" da tampa (fica "GSI"), placa da frente só "GSi" e a
de trás lisa (o jogo põe a placa dele).
Uso: python3 tools/ref/vectra_sprites.py <pasta com side/front/rear.png> <src/assets/cars>   (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink  # noqa: E402
from brand_badges import logo_img  # noqa: E402

ID = 'br-vectra'
WIDTH = {'side': 400, 'rear': 260, 'front': 260}
BOX = {'front': (380, 170, 1295, 850), 'rear': (360, 175, 1305, 860), 'side': (135, 270, 1575, 790)}
SW, SR, SHUB = ((462, 670), (1300, 670)), 98, 27        # rodas da lateral (arte original) e o miolo com a gravata
SBOT = 706
BOT = {'front': (786, [(405, 548), (1128, 1272)]), 'rear': (792, [(395, 525), (1110, 1272), (510, 582)])}


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


# o que não é lataria e passaria por branco: lentes claras, placas, letreiros, rodas
ZONES = {
    'side': [rect(1468, 528, 1532, 580), rect(1505, 645, 1535, 672), 
             rect(160, 485, 202, 572)],
    'front': [rect(470, 505, 655, 585), rect(1015, 505, 1200, 585), rect(712, 634, 958, 708),
              rect(415, 500, 475, 585), rect(1195, 500, 1255, 585), rect(452, 696, 552, 740), rect(1122, 696, 1220, 740)],
    'rear': [rect(705, 505, 962, 585), rect(400, 468, 600, 610), rect(1072, 468, 1265, 610),
             ],
}


def segment(a, k):
    rgb = a.astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = rgb.mean(axis=2)
    dark = (lum < 70) & ~((b > r + 30) & (b > 60))       # contorno escuro (sem o azul do céu e do asfalto)
    x0, y0, x1, y1 = BOX[k]
    can = ~dark
    can[:y0], can[y1:], can[:, :x0], can[:, x1:] = True, True, True, True
    n, lab = cv2.connectedComponents(can.astype(np.uint8), connectivity=4)
    bg = lab == lab[0, 0]
    car = ~bg
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(car, 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    H, W = car.shape
    yy, xx = np.mgrid[0:H, 0:W]
    green = (g > r + 8) & (g > b - 25) & (lum < 200)      # mato e grade de proteção grudados na borda
    car &= ~(green & ~(cv2.erode(car.astype(np.uint8), np.ones((25, 25), np.uint8)) > 0))
    if k == 'side':
        car &= ~((xx < 166) & (yy < 566)) & ~((xx < 318) & (yy < 424))   # arbusto atrás da tampa
        wh = np.zeros_like(car)
        for cx, cy in SW:
            wh |= np.hypot(xx - cx, yy - cy) <= SR
        car &= (yy <= SBOT) | wh
    else:
        lim, cols = BOT[k]
        keep = yy <= lim
        for c0, c1 in cols:
            keep |= (xx >= c0) & (xx <= c1) & (yy <= lim + 70)
        car &= keep
    n, lab, st, _ = cv2.connectedComponentsWithStats(car.astype(np.uint8), 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    n, lab = cv2.connectedComponents((~car).astype(np.uint8), connectivity=4)
    hole = ~car & (lab != lab[0, 0])
    # paisagem verde/clara vista pelos vidros vira cor de vidro
    green = (g > r + 12) & (g > b - 10)
    light = (lum > 150) & (b > r)
    sc = hole & (green | light)
    a[sc] = np.clip(np.dstack([lum * 0.25, lum * 0.42, lum * 0.75 + 30]), 0, 255).astype(np.uint8)[sc]
    return car | hole


def badge(a, cx, cy, s):
    lg = np.array(Image.fromarray(logo_img('vanguarda', 9)).resize((s, s), Image.NEAREST))
    m = lg[..., 3] > 0
    a[cy - s // 2:cy - s // 2 + s, cx - s // 2:cx - s // 2 + s][m] = lg[..., :3][m]


def disc(a, cx, cy, r, col):
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    a[np.hypot(xx - cx, yy - cy) <= r] = col


def rowfill(a, x0, y0, x1, y1):
    for y in range(y0, y1):
        l, r = a[y, x0 - 6:x0 - 1].mean(axis=0), a[y, x1 + 1:x1 + 6].mean(axis=0)
        t = np.linspace(0, 1, x1 - x0)[:, None]
        a[y, x0:x1] = (l * (1 - t) + r * t).astype(np.uint8)


def debrand(a, k):
    if k == 'front':
        disc(a, 835, 555, 28, (20, 22, 30))
        badge(a, 835, 555, 40)
        gsi = a[648:696, 872:948].copy()               # placa: só "GSi", centrado
        a[646:698, 722:950] = np.median(a[648:696, 722:735].reshape(-1, 3), axis=0).astype(np.uint8)
        a[648:696, 798:874] = gsi
    elif k == 'rear':
        rowfill(a, 494, 424, 628, 452)                  # "VECTRA" (fica "GSI")
        rowfill(a, 988, 424, 1176, 454)                 # "CHEVROLET"
        disc(a, 833, 433, 24, (24, 26, 34))
        badge(a, 833, 433, 34)
        a[516:576, 716:952] = np.median(a[520:572, 716:722].reshape(-1, 3), axis=0).astype(np.uint8)
    else:
        # "2.0 16V" da porta: refeito em letra cheia, escrito espelhado (a lateral é espelhada depois)
        from PIL import ImageDraw, ImageFont
        for y in range(552, 584):
            a[y, 1040:1170] = np.median(a[y, 990:1035], axis=0).astype(np.uint8)
        t = Image.new('L', (130, 34), 0)
        ImageDraw.Draw(t).text((65, 17), '2.0 16V', font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28), fill=255, anchor='mm')
        im = Image.fromarray(a)
        im.paste((92, 94, 112), (1040, 551), t.transpose(Image.FLIP_LEFT_RIGHT))
        a[:] = np.array(im)
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        for cx, cy in SW:
            d = np.hypot(xx - cx, yy - cy)
            ring = (d > SHUB) & (d < SHUB + 6)
            lum = a[ring].mean(axis=1)
            a[d <= SHUB] = np.median(a[ring][lum > np.percentile(lum, 50)], axis=0).astype(np.uint8)


TEXT = {'side': (1038, 550, 1172, 586), 'rear': (626, 420, 700, 455)}  # letreiros: só as letras (escuras) ficam fora


def zone(k, shape, a=None):
    z = np.zeros(shape, np.uint8)
    if k in TEXT and a is not None:
        x0, y0, x1, y1 = TEXT[k]
        z[y0:y1, x0:x1] = a[y0:y1, x0:x1].astype(int).mean(axis=2) < 150
    for p in ZONES[k]:
        cv2.fillPoly(z, [np.array(p, np.int32)], 1)
    if k == 'side':
        for cx, cy in SW:
            cv2.circle(z, (cx, cy), SR, 1, -1)
    return z > 0


def paint_mask(a, car, k):
    rgb = a.astype(int)
    lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    ok = car & ~zone(k, car.shape, a)
    m = ok & (lum > 120) & (sat < 60)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    for _ in range(6):
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= ok & near & (lum > 80) & (sat < 70)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    return np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 60])


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    for k in ('side', 'front', 'rear'):
        a = np.array(Image.open(os.path.join(src, f'{k}.png')).convert('RGB'))
        car = segment(a, k)
        debrand(a, k)
        pm = paint_mask(a, car, k)
        if k == 'side':
            a, car, pm = a[:, ::-1], car[:, ::-1], pm[:, ::-1]
        a, car, pm = (np.ascontiguousarray(v) for v in (a, car, pm))
        s, (ox, oy, f) = shrink(a, car, WIDTH[k])
        g8, _ = shrink(np.dstack([pm * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
        m = (g8[..., 0] > 127) & (s[..., 3] > 0)
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'{ID}-{k}.png'), optimize=True)
        Image.fromarray((m * 255).astype(np.uint8), 'L').convert('RGBA').save(os.path.join(out, f'{ID}-{k}-mask.png'), optimize=True)
        fr = lambda x, y: (round((x - ox) / f / s.shape[1], 4), round((y - oy) / f / s.shape[0], 4))  # noqa: E731
        print(k, s.shape[1], s.shape[0], 'origem', ox, oy, 'fator', round(f, 3), 'h/w', round(s.shape[0] / s.shape[1], 3))
        if k == 'side':
            W = a.shape[1]
            print('  rodas', [fr(W - 1 - cx, cy) for cx, cy in SW], 'farol', fr(W - 1 - 1500, 553), 'lanterna', fr(W - 1 - 183, 530))
        if k == 'front':
            print('  farol', fr(562, 545), 'pisca', fr(445, 505), fr(472, 580))
        if k == 'rear':
            print('  placa', fr(705, 505), fr(962, 585), 'âmbar', fr(405, 515), fr(512, 548), 'vermelho', fr(460, 575))
        if dbg:
            v = np.array(Image.fromarray(s).resize((s.shape[1] * 3, s.shape[0] * 3), Image.NEAREST))
            bg = np.zeros_like(v[..., :3]); bg[:] = (0, 160, 0)
            al = v[..., 3:] / 255
            mm = np.array(Image.fromarray((m * 255).astype(np.uint8)).resize((s.shape[1] * 3, s.shape[0] * 3), Image.NEAREST)) > 0
            lum = v[..., :3].astype(float).mean(axis=2)
            bl = v[..., :3].copy(); bl[mm] = np.stack([lum * .25, lum * .45, lum * 1.1], -1).clip(0, 255)[mm]
            Image.fromarray(np.concatenate([(v[..., :3] * al + bg * (1 - al)), (bl * al + bg * (1 - al))], 1).astype(np.uint8)).save(os.path.join(dbg, f'{k}.png'))


if __name__ == '__main__':
    main()
