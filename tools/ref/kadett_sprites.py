"""Sprites do Cadete GSi (Chevrolet Kadett GSi 2.0, pixel art nova do Victor sobre magenta), no molde da Onça
GTB (pumagtb_sprites.py). As três vistas vieram BRANCAS (a cor de fábrica nova, `color` em carsbr.ts) e a
lateral já de frente para a esquerda: só recorte do magenta, pixel art nítida (lateral 400, frente/traseira
260: shrink de monza_sprites.py) e máscara de pintura (lataria fora das zonas medidas: faróis, piscas,
lanternas, faróis de milha, neblina, placa, grade, vidros, retrovisores, rodas, maçaneta, letreiro).
Marca real: o "CHEVROLET" da tampa vira lataria (o "GSi 2.0" fica, como o "GTE" da Onça).
Uso: python3 tools/ref/kadett_sprites.py <pasta com side/front/rear.png> <src/assets/cars>   (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink  # noqa: E402
from santana_sprites import tone_map  # noqa: E402

ID = 'br-kadett'
WIDTH = {'side': 400, 'rear': 260, 'front': 260}
CX = {'front': 835, 'rear': 835}
SIDE_WHEELS, SIDE_R = ((398, 690), (1310, 690)), 120


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


GLASS = {
    'side': [[(556, 422), (745, 285), (770, 296), (592, 428)],
             [(688, 432), (800, 300), (992, 296), (992, 434)],
             [(1042, 300), (1238, 305), (1392, 416), (1048, 432)]],
    'front': [[(560, 198), (1100, 198), (1192, 396), (478, 396)]],
    'rear': [[(568, 192), (1102, 192), (1172, 338), (498, 338)]],
}
ZONES = {  # só o que não é lataria e passaria por branco (lentes claras, placa); preto e azul saem pela cor
    'side': {'all': [rect(140, 512, 210, 582),                 # farol e pisca
                     rect(1494, 438, 1546, 540),                # lanterna
                     rect(498, 398, 582, 442)],                 # limpador
             'disc': []},
    'front': {'all': [[(660, 560), (1008, 560), (996, 604), (672, 604)],   # grade
                      rect(712, 660, 958, 744)],                # placa
              'sym': [[(428, 514), (622, 512), (650, 600), (428, 602)],    # farol e pisca
                      rect(434, 696, 546, 756)],                # farol de milha
              'disc': []},
    'rear': {'all': [rect(704, 516, 966, 598)],                 # placa
             'sym': [rect(404, 456, 500, 596)],                 # lanterna e luz de ré
             'disc': []},
}
BOT = {'side': 742, 'front': 782, 'rear': 792}  # abaixo: só pneus (fora da máscara)
BRAND = (988, 426, 1180, 466)  # "CHEVROLET" da tampa (x0, y0, x1, y1)
PLATE_FRAME = {'rear': (700, 512, 970, 600)}
FRONT_HEAD, FRONT_SIG = (552, 560, 46), (455, 556, 22)
REAR_RED, REAR_SIG = (452, 535), (414, 460, 496, 506)


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
    x0, y0, x1, y1 = BRAND
    for y in range(y0, y1):
        a[y, x0:x1] = np.median(a[y, 880:980], axis=0).astype(np.uint8)


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
    data, masks, conv = {}, {}, {}
    for k in ('side', 'front', 'rear'):
        a = np.array(Image.open(os.path.join(src, f'{k}.png')).convert('RGB'))
        car = segment(a)
        if k == 'rear':
            debrand(a)
        data[k] = (a, car)
        masks[k] = paint_mask(a, car, k)
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
            print('  rodas (u,v):', [fr(cx, cy) for cx, cy in SIDE_WHEELS], 'farol', fr(150, 548), 'lanterna', fr(1540, 490))
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
