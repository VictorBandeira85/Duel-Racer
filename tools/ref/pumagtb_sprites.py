"""Sprites da Onça GTB (Puma GTB S2, pixel art nova do Victor sobre magenta), no molde da Onça GTE
(pumagte_sprites2.py). Lateral prata (a cor de fábrica, `color` em carsbr.ts); a frente veio VERMELHA e a
traseira BRANCA: as duas são convertidas para o prata da lateral PELO BRILHO (tone_map de
santana_sprites.py), com o brilho alisado antes dentro da pintura e chapado em poucos tons depois.
O letreiro "PUMA" da faixa lateral some (a faixa preta continua linha a linha); o "GTB/S2" da tampa fica.
Vira pixel art nítida (lateral 400, frente/traseira 260: shrink de monza_sprites.py).
Máscara de pintura: a lataria (prata e a convertida) com o contorno e os reflexos encostados, fora das
zonas medidas (faróis, piscas, lanternas, para-choques, placa, vidros, retrovisores, grade, escapamento,
faixa preta, fechadura, rodas).
Uso: python3 tools/ref/pumagtb_sprites.py <pasta com side/front/rear.png> <src/assets/cars>   (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink  # noqa: E402
from santana_sprites import tone_map  # noqa: E402

ID = 'br-pumagtb'
WIDTH = {'side': 400, 'rear': 260, 'front': 260}
CX = {'front': 768, 'rear': 761}
SIDE_WHEELS, SIDE_R = ((383, 640), (1255, 640)), 122


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


GLASS = {
    'side': [[(606, 418), (775, 300), (812, 300), (712, 428)],
             [(745, 436), (818, 306), (1005, 306), (1005, 433)],
             [(1036, 318), (1210, 352), (1262, 412), (1040, 430)]],
    'front': [[(458, 192), (1072, 192), (1150, 372), (388, 372)]],
    'rear': [[(440, 205), (1090, 205), (1150, 348), (372, 348)]],
}
ZONES = {
    'side': {'all': [rect(100, 540, 168, 566),                 # pisca da frente
                     rect(52, 574, 168, 622),                   # para-choque da frente
                     rect(1500, 476, 1590, 538),                # lanterna
                     rect(1488, 538, 1614, 588),                # para-choque de trás
                     rect(1540, 606, 1594, 642),                # escapamento
                     rect(694, 392, 764, 448),                  # retrovisor
                     rect(515, 562, 1112, 612)],                # faixa preta (decalque)
             'disc': [(1000, 481, 16)]},                        # fechadura
    'front': {'all': [rect(510, 540, 1020, 690),                # grade
                      rect(628, 756, 904, 854)],                # placa
              'sym': [rect(238, 316, 356, 396),                 # retrovisor
                      rect(176, 676, 768, 770),                 # para-choque
                      rect(328, 764, 470, 814),                 # pisca
                      rect(245, 540, 510, 690)],                # faróis (moldura preta)
              'disc': []},
    'rear': {'all': [rect(600, 736, 930, 856),                  # placa
                     rect(900, 474, 1120, 512)],                # letreiro GTB/S2
             'sym': [rect(166, 520, 472, 646),                  # lanterna e luz de ré
                     rect(136, 644, 761, 730)],                 # para-choque
             'disc': [(468, 825, 48)]},                         # escapamento
}
BOT = {'side': 690, 'front': 856, 'rear': 860}  # abaixo: só pneus (fora da máscara)
PUMA = (620, 568, 768, 608)  # letreiro da faixa lateral (x0, y0, x1, y1)
PLATE_FRAME = {'rear': (606, 740, 926, 852)}
FRONT_HEAD, FRONT_SIG = (330, 612, 50), (365, 788, 30)
REAR_RED, REAR_SIG = (285, 582), (172, 525, 400, 640)


def segment(a):
    rgb = a.astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mag = (r - g > 70) & (b - g > 70) & (r > 120) & (b > 120)
    car = ~mag
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(car, 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    n, lab = cv2.connectedComponents((~car).astype(np.uint8), connectivity=4)
    return car | (lab != lab[0, 0])


def poly_mask(polys, shape):
    z = np.zeros(shape, np.uint8)
    for p in polys:
        cv2.fillPoly(z, [np.round(np.array(p, float)).astype(np.int32)], 1)
    return z > 0


def zone_mask(k, shape):
    Z = ZONES[k]
    polys = [np.array(p, float) for p in Z.get('all', [])]
    for p in Z.get('sym', []):
        p = np.array(p, float)
        polys += [p, np.c_[2 * CX[k] - p[:, 0], p[:, 1]]]
    z = poly_mask(polys, shape).astype(np.uint8)
    for cx, cy, r in Z.get('disc', []):
        cv2.circle(z, (cx, cy), r, 1, -1)
        if k in CX:
            cv2.circle(z, (2 * CX[k] - cx, cy), r, 1, -1) if k == 'front' else None
    if k == 'side':
        for cx, cy in SIDE_WHEELS:
            cv2.circle(z, (cx, cy), SIDE_R, 1, -1)
    z[BOT[k] + 1:] = 1
    return (z > 0) | poly_mask(GLASS[k], shape)


def debrand(a):
    x0, y0, x1, y1 = PUMA
    for y in range(y0, y1):
        a[y, x0:x1] = np.median(a[y, 790:990], axis=0).astype(np.uint8)


def smooth_lum(a, sel):
    lum = a.astype(np.float32).mean(axis=2)
    x = np.where(sel, lum, -1000).astype(np.float32)
    for _ in range(2):
        x = cv2.bilateralFilter(x, 15, 22, 7)
        x = np.where(sel, x, -1000).astype(np.float32)
    med = cv2.medianBlur(np.clip(x, 0, 255).astype(np.uint8), 5)
    return np.where(sel, med, lum)


def red_body(a, car, k):
    hsv = cv2.cvtColor(np.ascontiguousarray(a), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue, sat, val = hsv[..., 0] * 360 / 256, hsv[..., 1], hsv[..., 2]
    zn = zone_mask(k, car.shape) & ~poly_mask([rect(0, 856, 2000, 2000)], car.shape)
    zn |= poly_mask(GLASS[k], car.shape)
    red = (hue < 16) | (hue > 340)
    m = car & ~zn & red & (sat > 110) & (val > 60)
    for _ in range(4):  # reflexos claros (rosados) e contorno vermelho-escuro encostados
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= car & ~zn & near & ((red & (sat > 60) & (val > 35)) | ((val > 200) & (sat < 90)))
    # saia vermelha embaixo do para-choque (fica abaixo de BOT? não: entre os pneus)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    return np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 30])


def paint_mask(a, car, k):
    rgb = a.astype(int)
    lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    ok = car & ~zone_mask(k, car.shape)
    m = ok & (lum > 95) & (sat < 45)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    for _ in range(6):
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= ok & near & (lum > 70) & (sat < 55)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    return np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 40])


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    data = {}
    for k in ('side', 'front', 'rear'):
        a = np.array(Image.open(os.path.join(src, f'{k}.png')).convert('RGB'))
        car = segment(a)
        if k == 'side':
            debrand(a)
        data[k] = (a, car)
    a, car = data['side']
    ms = paint_mask(a, car, 'side')
    rs = a[ms].astype(float)
    rs = rs[np.argsort(rs.mean(axis=1))]
    print('prata da lateral:', '#%02x%02x%02x' % tuple(int(v) for v in np.median(rs[rs.mean(axis=1) > 170], axis=0)))
    masks, conv = {'side': ms}, {}
    for k in ('front', 'rear'):
        a, car = data[k]
        cm = red_body(a, car, k) if k == 'front' else paint_mask(a, car, k)
        if k == 'front':  # vermelho que sobrou nas quinas das molduras dos faróis e do teto: também é lataria
            hsv = cv2.cvtColor(np.ascontiguousarray(a), cv2.COLOR_RGB2HSV_FULL).astype(int)
            hue, sat, val = hsv[..., 0] * 360 / 256, hsv[..., 1], hsv[..., 2]
            cm |= car & ((hue < 16) | (hue > 340)) & (sat > 110) & (val > 50) & (np.mgrid[0:car.shape[0], 0:car.shape[1]][0] < 856)
        L = smooth_lum(a, cm)
        b = np.dstack([L] * 3).astype(np.uint8)
        tone_map(b, cm, rs)
        a[cm] = b[cm]
        conv[k] = cm
        masks[k] = cm | paint_mask(a, car, k)
    for k in ('front', 'rear', 'side'):
        a, car = data[k]
        s, (ox, oy, f) = shrink(a, car, WIDTH[k])
        to_s = lambda x, y: (int(round((x - ox) / f)), int(round((y - oy) / f)))  # noqa: E731
        fr = lambda x, y: (round((x - ox) / f / s.shape[1], 4), round((y - oy) / f / s.shape[0], 4))  # noqa: E731
        g8, _ = shrink(np.dstack([masks[k] * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
        z8, _ = shrink(np.dstack([zone_mask(k, car.shape) * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
        m = (g8[..., 0] > 127) & (s[..., 3] > 0)
        free = z8[..., 0] < 128
        c = s[..., :3].astype(int)
        white = (s[..., 3] > 0) & free & (c.mean(axis=2) > 70) & (c.max(axis=2) - c.min(axis=2) < 55)
        for _ in range(2):
            m |= white & ~m & (cv2.filter2D(m.astype(np.uint8), -1, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT) >= 5)
        if k in conv:
            cm, _ = shrink(np.dstack([conv[k] * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
            sel = (cm[..., 0] > 127) & (s[..., 3] > 0)
            lab = cv2.cvtColor(np.ascontiguousarray(s[..., :3]), cv2.COLOR_RGB2LAB).astype(np.float32)
            cv2.setRNGSeed(7)
            _, lbl, cen = cv2.kmeans(lab[sel], 12, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.2), 3, cv2.KMEANS_PP_CENTERS)
            q = lab.copy()
            q[sel] = cen[lbl.ravel()]
            s[..., :3][sel] = cv2.cvtColor(np.clip(q, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)[sel]
        m8 = (m * 255).astype(np.uint8)
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'{ID}-{k}.png'), optimize=True)
        Image.fromarray(m8, 'L').convert('RGBA').save(os.path.join(out, f'{ID}-{k}-mask.png'), optimize=True)
        print(k, s.shape[1], s.shape[0], 'fator', round(f, 3), 'máscara', int((m8 > 0).sum()))
        if k in PLATE_FRAME:
            x0, y0, x1, y1 = PLATE_FRAME[k]
            print('  placa (sprite):', *to_s(x0, y0), *to_s(x1, y1), s.shape[1], s.shape[0])
        if k == 'rear':
            x0, y0, x1, y1 = REAR_SIG
            print('  lanterna (u0,f0,u1,f1):', *fr(x0, y0), *fr(x1, y1), 'vermelho', fr(*REAR_RED), 'h/w', round(s.shape[0] / s.shape[1], 3))
        if k == 'front':
            hx, hy, hr = FRONT_HEAD
            sx, sy, sr = FRONT_SIG
            print('  farol (u,f,r):', *fr(hx, hy), round(hr / f / s.shape[1], 3), 'pisca', *fr(sx, sy), 'h/w', round(s.shape[0] / s.shape[1], 3))
        if k == 'side':
            print('  rodas (u,v):', [fr(cx, cy) for cx, cy in SIDE_WHEELS], 'farol', fr(110, 553), 'lanterna', fr(1585, 505))
        if dbg:
            v = np.array(Image.fromarray(s).resize((s.shape[1] * 3, s.shape[0] * 3), Image.NEAREST))
            bg = np.zeros_like(v[..., :3]); bg[:] = (0, 160, 0)
            al = v[..., 3:] / 255
            mm = np.array(Image.fromarray(m8).resize((s.shape[1] * 3, s.shape[0] * 3), Image.NEAREST)) > 0
            lum = v[..., :3].astype(float).mean(axis=2)
            bl = v[..., :3].copy(); bl[mm] = np.stack([lum * .25, lum * .45, lum * 1.1], -1).clip(0, 255)[mm]
            Image.fromarray(np.concatenate([(v[..., :3] * al + bg * (1 - al)), (bl * al + bg * (1 - al))], 1).astype(np.uint8)).save(os.path.join(dbg, f'{k}.png'))


if __name__ == '__main__':
    main()
