"""Sprites do Savana GLS (VW Santana GLS 2.0 1990 duas portas, pixel art do Victor), no molde dos irmãos
Jornada LS / Jornada Sport (voyage_sprites.py, voyagesport_sprites.py).
Cada vista veio numa COR: lateral bege (a cor de fábrica no jogo), traseira cinza-chumbo e frente
azul-marinho. A lataria da frente e da traseira é convertida para o bege da lateral PELO BRILHO: cada
pixel da pintura (o tom azulado da lataria, fora das zonas de vidros, faróis, lanternas, grade,
para-choques e placa) recebe o bege da lateral que tem a mesma posição na escala de tons (quantis da
lataria de uma vista contra os da outra), como em monzasedan_sprites.py. O contorno escuro azulado da
lataria vai junto (senão sobra um fio azul em volta do bege). A saia de baixo da frente (azul na arte)
vira o cinza-grafite do para-choque, como ela é na lateral.
Recorte: a lateral e a traseira vêm recortadas (alfa); a frente vem em fundo escuro em degradê com
halo: o fundo é inundado de fora para dentro (o contorno preto do carro segura) e embaixo da saia só as
faixas dos pneus ficam (a sombra sai por geometria). O pé dos pneus da lateral vem achatado (o apoio no
chão, menos de 1 px do sprite): fica como está.
Marcas reais somem: emblema da grade e da faixa traseira (no lugar entra o da Ipê, stamp de
brand_badges.py), "VOLKSWAGEN" e "SANTANA" da faixa traseira (o "GLS" fica) e o miolo das rodas da
lateral (disco liso). O "GLS" da lateral fica. Placas já vêm lisas (a do jogo vai por cima: PLATE_BOX).
Vira pixel art nítida (lateral 400, frente/traseira 260: shrink de monza_sprites.py).
Máscara de pintura: a lataria (bege na lateral; o tom azulado convertido na frente/traseira) com o
contorno escuro da mesma cor e os reflexos brancos encostados nela, fora das zonas medidas na arte.
Retrovisores (prata na frente, pretos na lateral) ficam de fora.
Uso: python3 tools/ref/santana_sprites.py <pasta com side/front/rear.png> <src/assets/cars>   (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink  # noqa: E402
from brand_badges import stamp  # noqa: E402

ID = 'br-santana'
WIDTH = {'side': 400, 'rear': 260, 'front': 260}
# lateral: centro das rodas (pelo miolo escuro do emblema), raio do pneu (zona fora da máscara) e do miolo
SIDE_WHEELS, SIDE_R, HUB_R = ((466.5, 571.6), (1629.2, 571.3)), 152, 27
# frente: linha de baixo da saia; abaixo dela só as faixas dos pneus, até o pé do pneu
F_CUT = (858, 958, [(228, 372), (1158, 1302)])
F_BOX = (100, 60, 1440, 1000)  # fora desta caixa o fundo passa livre (o degradê chega a preto nos cantos)
F_CLIP = (186, 112, 1350)  # o carro fica dentro destes limites (x0, y0, x1): o preto entre o halo e a caixa sai
F_SKIRT = 768  # da frente: abaixo do para-choque, o azul da saia vira grafite (na lateral ela é escura)
CX = {'front': 767, 'rear': 767}  # eixo de simetria (as zonas de um lado são espelhadas)


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


# zonas fora da máscara (polígonos em pixels da arte); em 'sym' vale também o espelho
ZONES = {
    'front': {'all': [rect(236, 536, 1298, 645),     # faróis, auxiliares e grade
                      rect(0, 645, 1536, 1024),      # para-choque, piscas, placa, saia e pneus
                      # para-brisa inteiro pela borracha (bancos e volante lá dentro são azulados)
                      [(452, 160), (1082, 160), (1192, 392), (342, 392)]],
              'sym': [rect(222, 312, 336, 396)]},     # retrovisor prata
    'rear': {'all': [rect(0, 500, 1536, 1024),       # lanternas, painel, placa, faixa, para-choque, pneus
                     [(442, 178), (1092, 178), (1228, 380), (306, 380)]],  # vidro de trás pela borracha
             'disc': [(765, 474, 20)]},                # fechadura
    'side': {'all': [rect(78, 356, 136, 448),        # farol (e o friso embaixo dele)
                     rect(2036, 312, 2108, 411),     # lanterna
                     rect(40, 444, 345, 610),        # para-choque dianteiro
                     rect(1745, 444, 2135, 610),     # para-choque traseiro
                     rect(612, 450, 1480, 501),      # faixa preta com o "GLS" (e o filete claro dela)
                     rect(612, 554, 1480, 610)]},    # soleira preta (e o filete claro dela)
}
# emblema da Ipê: centro (pixels da arte) e lado (pixels do sprite)
BADGE = {'front': (767, 593, 15), 'rear': (235, 650, 9)}
# placa traseira: interior do quadro (pixels da arte), para PLATE_BOX
PLATE = {'rear': (618, 529, 916, 612)}


def segment_front(a):
    lum = a.astype(int).mean(axis=2)
    H, W = lum.shape
    yy, xx = np.mgrid[0:H, 0:W]
    y0, y1, spans = F_CUT
    bx0, by0, bx1, by1 = F_BOX
    # fundo: tudo o que se alcança de fora da caixa sem cruzar o contorno preto (o halo em volta é
    # mais claro que ele; fora da caixa o degradê chega a preto e passa livre)
    can = a.max(axis=2) >= 8
    can[:by0], can[by1:], can[:, :bx0], can[:, bx1:] = True, True, True, True
    n, lab = cv2.connectedComponents(can.astype(np.uint8), connectivity=4)
    car = lab != lab[0, 0]
    car &= (xx >= F_CLIP[0]) & (xx <= F_CLIP[2]) & (yy >= F_CLIP[1])
    # embaixo da saia o fundo é tão escuro quanto o contorno: ficam só os pneus, fechados linha a linha
    car &= yy <= y0
    for y in range(y0 - 30, y1):
        for x0, x1 in spans:
            xs = np.nonzero(lum[y, x0:x1 + 1] > 22)[0]
            if len(xs) > 8:
                car[y, max(x0, x0 + xs.min() - 5):min(x1, x0 + xs.max() + 5) + 1] = True
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(car, 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    n, lab = cv2.connectedComponents((~car).astype(np.uint8), connectivity=4)
    return car | (lab != lab[0, 0])


def debrand(a, k):
    if k == 'front':
        for y in range(546, 640):  # emblema: cada linha da grade continua (as barras são horizontais)
            a[y, 718:818] = np.median(np.concatenate([a[y, 660:712], a[y, 824:876]]), axis=0).astype(np.uint8)
    elif k == 'rear':
        # emblema, "VOLKSWAGEN" e "SANTANA": a faixa preta é frisada na horizontal, cada linha recebe a
        # cor da faixa lisa do meio (o "GLS" fica)
        for x0, x1 in ((206, 468), (1044, 1244)):
            for y in range(626, 676):
                a[y, x0:x1] = np.median(a[y, 520:1000], axis=0).astype(np.uint8)
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
            cv2.circle(z, (int(round(cx)), int(round(cy))), SIDE_R, 1, -1)
    return z > 0


def glass_zone(a, car):
    """vidros da lateral: cada mancha fechada pelo contorno/borracha preta em que o azul do vidro é
    maioria sai inteira (bancos e reflexos acinzentados vistos pelo vidro)"""
    rgb = a.astype(int)
    lum = rgb.mean(axis=2)
    blue = (rgb[..., 2] - rgb[..., 0] > 30) & (rgb.max(axis=2) - rgb.min(axis=2) > 40)
    n, lab, st, _ = cv2.connectedComponentsWithStats((car & (lum > 45)).astype(np.uint8), 4)
    frac = np.bincount(lab.ravel(), weights=blue.ravel(), minlength=n) / np.maximum(1, st[:, cv2.CC_STAT_AREA])
    frac[0] = 0
    z = (frac > 0.35)[lab]
    return cv2.dilate(z.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0


def grow_white(m, ok, lum, sat):
    for _ in range(60):  # reflexos e vincos claros encostados na pintura
        near = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        new = ok & near & ~m & (lum > 200) & (sat < 34)
        if not new.any():
            break
        m |= new
    return m


def paint_side(a, car):
    """lataria bege: tom quente (vermelho acima do azul) e pouco colorido; o contorno escuro do mesmo
    tom encostado nela entra (bordas que ficariam bege com outra cor), e os reflexos brancos também"""
    rgb = a.astype(int)
    r, b = rgb[..., 0], rgb[..., 2]
    lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    ok = car & ~zone_mask('side', car.shape) & ~glass_zone(a, car)
    m = ok & (r - b >= 12) & (lum > 95) & (sat < 70)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    for _ in range(4):  # contorno e meio-tom escuro do mesmo bege, encostados
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= ok & near & (r - b >= 8) & (lum > 40)
    return grow_white(m, ok, lum, sat)


def paint_blue(a, car, k):
    """lataria azulada (chumbo atrás, marinho na frente): o azul acima do vermelho e do verde (o vidro
    é ciano: verde bem acima do vermelho), fora das zonas, mais o contorno azulado e os reflexos"""
    rgb = a.astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    ok = car & ~zone_mask(k, car.shape)
    tone = (b - np.maximum(r, g) >= (14 if k == 'rear' else 25)) & (g - r < 30)
    m = ok & tone & (lum > (60 if k == 'rear' else 35))
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    for _ in range(4):  # contorno azulado escuro encostado
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= ok & near & (b - np.maximum(r, g) >= 6) & (g - r < 30) & (lum > 14)
    m = grow_white(m, ok, lum, sat)
    # o que vira bege: a máscara + todo pixel azulado da lataria (vincos e contorno escuros, o fio azul
    # entre faróis e grade); na frente, nas zones de faróis e grade só o azul escuro, e nunca o vidro,
    # o retrovisor prata, o para-choque e a saia
    loose = (b - np.maximum(r, g) >= 8) & (g - r < 30) & (lum > 8)
    if k == 'front':
        Z = ZONES['front']
        hard = np.zeros(car.shape, np.uint8)
        polys = [np.array(Z['all'][1]), np.array(Z['all'][2])] + [np.array(p) for p in Z['sym']]
        polys.append(np.c_[2 * CX[k] - np.array(Z['sym'][0])[:, 0], np.array(Z['sym'][0])[:, 1]])
        for p in polys:
            cv2.fillPoly(hard, [np.round(p).astype(np.int32)], 1)
        conv = car & (hard == 0) & loose & (ok | (lum < 120))
    else:
        conv = ok & loose
    return m, conv | (m & ~((lum > 200) & (sat < 34)))


def tone_map(a, m, ref):
    """pinta os pixels de m com o bege de ref (cores da lateral ordenadas pelo brilho) na mesma
    posição da escala de tons; o que for mais escuro que o tom mais escuro da lataria escurece junto"""
    lum = a[m].astype(float).mean(axis=1)
    q = np.linspace(0, 1, 49)
    src = np.quantile(lum, q)
    rl = ref.mean(axis=1)
    bins = np.array([np.median(c, axis=0) for c in np.array_split(ref, 48)])
    bl = np.array([c.mean() for c in bins])
    # cada tom da arte -> quantil -> brilho da lateral naquele quantil -> bege daquele brilho
    t = np.interp(lum, src, q)
    tl = np.interp(t, q, np.quantile(rl, q))
    col = np.stack([np.interp(tl, bl, bins[:, i]) for i in range(3)], axis=1)
    dark = lum < src[0]  # abaixo do mais escuro: o bege mais escuro na proporção
    col[dark] = bins[0] * (lum[dark] / max(1.0, src[0]))[:, None]
    a[m] = np.clip(col, 0, 255).astype(np.uint8)


def skirt_gray(a, car, ref_gray):
    """saia azul da frente (abaixo do para-choque) vira o grafite do para-choque, no mesmo brilho"""
    rgb = a.astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    yy = np.mgrid[0:a.shape[0], 0:a.shape[1]][0]
    sel = car & (yy >= F_SKIRT) & (yy <= F_CUT[0] + 4) & (b - np.maximum(r, g) >= 10)
    lum = rgb[sel].mean(axis=1)
    k = ref_gray / ref_gray.mean()
    a[sel] = np.clip(lum[:, None] * k[None], 0, 255).astype(np.uint8)


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    data = {}
    for k in ('side', 'front', 'rear'):
        im = Image.open(os.path.join(src, f'{k}.png'))
        if k == 'front':
            a = np.array(im.convert('RGB'))
            car = segment_front(a)
        else:
            rgba = np.array(im.convert('RGBA'))
            a, car = np.ascontiguousarray(rgba[..., :3]), rgba[..., 3] > 128
            n, lab, st, _ = cv2.connectedComponentsWithStats(car.astype(np.uint8), 8)
            car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
            n, lab = cv2.connectedComponents((~car).astype(np.uint8), connectivity=4)
            car |= lab != lab[0, 0]
        debrand(a, k)
        data[k] = (a, car)
    # lateral: referência do bege (só a lataria "cheia", sem o contorno e os reflexos brancos)
    a, car = data['side']
    ms = paint_side(a, car)
    rs = a[ms].astype(float)
    rs = rs[np.argsort(rs.mean(axis=1))]
    masks = {'side': ms}
    for k in ('front', 'rear'):
        a, car = data[k]
        if k == 'front':
            fb = a[690:760, 420:600].reshape(-1, 3).astype(float)  # grafite do para-choque
            skirt_gray(a, car, np.median(fb, axis=0))
        mb, conv = paint_blue(a, car, k)
        tone_map(a, conv, rs)  # os reflexos brancos ficam brancos
        masks[k] = mb | conv
    print('bege da lateral (mediana da lataria):', '#%02x%02x%02x' % tuple(int(v) for v in np.median(rs, axis=0)))
    for k in ('front', 'rear', 'side'):
        a, car = data[k]
        s, (ox, oy, f) = shrink(a, car, WIDTH[k])
        to_s = lambda x, y: (int(round((x - ox) / f)), int(round((y - oy) / f)))
        g8, _ = shrink(np.dstack([masks[k] * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
        z8, _ = shrink(np.dstack([zone_mask(k, car.shape) * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
        m = (g8[..., 0] > 127) & (s[..., 3] > 0)
        # pixels soltos da cor da lataria cercados de máscara (sobras do miolo dos blocos) entram
        c = s[..., :3].astype(int)
        beige = (s[..., 3] > 0) & (z8[..., 0] < 128) & (c[..., 0] - c[..., 2] >= 6) & (c.mean(axis=2) > 50) & (c.max(axis=2) - c.min(axis=2) < 70)
        for _ in range(2):
            m |= beige & ~m & (cv2.filter2D(m.astype(np.uint8), -1, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT) >= 5)
        if k != 'side':  # bege convertido em tons chapados (pixel a pixel deixava chuvisco): 14 tons
            lab = cv2.cvtColor(np.ascontiguousarray(s[..., :3]), cv2.COLOR_RGB2LAB)
            sm = cv2.medianBlur(lab, 3).astype(np.float32)
            cv2.setRNGSeed(7)
            _, lbl, cen = cv2.kmeans(sm[m], 14, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.2), 3, cv2.KMEANS_PP_CENTERS)
            q = sm.copy()
            q[m] = cen[lbl.ravel()]
            s[..., :3][m] = cv2.cvtColor(np.clip(q, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)[m]
        m8 = (m * 255).astype(np.uint8)
        if k in BADGE:
            bx, by, size = BADGE[k]
            stamp(s, m8, 'ipe', (*to_s(bx, by), size, 0))
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'{ID}-{k}.png'), optimize=True)
        Image.fromarray(m8, 'L').convert('RGBA').save(os.path.join(out, f'{ID}-{k}-mask.png'), optimize=True)
        print(k, s.shape[1], s.shape[0], 'origem', ox, oy, 'fator', round(f, 3), 'máscara', int((m8 > 0).sum()))
        fr = lambda x, y: (round((x - ox) / f / s.shape[1], 4), round((y - oy) / f / s.shape[0], 4))
        if k in PLATE:
            x0, y0, x1, y1 = PLATE[k]
            print('  placa (sprite):', *to_s(x0, y0), *to_s(x1, y1), s.shape[1], s.shape[0])
        if k == 'rear':
            print('  lentes vermelhas (u, f):', [fr(x, 566) for x in (312, 457)], 'pisca:', fr(182, 520), fr(274, 610))
        if k == 'front':
            print('  farol (u, f, r):', fr(310, 590), round(66 / f / s.shape[1], 3), 'pisca:', fr(242, 702), fr(378, 738))
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
