"""Sprites do Corsário GSi (Chevrolet Corsa GSi 1.6 16v, pixel art nova do Victor), no molde da Onça GTB
(pumagtb_sprites.py). A lateral veio BRANCA (cor de fábrica, `color` em carsbr.ts), de fundo transparente e
virada para a DIREITA: é espelhada (frente para a esquerda, como os demais). Frente e traseira vieram
VERMELHAS sobre fundo xadrez claro (recorte por inundação a partir das bordas: o contorno preto segura) e são
convertidas para o branco da lateral PELO BRILHO (tone_map de santana_sprites.py).
Marcas reais: o raio da grade (Opel), a gravata da tampa e das calotas viram o emblema da Vanguarda; o
"CORSA" da tampa vira lataria (o "GSI 16V" fica, como o "GTE" da Onça).
Pixel art nítida (lateral 400, frente/traseira 260: shrink de monza_sprites.py).
Máscara de pintura: lataria fora das zonas medidas (faróis, lanternas, piscas, faróis de milha, placa,
grade, vidros, retrovisores, rodas, maçaneta, decalque, escapamento).
Uso: python3 tools/ref/corsa_sprites.py <pasta com side/front/rear.png> <src/assets/cars>   (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink  # noqa: E402
from santana_sprites import tone_map  # noqa: E402
from brand_badges import stamp  # noqa: E402

ID = 'br-corsa'
WIDTH = {'side': 400, 'rear': 260, 'front': 260}
CX = {'front': 835, 'rear': 703}
SIDE_WHEELS, SIDE_R = ((360, 668), (1535, 668)), 105   # (arte original, virada para a direita)


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


ZONES = {
    'side': {'all': [rect(125, 360, 210, 505)],                 # lanterna (maçaneta e decalque saem pela cor)
             'disc': [(1784, 480, 38)]},                        # farol
    'front': {'all': [rect(600, 580, 1065, 660),                # grade
                      rect(690, 680, 985, 795),                 # placa
                      rect(430, 130, 1240, 400)],               # para-brisa e limpadores
              'sym': [rect(350, 535, 585, 650)],                # faróis
              'disc': [(400, 788, 42), (1270, 788, 42), (495, 800, 22)]},
    'rear': {'all': [rect(530, 610, 860, 725),                  # placa
                     rect(660, 495, 745, 590),                  # emblema e fechadura
                     rect(260, 195, 1140, 475),                 # vidro e limpador
                     rect(440, 120, 960, 160)],                 # aerofólio de teto
              'sym': [rect(155, 505, 320, 720),                 # lanternas
                      rect(118, 400, 230, 500)],                # retrovisores
              'disc': [(1065, 880, 34)]},
}
# só o que é vermelho de verdade (lentes das lanternas, letras do decalque) fica fora da conversão para branco
KEEP_RED = {'rear': [[(165, 720), (160, 590), (178, 540), (228, 514), (276, 524), (302, 560), (318, 720)]],
            'front': []}
KEEP_RED_ALL = {}
# decalques "GSI 16V": as letras claras e o contorno preto ficam fora da máscara (o "16V" vermelho vira lataria
# contornada de preto)
DECAL = {'rear': rect(890, 555, 1085, 600), 'front': rect(1070, 690, 1285, 745)}
BOT = {'side': 760, 'front': 874, 'rear': 965}
BADGE = {'front': (835, 622, 9), 'rear': (704, 542, 9)}        # (centro na arte, lado no sprite)
ERASE = {'rear': [(318, 556, 472, 602, (476, 520))]}            # "CORSA": cada linha com a lataria à direita
PLATE = {'rear': (535, 612, 858, 722)}


def segment(a, k):
    if a.shape[2] == 4:
        car = a[..., 3] > 128
        a = a[..., :3]
    else:
        rgb = a.astype(int)
        lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
        bgish = (lum > 200) & (sat < 28)
        n, lab = cv2.connectedComponents(bgish.astype(np.uint8), connectivity=4)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        car = ~np.isin(lab, list(edge))
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(car, 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    n, lab = cv2.connectedComponents((~car).astype(np.uint8), connectivity=4)
    return a, car | (lab != lab[0, 0])


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
    if k == 'side':
        for cx, cy in SIDE_WHEELS:
            cv2.circle(z, (cx, cy), SIDE_R, 1, -1)
    z[BOT[k] + 1:] = 1
    return z > 0


def debrand(a, k):
    for x0, y0, x1, y1, src in ERASE.get(k, []):
        for y in range(y0, y1):
            if src:
                a[y, x0:x1] = np.median(a[y, src[0]:src[1]], axis=0).astype(np.uint8)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    if k == 'front':   # raio da Opel com o aro: grade lisa (o emblema da Vanguarda vai por cima)
        a[np.hypot(xx - 835, yy - 622) <= 40] = np.median(a[600:645, 700:760].reshape(-1, 3), axis=0).astype(np.uint8)
    if k == 'rear':    # plaqueta da tampa (raio e gravata): escura e lisa
        sel = (np.hypot((xx - 704) / 34, (yy - 542) / 44) <= 1)
        a[sel] = np.median(a[505:520, 690:718].reshape(-1, 3), axis=0).astype(np.uint8)
    if k == 'side':    # gravata das calotas: o cinza do miolo
        for cx, cy in SIDE_WHEELS:
            d = np.hypot(xx - cx, yy - cy)
            a[d <= 40] = np.median(a[(d > 44) & (d < 52)], axis=0).astype(np.uint8)
    if k in PLATE:
        x0, y0, x1, y1 = PLATE[k]
        for y in range(y0, y1):   # parafusos da placa somem (a placa do jogo vai por cima)
            row = a[y, x0 + 8:x1 - 8]
            dk = row[row.astype(int).mean(axis=1) < 60]
            if len(dk) > 20:
                a[y, x0 + 8:x1 - 8] = np.median(dk, axis=0).astype(np.uint8)


def smooth_lum(a, sel):
    lum = a.astype(np.float32).mean(axis=2)
    x = np.where(sel, lum, -1000).astype(np.float32)
    for _ in range(2):
        x = cv2.bilateralFilter(x, 15, 22, 7)
        x = np.where(sel, x, -1000).astype(np.float32)
    med = cv2.medianBlur(np.clip(x, 0, 255).astype(np.uint8), 5)
    return np.where(sel, med, lum)


def keep_red(k, shape):
    polys = [np.array(p, float) for p in KEEP_RED_ALL.get(k, [])]
    for p in KEEP_RED.get(k, []):
        p = np.array(p, float)
        polys += [p, np.c_[2 * CX[k] - p[:, 0], p[:, 1]]]
    z = poly_mask(polys, shape)
    z[BOT[k] + 1:] = True
    return z


def red_body(a, car, k):
    hsv = cv2.cvtColor(np.ascontiguousarray(a), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue, sat, val = hsv[..., 0] * 360 / 256, hsv[..., 1], hsv[..., 2]
    zn = keep_red(k, car.shape)
    red = (hue < 16) | (hue > 336)
    m = car & ~zn & red & (sat > 110) & (val > 60)
    for _ in range(4):  # reflexos claros e contorno vermelho-escuro encostados
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= car & ~zn & near & ((red & (sat > 60) & (val > 35)) | ((val > 200) & (sat < 90)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    return np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 30])


def paint_mask(a, car, k):
    rgb = a.astype(int)
    lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    ok = car & ~zone_mask(k, car.shape)
    m = ok & (lum > 95) & (sat < 50)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    for _ in range(6):
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= ok & near & (lum > 60) & (sat < 60)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    return np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 40])


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    data = {}
    for k in ('side', 'front', 'rear'):
        a = np.array(Image.open(os.path.join(src, f'{k}.png')))
        a, car = segment(a, k)
        a = np.ascontiguousarray(a)
        debrand(a, k)
        data[k] = (a, car)
    a, car = data['side']
    ms = paint_mask(a, car, 'side')
    rs = a[ms].astype(float)
    rs = rs[np.argsort(rs.mean(axis=1))]
    print('branco da lateral:', '#%02x%02x%02x' % tuple(int(v) for v in np.median(rs[rs.mean(axis=1) > 180], axis=0)))
    masks, conv = {'side': ms}, {}
    for k in ('front', 'rear'):
        a, car = data[k]
        hsv0 = cv2.cvtColor(np.ascontiguousarray(a), cv2.COLOR_RGB2HSV_FULL).astype(int)
        h0 = hsv0[..., 0] * 360 / 256
        dk = poly_mask([DECAL[k]], car.shape) & car & ~(((h0 < 16) | (h0 > 336)) & (hsv0[..., 1] > 110))
        cm = red_body(a, car, k)
        L = smooth_lum(a, cm)
        b = np.dstack([L] * 3).astype(np.uint8)
        tone_map(b, cm, rs)
        a[cm] = b[cm]
        conv[k] = cm
        masks[k] = (cm | paint_mask(a, car, k)) & ~dk   # (a conversão vale também dentro das zonas: só lanternas e decalque ficam)
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
        if k in BADGE:
            bx, by, size = BADGE[k]
            stamp(s, m8, 'vanguarda', (*to_s(bx, by), size, 0))
        if k == 'side':  # calotas: gravata vira o emblema; depois espelha (frente para a esquerda)
            for cx, cy in SIDE_WHEELS:
                stamp(s, m8, 'vanguarda', (*to_s(cx, cy), 7, 0))
            s = np.ascontiguousarray(s[:, ::-1])
            m8 = np.ascontiguousarray(m8[:, ::-1])
            # o decalque "GSI 16V" tem de continuar legível: a caixa dele volta ao sentido da arte
            (dx0, dy0), (dx1, dy1) = to_s(1112, 582), to_s(1334, 628)
            W = s.shape[1]
            a0, a1 = W - dx1, W - dx0
            s[dy0:dy1, a0:a1] = s[dy0:dy1, a0:a1][:, ::-1].copy()
            m8[dy0:dy1, a0:a1] = m8[dy0:dy1, a0:a1][:, ::-1].copy()
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'{ID}-{k}.png'), optimize=True)
        Image.fromarray(m8, 'L').convert('RGBA').save(os.path.join(out, f'{ID}-{k}-mask.png'), optimize=True)
        print(k, s.shape[1], s.shape[0], 'fator', round(f, 3), 'máscara', int((m8 > 0).sum()))
        if k in PLATE:
            x0, y0, x1, y1 = PLATE[k]
            print('  placa (sprite):', *to_s(x0, y0), *to_s(x1, y1), s.shape[1], s.shape[0])
        if k == 'rear':
            print('  lanterna (u0,f0,u1,f1):', *fr(158, 505), *fr(318, 718), 'pisca', fr(205, 632), 'h/w', round(s.shape[0] / s.shape[1], 3))
        if k == 'front':
            print('  farol (u,f):', *fr(465, 592), 'r', round(110 / f / s.shape[1], 3), 'milha', fr(400, 788), 'h/w', round(s.shape[0] / s.shape[1], 3))
        if k == 'side':
            W = s.shape[1]
            u = lambda x, y: (round(1 - (x - ox) / f / W, 4), round((y - oy) / f / s.shape[0], 4))  # noqa: E731
            print('  rodas (u,v) espelhadas:', [u(cx, cy) for cx, cy in SIDE_WHEELS], 'farol', u(1790, 480), 'lanterna', u(170, 430))
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
