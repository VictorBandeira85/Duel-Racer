"""Sprites do Jornada Sport (VW Voyage Sport 1.8 1992 duas portas, prata, pixel art do Victor), no molde
do irmão Jornada LS (voyage_sprites.py). A lateral (frente para a esquerda) vem recortada (alfa) e corta
o pé dos pneus: é completado (tire_feet). A frente e a traseira vêm com um XADREZ de "transparência"
pintado: o fundo é inundado a partir das bordas (o xadrez é claro, o contorno preto do carro segura;
o vão entre os pneus sai junto, porque é xadrez também).
Marcas reais somem: emblema da grade e da tampa (no lugar entra o da Ipê, stamp de brand_badges.py),
"VOYAGE" da tampa, miolo das rodas e as placas "VOYAGE SPORT" (viram placa lisa escura: a do jogo é
desenhada por cima, PLATE_BOX). "1.8 SPORT" da tampa e "SPORT" da lateral ficam.
Vira pixel art nítida (lateral 400, frente/traseira 260: shrink de monza_sprites.py).
Máscara de pintura: carro PRATA, a cor sozinha não separa a lataria das peças cinzentas (faróis, rodas,
grade, para-choque): a lataria é o cinza AZULADO (azul acima do vermelho) e claro, mais os reflexos
brancos encostados nela, FORA das zonas medidas na arte (faixa dos faróis/lanternas, para-choques,
grade de baixo, neblinas, placa, pneus, escapamento, fechadura, pisca e lanterna da lateral, rodas).
Retrovisores (da cor do carro) e a saia abaixo do para-choque entram.
Uso: python3 tools/ref/voyagesport_sprites.py <pasta com side/front/rear.png> <src/assets/cars>   (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink  # noqa: E402
from brand_badges import stamp  # noqa: E402
import voyage_sprites as V  # noqa: E402

ID = 'br-voyagesport'
WIDTH = V.WIDTH
# lateral: centro das rodas, raio do pneu (zona fora da máscara) e do miolo do aro (emblema)
SIDE_WHEELS, SIDE_R, HUB_R = ((482, 585), (1660, 585)), 152, 30
# a arte da lateral corta o pé dos pneus: círculo do pneu ajustado ao contorno de baixo (cx, cy, raio)
V.TIRE = ((483.3, 567.5, 161.5), (1658.0, 568.0, 161.0))
CX = {'front': 767.5, 'rear': 762}  # eixo de simetria (as zonas de um lado são espelhadas)


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


# zonas fora da máscara (polígonos em pixels da arte); em 'sym' vale também o espelho
ZONES = {
    'front': {'all': [rect(0, 517, 1536, 651),      # faróis, piscas e grade
                      rect(0, 673, 1536, 775),      # para-choque preto
                      rect(430, 783, 1106, 843),    # grade de baixo
                      rect(602, 712, 932, 836),     # placa
                      rect(0, 884, 1536, 1024)],    # pneus e fundo do carro
              'sym': [[(258, 783), (440, 783), (440, 843), (296, 843), (286, 838), (270, 812)],  # neblina
                      [(120, 772), (181, 772), (243, 884), (120, 884)]]},                          # pneu ao lado da saia
    'rear': {'all': [rect(0, 492, 1536, 640),       # lanternas, painel preto e placa
                     rect(0, 684, 1536, 789),       # para-choque
                     rect(0, 882, 1536, 1024)],     # pneus
             'sym': [[(120, 789), (184, 789), (246, 882), (120, 882)]],   # pneu ao lado da saia
             'disc': [(368, 871, 50), (765, 447, 19)]},  # escapamento e fechadura
    'side': {'all': [rect(110, 372, 171, 452),      # pisca dianteiro
                     rect(2031, 342, 2100, 430),    # lanterna
                     # vidros da porta e de trás, pela borracha preta (bancos e tampão cinzentos lá dentro)
                     [(986, 104), (1278, 104), (1297, 289), (868, 289), (868, 227), (963, 126)],
                     [(1328, 107), (1578, 107), (1732, 267), (1718, 292), (1351, 292)]]},
}
# emblema da Ipê: centro (pixels da arte) e lado (pixels do sprite)
BADGE = {'front': (769, 583, 11), 'rear': (300, 457, 9)}
# placas: interior do quadro (pixels da arte); o texto some, fica o fundo escuro de cada linha
PLATE = {'front': (617, 728, 916, 822), 'rear': (613, 535, 909, 624)}


def segment_checker(a):
    """fundo de xadrez claro: tudo o que se alcança das bordas sem cruzar o contorno preto"""
    lum = a.astype(int).mean(axis=2)
    can = np.pad((lum >= 60).astype(np.uint8), 1, constant_values=1)
    n, lab = cv2.connectedComponents(can, connectivity=4)
    car = (lab != lab[0, 0])[1:-1, 1:-1]
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(car, 8)
    return lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))


def debrand(a, k):
    if k in PLATE:  # placa lisa: cada linha recebe a cor do fundo escuro dela
        x0, y0, x1, y1 = PLATE[k]
        for y in range(y0, y1):
            row = a[y, x0:x1]
            dark = row[row.astype(int).mean(axis=1) < 60]
            a[y, x0:x1] = np.median(dark, axis=0).astype(np.uint8) if len(dark) > 20 else (24, 24, 29)
    if k == 'front':
        for y in range(528, 640):  # emblema: cada linha da grade continua (as barras são horizontais)
            a[y, 712:826] = np.median(np.concatenate([a[y, 640:706], a[y, 832:898]]), axis=0).astype(np.uint8)
    elif k == 'rear':
        # emblema e "VOYAGE": a tampa é sombreada em faixas horizontais, cada linha recebe a cor da
        # tampa lisa no meio (entre o "1.8 SPORT" e a fechadura, e depois dela)
        for x0, y0, x1, y1 in ((262, 420, 338, 494), (1046, 432, 1262, 486)):
            for y in range(y0, y1):
                a[y, x0:x1] = np.median(np.concatenate([a[y, 600:720], a[y, 820:1000]]), axis=0).astype(np.uint8)
    else:
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        for cx, cy in SIDE_WHEELS:  # miolo do aro: disco liso da cor do cubo em volta
            d = np.hypot(xx - cx, yy - cy)
            ring = a[(d > HUB_R) & (d < HUB_R + 7)]
            lum = ring.mean(axis=1)
            a[d <= HUB_R] = np.median(ring[lum > np.percentile(lum, 50)], axis=0).astype(np.uint8)


def zone_mask(k, shape):
    z = np.zeros(shape, np.uint8)
    Z = ZONES[k]
    polys = [np.array(p) for p in Z.get('all', [])]
    for p in Z.get('sym', []):
        p = np.array(p, float)
        polys += [p, np.c_[2 * CX[k] - p[:, 0], p[:, 1]]]
    for p in polys:
        cv2.fillPoly(z, [np.round(p).astype(np.int32)], 1)
    for cx, cy, r in Z.get('disc', []):
        cv2.circle(z, (cx, cy), r, 1, -1)
    if k == 'side':
        for cx, cy in SIDE_WHEELS:
            cv2.circle(z, (cx, cy), SIDE_R, 1, -1)
    return z > 0


def glass_zone(a, car):
    """vidros: cada mancha fechada pelo contorno/borracha preta em que o azul do vidro é maioria sai
    inteira (bancos, tampão e reflexos acinzentados vistos pelo vidro passariam por lataria prata)"""
    rgb = a.astype(int)
    lum = rgb.mean(axis=2)
    blue = (rgb[..., 2] - rgb[..., 0] > 45) & (rgb.max(axis=2) - rgb.min(axis=2) > 60)
    n, lab, st, _ = cv2.connectedComponentsWithStats((car & (lum > 45)).astype(np.uint8), 4)
    frac = np.bincount(lab.ravel(), weights=blue.ravel(), minlength=n) / np.maximum(1, st[:, cv2.CC_STAT_AREA])
    frac[0] = 0
    z = (frac > 0.35)[lab]
    return cv2.dilate(z.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0


def paint_mask(a, car, k):
    """lataria prata, medida na arte inteira (antes da paleta curta): cinza azulado e claro fora das
    zonas + reflexos e vincos brancos encostados nela. Na lateral, os filetes claros de dentro da faixa
    preta e do para-choque (cercados de preto por cima e por baixo) ficam de fora."""
    rgb = a.astype(int)
    r, b = rgb[..., 0], rgb[..., 2]
    lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    ok = car & ~zone_mask(k, car.shape) & ~glass_zone(a, car)
    if k == 'side':
        dark = ((lum < 58) & car).astype(np.uint8)
        band = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((27, 1), np.uint8)) > 0
        band[:455], band[533:] = False, False  # só na altura da faixa preta e dos para-choques
        ok &= ~band
    m = ok & (b - r >= 8) & (lum > (64 if k == 'side' else 60)) & (sat < 62)  # a caixa de ar (abaixo do filete) é sombra: fica de fora
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    for _ in range(60):  # reflexos e vincos claros encostados na pintura
        near = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        m |= ok & near & (((lum > 150) & (sat < 40) & (b - r >= -2)) | ((lum > 225) & (sat < 26)))
    return m


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    for k in ('front', 'rear', 'side'):
        im = Image.open(os.path.join(src, f'{k}.png'))
        if k == 'side':
            rgba = V.tire_feet(np.array(im.convert('RGBA')))
            a, car = np.ascontiguousarray(rgba[..., :3]), rgba[..., 3] > 128
            n, lab, st, _ = cv2.connectedComponentsWithStats(car.astype(np.uint8), 8)
            car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
        else:
            a = np.array(im.convert('RGB'))
            car = segment_checker(a)
        debrand(a, k)
        s, (ox, oy, f) = shrink(a, car, WIDTH[k])
        to_s = lambda x, y: (int(round((x - ox) / f)), int(round((y - oy) / f)))
        g8, _ = shrink(np.dstack([paint_mask(a, car, k) * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
        z8, _ = shrink(np.dstack([(zone_mask(k, car.shape) | glass_zone(a, car)) * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
        m = (g8[..., 0] > 127) & (s[..., 3] > 0)
        # pixels soltos da cor da lataria cercados de máscara (sobras do miolo dos blocos) entram
        c = s[..., :3].astype(int)
        body = (s[..., 3] > 0) & (z8[..., 0] < 128) & (c.mean(axis=2) > 70) & (c.max(axis=2) - c.min(axis=2) < 50) & (c[..., 2] >= c[..., 0] - 6)
        for _ in range(2):
            m |= body & ~m & (cv2.filter2D(m.astype(np.uint8), -1, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT) >= 6)
        # bordas claras da lataria encostadas na máscara (meio-tom do contorno): entram, fora das zonas
        edge = (s[..., 3] > 0) & (z8[..., 0] < 128) & (c.max(axis=2) > 150) & (c.max(axis=2) - c.min(axis=2) < 45) & (c[..., 2] >= c[..., 0] - 6)
        m |= edge & (cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
        m8 = (m * 255).astype(np.uint8)
        if k in BADGE:
            bx, by, size = BADGE[k]
            stamp(s, m8, 'ipe', (*to_s(bx, by), size, 0))
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'{ID}-{k}.png'), optimize=True)
        Image.fromarray(m8, 'L').convert('RGBA').save(os.path.join(out, f'{ID}-{k}-mask.png'), optimize=True)
        print(k, s.shape[1], s.shape[0], 'origem', ox, oy, 'fator', round(f, 3), 'máscara', int((m8 > 0).sum()))
        if k in PLATE:
            x0, y0, x1, y1 = PLATE[k]
            print('  placa (sprite):', *to_s(x0, y0), *to_s(x1, y1))
        if dbg:
            v = np.array(Image.fromarray(s).resize((s.shape[1] * 4, s.shape[0] * 4), Image.NEAREST))
            bg = np.zeros_like(v[..., :3]); bg[:] = (0, 200, 0)
            al = v[..., 3:] / 255
            Image.fromarray((v[..., :3] * al + bg * (1 - al)).astype(np.uint8)).save(os.path.join(dbg, f'out-{k}.png'))
            mm = np.array(Image.fromarray(m8).resize((s.shape[1] * 4, s.shape[0] * 4), Image.NEAREST)) > 0
            bl = v[..., :3].copy(); bl[mm] = (40, 70, 230)  # máscara chapada de azul para conferir
            Image.fromarray((bl * al + bg * (1 - al)).astype(np.uint8)).save(os.path.join(dbg, f'blue-{k}.png'))


if __name__ == '__main__':
    main()
