"""Sprites do Passeio GTS (VW Passat GTS Pointer 1985 três portas, pixel art nova do Victor), no molde dos
irmãos VW da mesma época (voyagesport_sprites.py, santana_sprites.py) e do recorte de cenário do Ímola
(monza_sprites.py). Substitui o passat_sprites.py antigo (arte ampliada com grade nativa).
As três vistas vêm com cenário (árvores, muro de pedra, céu, asfalto): o fundo é inundado de fora de
uma caixa em volta do carro (o contorno preto segura; o escuro azulado é sombra do chão e argamassa do
muro, passa). Na lateral o contorno do teto tem um degrau de 1 px azulado onde a inundação vazava para
o capô: é selado (SEAL). Embaixo do carro só ficam os pneus (a sombra e o asfalto saem por geometria).
A antena da lateral fica (faixa fina em volta da haste).
Cores: lateral e traseira PRATA (a de fábrica); a frente veio VERMELHA e é convertida para o prata da
lateral PELO BRILHO (tone_map de santana_sprites.py), menos os piscas âmbar e o filete vermelho do
para-choque (ele é vermelho no carro prata também, como na lateral e na traseira).
Vidros: a paisagem vista pelos vidros (verde, muro) vira cor de vidro pelo brilho; o azul, os bancos e
os fios do desembaçador ficam.
Marcas reais somem: emblema da grade (vira o da Ipê, stamp de brand_badges.py; o "1.8" fica), placa
"GTS" da frente e "L'ART" de trás (viram placa lisa: a do jogo vai por cima, PLATE_BOX), emblema e
"VOLKSWAGEN 2.0" da tampa (Ipê pequeno no lugar), "PASSAT" e "POINTER" da tampa (o "GTS" fica), "POINTER"
da faixa lateral (o "GTS" fica) e o miolo das rodas da lateral (disco liso).
Vira pixel art nítida (lateral 400, frente/traseira 260: shrink de monza_sprites.py).
Máscara de pintura: a lataria prata (cinza azulado claro) com o contorno e os reflexos encostados, fora
das zonas medidas na arte (faróis, piscas, lanternas, grade, para-choques, faixa lateral e frisos de
baixo, placa, vidros, retrovisores pretos, antena, fechadura, rodas).
Uso: python3 tools/ref/passat_sprites2.py <pasta com side/front/rear.png> <src/assets/cars>   (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink  # noqa: E402
from brand_badges import stamp  # noqa: E402
from santana_sprites import tone_map  # noqa: E402

ID = 'br-passat'
WIDTH = {'side': 400, 'rear': 260, 'front': 260}
# caixa em volta do carro (pixels da arte): fora dela o fundo passa livre
BOX = {'side': (80, 270, 1600, 820), 'front': (325, 170, 1345, 870), 'rear': (310, 105, 1360, 905)}
SEAL = {'side': [(1169, 306, 1171, 308)]}  # degrau azulado no contorno do teto (x0, y0, x1, y1)
# linha de baixo da carroceria; abaixo dela só os pneus
BOT = {'side': 727, 'front': 799, 'rear': 811}
# lateral: centro das rodas e raio do pneu; miolo do aro (emblema)
SIDE_WHEELS, SIDE_R, HUB_R = ((381, 704), (1270, 704)), 112, 24
# frente/traseira: faixas dos pneus embaixo da carroceria (x0, x1) e o pé do pneu
TIRES = {'front': ([(352, 490), (1180, 1316)], 868), 'rear': ([(336, 494), (1176, 1336)], 900)}
ANTENNA = ((552, 279), (539, 472))  # haste da antena (topo, base)
CX = {'front': 836, 'rear': 835}  # eixo de simetria (as zonas de um lado são espelhadas)


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


# vidros (polígonos em pixels da arte)
GLASS = {
    'side': [[(626, 468), (745, 337), (956, 335), (956, 468)],             # porta
             [(978, 333), (1132, 333), (1336, 436), (1322, 468), (978, 468)],  # vigia de trás
             [(549, 458), (727, 325), (741, 328), (568, 464)]],           # fio do para-brisa
    'front': [[(572, 206), (1102, 206), (1196, 384), (484, 384)]],
    'rear': [[(546, 140), (1124, 140), (1216, 343), (459, 343)]],
}
# zonas fora da máscara (polígonos em pixels da arte); em 'sym' vale também o espelho
ZONES = {
    'side': {'all': [[(114, 529), (146, 529), (178, 600), (114, 600)],      # pisca dianteiro
                     [(1549, 524), (1574, 524), (1574, 600), (1528, 600)],  # lanterna
                     rect(0, 604, 1672, 941),         # faixa preta (e o filete claro dela) e frisos de baixo
                     rect(0, 598, 292, 941), rect(1362, 596, 1672, 941),  # para-choques
                     [(613, 436), (653, 435), (661, 460), (651, 491), (611, 492), (600, 470)],  # retrovisor
                     rect(884, 494, 960, 512),        # maçaneta (cromo)
                     [(544, 270), (560, 270), (548, 478), (530, 478)]]},  # antena
    'front': {'all': [rect(352, 515, 1320, 624),      # faróis, piscas e grade
                      rect(0, 624, 1672, 941)],       # para-choque, piscas de baixo, placa e pneus
              'sym': [rect(355, 328, 455, 402)]},     # retrovisor preto
    'rear': {'all': [rect(0, 484, 1670, 941)],        # lanternas, painel, placa, para-choque e pneus
             'disc': [(835, 451, 18)]},               # fechadura
}
# emblema da Ipê: centro (pixels da arte) e lado (pixels do sprite)
BADGE = {'front': (838, 570, 13), 'rear': (432, 440, 9)}
# placas: interior do quadro (pixels da arte); o texto some, fica o fundo escuro de cada linha
PLATE = {'front': (736, 682, 944, 746), 'rear': (710, 526, 960, 598)}
# lanternas (pixels da arte, lado esquerdo do sprite): pisca âmbar e as lentes vermelhas
REAR_SIG, REAR_RED = (342, 512, 470, 556), ((404, 583), (528, 560))
FRONT_SIG, FRONT_HEAD = (402, 718, 540, 754), (444, 568, 46)


def segment(a, k):
    rgb = a.astype(int)
    r, b = rgb[..., 0], rgb[..., 2]
    lum = rgb.mean(axis=2)
    H, W = lum.shape
    yy, xx = np.mgrid[0:H, 0:W]
    dark = (lum < 62) & ~((b > r + 18) & (b > 38))
    for x0, y0, x1, y1 in SEAL.get(k, []):
        dark[y0:y1 + 1, x0:x1 + 1] = True
    x0, y0, x1, y1 = BOX[k]
    can = ~dark
    can[:y0], can[y1:], can[:, :x0], can[:, x1:] = True, True, True, True
    n, lab = cv2.connectedComponents(can.astype(np.uint8), connectivity=4)
    car = lab != lab[0, 0]
    # embaixo da carroceria: só os pneus (escuros e sem o azulado da sombra)
    tire = (lum < 70) & ~((b > r + 12) & (b > 25))
    keep = yy <= BOT[k]
    if k == 'side':
        for cx, cy in SIDE_WHEELS:
            keep |= np.hypot(xx - cx, yy - cy) <= SIDE_R
    else:
        spans, foot = TIRES[k]
        for y in range(BOT[k] - 20, foot + 1):
            for sx0, sx1 in spans:
                xs = np.nonzero(tire[y, sx0:sx1 + 1])[0]
                if len(xs) > 8:
                    keep[y, sx0 + xs.min():sx0 + xs.max() + 1] = True
    car &= keep
    g = rgb[..., 1]
    car &= ~((g > r + 12) & (g > b + 6))  # tufos de mato encostados no contorno
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(car, 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    if k == 'side':  # antena: a haste clara e o contorno dela, numa faixa fina em volta da linha
        (ax0, ay0), (ax1, ay1) = ANTENNA
        band = np.zeros((H, W), np.uint8)
        cv2.line(band, (ax0, ay0), (ax1, ay1), 1, 7)
        sat = rgb.max(axis=2) - rgb.min(axis=2)
        car |= (band > 0) & ((lum > 120) | (lum < 50)) & (sat < 40) & ~((b > r + 18) & (lum < 62))
    n, lab = cv2.connectedComponents((~car).astype(np.uint8), connectivity=4)
    return car | (lab != lab[0, 0])  # furos (vidros) entram


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
    return (z > 0) | poly_mask(GLASS[k], shape)


def rowfill(a, x0, y0, x1, y1, src):
    """apaga um letreiro: cada linha recebe a mediana da mesma linha nas colunas de src (lataria lisa)"""
    for y in range(y0, y1):
        a[y, x0:x1] = np.median(np.concatenate([a[y, s0:s1] for s0, s1 in src]), axis=0).astype(np.uint8)


def debrand(a, k):
    if k in PLATE:  # placa lisa: cada linha recebe a cor do fundo escuro dela
        x0, y0, x1, y1 = PLATE[k]
        for y in range(y0, y1):
            row = a[y, x0:x1]
            dark = row[row.astype(int).mean(axis=1) < 50]
            a[y, x0:x1] = np.median(dark, axis=0).astype(np.uint8) if len(dark) > 20 else (22, 22, 26)
    if k == 'front':  # emblema: cada linha da grade continua (as barras são horizontais)
        rowfill(a, 792, 526, 886, 614, [(730, 788), (892, 1040)])
    elif k == 'rear':
        # emblema e "VOLKSWAGEN 2.0"; "PASSAT" e "POINTER" (o "GTS" fica): a tampa é sombreada em
        # faixas horizontais, cada linha recebe a cor da tampa lisa do meio (longe da fechadura)
        mid = [(640, 800), (872, 1020)]
        rowfill(a, 400, 408, 616, 478, mid)
        rowfill(a, 1030, 414, 1184, 450, mid)
        rowfill(a, 1140, 448, 1262, 478, mid)
    else:
        # "POINTER" da faixa: a faixa continua linha a linha (o "GTS" fica)
        rowfill(a, 1036, 612, 1140, 636, [(600, 940)])
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        for cx, cy in SIDE_WHEELS:  # miolo do aro: disco liso da cor do cubo em volta
            d = np.hypot(xx - cx, yy - cy)
            ring = a[(d > HUB_R) & (d < HUB_R + 6)]
            lum = ring.mean(axis=1)
            a[d <= HUB_R] = np.median(ring[lum < np.percentile(lum, 50)], axis=0).astype(np.uint8)


def glass_tone(a, k, car):
    """paisagem vista pelos vidros (verde da grama e das árvores, pedra do muro) vira o azul do próprio
    vidro no mesmo brilho; o azul, os bancos escuros e os fios alaranjados do desembaçador ficam"""
    g = poly_mask(GLASS[k], car.shape) & car
    rgb = a.astype(int)
    r, gg, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = rgb.mean(axis=2)
    blue = g & (b - np.maximum(r, gg) >= 12) & (lum > 50)
    orange = (r - b > 70) & (r > 120)
    land = g & ~blue & ~orange & (lum > 48) & ((gg >= b - 8) | (r >= b - 8))
    ref = rgb[blue]
    ref = ref[np.argsort(ref.mean(axis=1))]
    bins = np.array([np.median(c, axis=0) for c in np.array_split(ref, 32)])
    bl = bins.mean(axis=1)
    lv = lum[land]
    col = np.stack([np.interp(lv, bl, bins[:, i]) for i in range(3)], axis=1)
    a[land] = np.clip(col, 0, 255).astype(np.uint8)


def red_body(a, car):
    """lataria vermelha da frente (com o contorno vermelho-escuro e os reflexos rosados), fora dos piscas
    âmbar, do para-choque com o filete vermelho e dos vidros"""
    rgb = a.astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    hsv = cv2.cvtColor(np.ascontiguousarray(a), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    H, W = r.shape
    yy, xx = np.mgrid[0:H, 0:W]
    redh = (hue < 16) | (hue > 335)
    m = car & redh & (r - np.maximum(g, b) > 30) & (yy < 624)
    # piscas âmbar dos cantos e as lentes dos faróis ficam
    amber = poly_mask([rect(352, 520, 392, 612), rect(1280, 520, 1320, 612)], car.shape)
    m &= ~amber
    # o miolo do para-brisa fica de fora (a beira dele é a moldura vermelha; os reflexos rosados lá
    # dentro viram prata e depois vidro, glass_tone)
    gl = cv2.erode(poly_mask(GLASS['front'], car.shape).astype(np.uint8), np.ones((31, 31), np.uint8)) > 0
    m &= ~gl
    for _ in range(3):  # reflexos claros rosados encostados
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= car & near & (yy < 624) & ~amber & (r - b > 18) & (r > 150) & ~gl
    return m


def paint_mask(a, car, k):
    """lataria prata: cinza azulado e claro fora das zonas + contorno do mesmo tom encostado e os
    reflexos brancos"""
    rgb = a.astype(int)
    r, b = rgb[..., 0], rgb[..., 2]
    lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    ok = car & ~zone_mask(k, car.shape)
    m = ok & (b - r >= 6) & (lum > 95) & (sat < 70)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    for _ in range(4):  # contorno e meio-tom do mesmo cinza azulado
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= ok & near & (b - r >= 4) & (lum > 60) & (sat < 70)
    for _ in range(60):  # reflexos e vincos claros encostados
        near = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        new = ok & near & ~m & (lum > 170) & (sat < 45)
        if not new.any():
            break
        m |= new
    return m


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    data = {}
    for k in ('side', 'front', 'rear'):
        a = np.array(Image.open(os.path.join(src, f'{k}.png')).convert('RGB'))
        car = segment(a, k)
        debrand(a, k)
        data[k] = (a, car)
    # prata de referência: a lataria "cheia" da lateral, ordenada pelo brilho
    a, car = data['side']
    ms = paint_mask(a, car, 'side')
    rs = a[ms & (a.astype(int).mean(axis=2) < 235)].astype(float)
    rs = rs[np.argsort(rs.mean(axis=1))]
    print('prata da lateral (mediana da lataria):', '#%02x%02x%02x' % tuple(int(v) for v in np.median(rs, axis=0)))
    masks, conv = {'side': ms}, {}
    a, car = data['front']
    conv['front'] = red_body(a, car)
    tone_map(a, conv['front'], rs)
    # o vermelho da arte é mais sombreado que o prata da lateral/traseira (capô e para-lamas saíam
    # cinza-chumbo): clareia o convertido puxando para o branco (mediana ~176 -> ~190, como atrás)
    cf = conv['front']
    a[cf] = (255 - (255 - a[cf].astype(float)) * 0.8).astype(np.uint8)
    for k in ('side', 'front', 'rear'):
        a, car = data[k]
        glass_tone(a, k, car)
        if k != 'side':
            masks[k] = paint_mask(a, car, k) | (conv.get(k, np.zeros(car.shape, bool)) & ~zone_mask(k, car.shape))
    for k in ('front', 'rear', 'side'):
        a, car = data[k]
        s, (ox, oy, f) = shrink(a, car, WIDTH[k])
        to_s = lambda x, y: (int(round((x - ox) / f)), int(round((y - oy) / f)))
        fr = lambda x, y: (round((x - ox) / f / s.shape[1], 4), round((y - oy) / f / s.shape[0], 4))
        g8, _ = shrink(np.dstack([masks[k] * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
        z8, _ = shrink(np.dstack([zone_mask(k, car.shape) * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
        m = (g8[..., 0] > 127) & (s[..., 3] > 0)
        free = z8[..., 0] < 128
        c = s[..., :3].astype(int)
        silver = (s[..., 3] > 0) & free & (c.mean(axis=2) > 70) & (c.max(axis=2) - c.min(axis=2) < 60) & (c[..., 2] >= c[..., 0])
        for _ in range(2):  # pixels soltos da cor da lataria cercados de máscara (sobras do miolo dos blocos)
            m |= silver & ~m & (cv2.filter2D(m.astype(np.uint8), -1, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT) >= 5)
        # (na beira das zonas também: a zona é medida com folga e a beira dela ainda é lataria)
        free1 = cv2.erode(free.astype(np.uint8) ^ 1, np.ones((3, 3), np.uint8)) == 0
        edge = (s[..., 3] > 0) & free1 & (c.max(axis=2) > 150) & (c.max(axis=2) - c.min(axis=2) < 50) & (c[..., 2] >= c[..., 0] - 4)
        m |= edge & (cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
        if k == 'front':  # prata convertido em tons chapados (pixel a pixel deixava chuvisco)
            cm, _ = shrink(np.dstack([conv['front'] * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
            sel = (cm[..., 0] > 127) & (s[..., 3] > 0)
            lab = cv2.cvtColor(np.ascontiguousarray(s[..., :3]), cv2.COLOR_RGB2LAB).astype(np.float32)
            cv2.setRNGSeed(7)
            _, lbl, cen = cv2.kmeans(lab[sel], 14, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.2), 3, cv2.KMEANS_PP_CENTERS)
            q = lab.copy()
            q[sel] = cen[lbl.ravel()]
            s[..., :3][sel] = cv2.cvtColor(np.clip(q, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)[sel]
        m8 = (m * 255).astype(np.uint8)
        if k in BADGE:
            bx, by, size = BADGE[k]
            stamp(s, m8, 'ipe', (*to_s(bx, by), size, 0))
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'{ID}-{k}.png'), optimize=True)
        Image.fromarray(m8, 'L').convert('RGBA').save(os.path.join(out, f'{ID}-{k}-mask.png'), optimize=True)
        print(k, s.shape[1], s.shape[0], 'origem', ox, oy, 'fator', round(f, 3), 'máscara', int((m8 > 0).sum()))
        if k in PLATE:
            x0, y0, x1, y1 = PLATE[k]
            print('  placa (sprite):', *to_s(x0, y0), *to_s(x1, y1), s.shape[1], s.shape[0])
        if k == 'rear':
            x0, y0, x1, y1 = REAR_SIG
            print('  pisca (u0, f0, u1, f1):', *fr(x0, y0), *fr(x1, y1), 'lentes vermelhas:', [fr(*p) for p in REAR_RED])
        if k == 'front':
            x0, y0, x1, y1 = FRONT_SIG
            hx, hy, hr = FRONT_HEAD
            print('  farol (u, f, r):', *fr(hx, hy), round(hr / f / s.shape[1], 3), 'pisca:', *fr(x0, y0), *fr(x1, y1))
        if k == 'side':
            print('  rodas (u, v):', [fr(cx, cy) for cx, cy in SIDE_WHEELS])
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
