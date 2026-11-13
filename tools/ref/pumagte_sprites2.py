"""Sprites da Onça GTE (Puma GTE 1974, pixel art nova do Victor), no molde do Passeio GTS
(passat_sprites2.py) e do recorte de cenário do Ímola (monza_sprites.py). Substitui o onca_gte_sprites.py
antigo (arte ampliada com grade nativa).
As três vistas vêm com cenário (árvores, muro de pedra, céu, asfalto/piso de blocos): o fundo é inundado
de fora de uma caixa em volta do carro (o contorno preto segura; o escuro azulado é sombra do chão e
passa). O letreiro "PUMA GTE 1974" da lateral fica fora da caixa e some com o fundo. Embaixo da
carroceria só ficam os pneus (a sombra e o piso saem por geometria): na lateral, o círculo do pneu; na
frente e atrás, cada linha do pneu vai do contorno preto de fora até a beira de dentro medida (o lado de
dentro encosta na sombra escura do chão). Atrás, o escapamento fica.
Cores: a lateral é BRANCA (a de fábrica: mediana da lataria, `color` em carsbr.ts); frente e traseira
vieram TURQUESA e são convertidas para o branco da lateral PELO BRILHO (tone_map de santana_sprites.py),
com o brilho alisado antes dentro da pintura (filtro bilateral, como countach_sprites.py: sem o grão da
arte) e chapado em poucos tons depois da redução (faixas lisas, sem chuvisco).
Vidros: a paisagem vista pelo vidro traseiro (verde, muro) vira cor de vidro pelo brilho.
Marcas reais somem: o gato do capô vira o emblema da Onça (stamp de brand_badges.py), o "Puma" da tampa
traseira vira lataria (o "GTE" fica; a bandeirinha do Brasil também) e as placas "L'ART" viram placa lisa
(a do jogo vai por cima, PLATE_BOX).
Vira pixel art nítida (lateral 400, frente/traseira 260: shrink de monza_sprites.py).
Máscara de pintura: a lataria branca (e a convertida) com o contorno e os reflexos encostados, fora das
zonas medidas na arte (faróis, piscas, lanternas, para-choques e frisos cromados, placa, vidros e
molduras, retrovisores cromados, grades, escapamento, fechadura, bandeirinha, letreiro, rodas).
Uso: python3 tools/ref/pumagte_sprites2.py <pasta com side/front/rear.png> <src/assets/cars>   (DBG=<pasta>)
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

ID = 'br-pumagte'
WIDTH = {'side': 400, 'rear': 260, 'front': 260}
# caixa em volta do carro (pixels da arte): fora dela o fundo passa livre
BOX = {'side': (70, 328, 1600, 820), 'front': (225, 165, 1310, 935), 'rear': (180, 150, 1360, 935)}
# linha de baixo da carroceria; abaixo dela só os pneus (e o escapamento de trás)
BOT = {'side': 732, 'front': 843, 'rear': 826}
# lateral: centro das rodas e raio do pneu
SIDE_WHEELS, SIDE_R, ARCH_R = ((391, 682), (1210, 682)), 124, 160  # (e o raio da caixa de roda)
# frente/traseira: pneus (borda de fora, borda de dentro, lado de fora) e o pé do pneu
TIRES = {'front': ([(248, 404, 'L'), (1124, 1282, 'R')], 926),
         'rear': ([(190, 372, 'L'), (1166, 1342, 'R')], 930)}
EXHAUST = (1125, 806, 42)  # escapamento da traseira (centro e raio)
NOPASS = {'side': [(770, 330, 860, 380)], 'front': [(925, 168, 955, 188)]}  # degraus azul-escuros no contorno do teto (x0, y0, x1, y1)
CX = {'front': 768, 'rear': 768}  # eixo de simetria (as zonas de um lado são espelhadas)


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


# vidros com as molduras cromadas (polígonos em pixels da arte)
GLASS = {
    'side': [[(618, 480), (800, 351), (838, 364), (808, 482)],              # para-brisa e quebra-vento
             [(803, 482), (840, 363), (1040, 364), (1028, 482)]],           # janela da porta
    'front': [[(402, 198), (1134, 198), (1148, 404), (388, 404)]],
    'rear': [[(440, 178), (1100, 178), (1120, 360), (420, 360)]],
}
# zonas fora da máscara (polígonos em pixels da arte); em 'sym' vale também o espelho
ZONES = {
    'side': {'all': [[(186, 526), (213, 517), (208, 549), (187, 581), (179, 566)],  # farol (lente na ponta do para-lama)
                     rect(70, 620, 228, 662), rect(1520, 618, 1600, 662),  # para-choques
                     [(702, 457), (750, 457), (752, 501), (724, 501), (724, 515), (686, 515), (686, 499), (702, 494)],  # retrovisor
                     rect(1420, 688, 1500, 722)],                         # escapamento
             'disc': [(985, 530, 13)]},                                   # fechadura
    'front': {'all': [rect(588, 396, 952, 430),                           # grade do capô
                      rect(630, 696, 910, 804)],                          # placa
              'sym': [rect(286, 330, 374, 414),                           # retrovisor
                      rect(244, 672, 630, 750)],                          # para-choque
              'disc': [(372, 572, 72), (1165, 572, 72), (502, 652, 34), (1035, 652, 34)]},  # faróis e piscas
    'rear': {'all': [rect(474, 384, 1062, 440),                           # grade da tampa
                     rect(884, 544, 956, 600),                            # bandeirinha
                     rect(606, 614, 930, 750),                            # placa
                     rect(450, 772, 1070, 812)],                          # saídas de ar de baixo
             'sym': [rect(304, 544, 568, 650),                            # lanterna
                     rect(272, 652, 592, 706),                            # para-choque
                     rect(268, 318, 336, 386),                            # retrovisor
                     rect(508, 346, 542, 376)],                           # dobradiça da tampa
             'disc': [EXHAUST]},
}
# retrovisores cromados (pixels da arte; refletem o turquesa: ficam como estão)
MIRRORS = {'front': [rect(286, 330, 374, 414), rect(1162, 330, 1250, 414)],
           'rear': [rect(268, 318, 336, 386), rect(1200, 318, 1268, 386)]}
KEEP_HUE = {'rear': [(884, 544, 956, 600)]}  # bandeirinha do Brasil (verde e azul de verdade)
# emblema da Onça: centro (pixels da arte) e lado (pixels do sprite)
BADGE = {'front': (771, 653, 9), 'rear': (1010, 468, 9)}  # (atrás, no lugar do letreiro da tampa)
# placas: interior do quadro (pixels da arte); o texto some, fica o fundo escuro de cada linha
PLATE = {'front': (645, 712, 893, 786), 'rear': (637, 643, 898, 724)}
PLATE_FRAME = {'rear': (630, 630, 905, 731)}  # placa do jogo (PLATE_BOX)
# lâmpadas (pixels da arte, lado esquerdo do sprite)
FRONT_HEAD, FRONT_SIG = (372, 572, 58), (502, 652, 27)
REAR_SIG, REAR_RED = (492, 560, 554, 636), (405, 598)


def segment(a, k):
    rgb = a.astype(int)
    r, b = rgb[..., 0], rgb[..., 2]
    lum = rgb.mean(axis=2)
    H, W = lum.shape
    yy, xx = np.mgrid[0:H, 0:W]
    # contorno preto; o escuro azulado (sombra do chão, sombra da sebe) e o marrom escuro (argamassa do
    # muro) passam, menos dentro das caixas de roda da lateral: o azul-marinho delas encosta direto na
    # lataria branca, sem contorno
    g = rgb[..., 1]  # (o turquesa-escuro do contorno da frente e da traseira tem verde quase igual ao azul: segura)
    passes = ((b > r + 18) & (b > 38) & (g < 0.6 * b)) | ((r > b + 15) & (lum > 25))
    if k == 'side':
        for cx, cy in SIDE_WHEELS:
            passes &= ~((np.hypot(xx - cx, yy - cy) <= ARCH_R) & (yy <= BOT[k]))
    # (nem nas bordas azul-escuras dos vidros, encostadas no contorno do teto)
    passes &= ~(cv2.dilate(poly_mask(GLASS[k], lum.shape).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0)
    passes &= ~poly_mask([rect(*z) for z in NOPASS.get(k, [])], lum.shape)
    dark = (lum < 62) & ~passes
    x0, y0, x1, y1 = BOX[k]
    can = ~dark
    can[:y0], can[y1:], can[:, :x0], can[:, x1:] = True, True, True, True
    n, lab = cv2.connectedComponents(can.astype(np.uint8), connectivity=4)
    car = lab != lab[0, 0]
    keep = yy <= BOT[k]
    if k == 'side':
        for cx, cy in SIDE_WHEELS:
            keep |= np.hypot(xx - cx, yy - cy) <= SIDE_R
    else:
        spans, foot = TIRES[k]
        for y in range(BOT[k] - 30, foot + 1):
            for sx0, sx1, side in spans:
                row = lum[y, sx0:sx1 + 1]
                xs = np.nonzero(row < 30)[0]  # contorno preto do pneu (lado de fora)
                if len(xs) < 3:
                    continue
                if side == 'L':
                    keep[y, sx0 + xs.min():sx1 + 1] = True
                else:
                    keep[y, sx0:sx0 + xs.max() + 1] = True
        if k == 'rear':
            ex, ey, er = EXHAUST
            keep |= np.hypot(xx - ex, yy - ey) <= er
        car = car | (keep & (yy > BOT[k]))  # pneu: mesmo encostado na sombra
    car &= keep
    g = rgb[..., 1]
    car &= ~((g > r + 12) & (g > b + 6) & (g - b > 0) & ~((b > 90) & (g > 90) & (r < 80)))  # mato (o turquesa fica)
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(car, 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
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
    else:
        z[BOT[k] + 1:] = 1  # pneus
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
    if k == 'front':  # gato do capô: o capô é sombreado em faixas horizontais
        rowfill(a, 744, 630, 800, 678, [(700, 740), (804, 844)])
    elif k == 'rear':
        # "Puma GTE" (manuscrito com o P vermelho): a tampa continua linha a linha (o "GTE" sozinho virava
        # um rabisco no sprite: o emblema da Onça vai no lugar, BADGE)
        rowfill(a, 908, 448, 1116, 490, [(700, 900)])
        # retrovisores cromados refletindo o céu (azul-turquesa no carro branco): cromo cinza pelo brilho
        rgb = a.astype(float)
        for x0, y0, x1, y1 in [(268, 318, 336, 386), (1200, 318, 1268, 386)]:
            sub = rgb[y0:y1, x0:x1]
            sat = sub.max(axis=2) - sub.min(axis=2)
            l = sub.mean(axis=2)
            sel = (sat > 40) & (sub[..., 2] > sub[..., 0] + 30)
            sub[sel] = np.stack([l * 0.94, l * 0.97, l * 1.04], axis=-1)[sel]
            a[y0:y1, x0:x1] = np.clip(sub, 0, 255).astype(np.uint8)


def smooth_lum(a, sel):
    """brilho da pintura sem o grão da arte (como countach_sprites.py): bilateral só dentro da pintura,
    que guarda vincos, contornos e reflexos fortes; depois mediana"""
    lum = a.astype(np.float32).mean(axis=2)
    x = np.where(sel, lum, -1000).astype(np.float32)
    for _ in range(2):
        x = cv2.bilateralFilter(x, 15, 22, 7)
        x = np.where(sel, x, -1000).astype(np.float32)
    med = cv2.medianBlur(np.clip(x, 0, 255).astype(np.uint8), 5)
    return np.where(sel, med, lum)


def teal_body(a, car, k):
    """lataria turquesa (com o contorno turquesa-escuro e os reflexos claros encostados), fora das zonas"""
    hsv = cv2.cvtColor(np.ascontiguousarray(a), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue, sat, val = hsv[..., 0] * 360 / 256, hsv[..., 1], hsv[..., 2]
    # (o matiz já separa lanternas, piscas, cromados e placa; só ficam de fora o miolo dos vidros e os
    # retrovisores cromados, que refletem o turquesa)
    gl = cv2.erode(poly_mask(GLASS[k], car.shape).astype(np.uint8), np.ones((25, 25), np.uint8)) > 0
    zn = gl | poly_mask(MIRRORS[k], car.shape)
    m = car & ~zn & (hue > 160) & (hue < 205) & (sat > 90) & (val > 45)
    for _ in range(4):  # reflexos claros (quase brancos, puxando para o ciano) encostados
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= car & ~zn & near & (val > 150) & (((hue > 150) & (hue < 215)) | (sat < 40))
    # pinceladas de brilho creme nos flancos de baixo (atrás): fora das zonas (cromados e lanternas)
    zf = zone_mask(k, car.shape)
    for _ in range(6):
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= car & ~zf & near & (val > 140) & (hue > 15) & (hue < 75) & (sat < 150)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    return np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 30])


def glass_tone(a, k, car):
    """paisagem vista pelos vidros (verde, pedra do muro) vira o azul do próprio vidro no mesmo brilho"""
    g = poly_mask(GLASS[k], car.shape) & car
    rgb = a.astype(int)
    r, gg, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = rgb.mean(axis=2)
    blue = g & (b - np.maximum(r, gg) >= 12) & (lum > 50)
    land = g & ~blue & (lum > 48) & ((gg >= b - 8) | (r >= b - 8)) & (rgb.max(axis=2) - rgb.min(axis=2) > 30)
    if blue.sum() < 200 or not land.any():
        return
    ref = rgb[blue]
    ref = ref[np.argsort(ref.mean(axis=1))]
    bins = np.array([np.median(c, axis=0) for c in np.array_split(ref, 32)])
    bl = bins.mean(axis=1)
    lv = lum[land]
    col = np.stack([np.interp(lv, bl, bins[:, i]) for i in range(3)], axis=1)
    a[land] = np.clip(col, 0, 255).astype(np.uint8)


def paint_mask(a, car, k):
    """lataria branca: clara e pouco saturada fora das zonas + sombra rosada de baixo + contorno encostado"""
    rgb = a.astype(int)
    lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    ok = car & ~zone_mask(k, car.shape)
    m = ok & (lum > 95) & (sat < 45)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    for _ in range(6):  # meio-tom, sombra malva de baixo e o contorno do mesmo tom
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= ok & near & (lum > 70) & (sat < 55)
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
        if dbg:
            v = a.copy()
            v[~car] = (0, 200, 0)
            Image.fromarray(v).save(os.path.join(dbg, f'cut-{k}.png'))
    # branco de referência: a lataria da lateral, ordenada pelo brilho
    a, car = data['side']
    ms = paint_mask(a, car, 'side')
    rs = a[ms].astype(float)
    rs = rs[np.argsort(rs.mean(axis=1))]
    full = rs[rs.mean(axis=1) > 200]
    print('branco da lateral (mediana da lataria):', '#%02x%02x%02x' % tuple(int(v) for v in np.median(full, axis=0)))
    masks, conv = {'side': ms}, {}
    for k in ('front', 'rear'):
        a, car = data[k]
        cm = teal_body(a, car, k)
        L = smooth_lum(a, cm)
        b = np.dstack([L] * 3).astype(np.uint8)
        tone_map(b, cm, rs)
        a[cm] = b[cm]
        conv[k] = cm
        # o turquesa que sobra fora da pintura (reflexo nos cromados, beira das molduras, fios verdes da
        # borda) vira cinza neutro no mesmo brilho: cromo do carro branco; o miolo dos vidros e a
        # bandeirinha ficam
        hsv = cv2.cvtColor(np.ascontiguousarray(a), cv2.COLOR_RGB2HSV_FULL).astype(int)
        hue, sat = hsv[..., 0] * 360 / 256, hsv[..., 1]
        gl = cv2.erode(poly_mask(GLASS[k], car.shape).astype(np.uint8), np.ones((15, 15), np.uint8)) > 0
        rest = car & ~cm & ~gl & ~poly_mask([rect(*z) for z in KEEP_HUE.get(k, [])], car.shape) & (hue > 75) & (hue < 215) & (sat > 60)
        l = a.astype(float).mean(axis=2)
        a[rest] = np.clip(np.stack([l * 0.97, l * 0.98, l * 1.03], axis=-1), 0, 255).astype(np.uint8)[rest]
    for k in ('side', 'front', 'rear'):
        a, car = data[k]
        glass_tone(a, k, car)
        if k != 'side':
            # (o turquesa convertido é lataria pelo matiz, mesmo dentro dos retângulos das zonas)
            masks[k] = paint_mask(a, car, k) | (conv[k] & ~poly_mask(GLASS[k], car.shape))
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
        for _ in range(2):  # pixels soltos da cor da lataria cercados de máscara (sobras do miolo dos blocos)
            m |= white & ~m & (cv2.filter2D(m.astype(np.uint8), -1, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT) >= 5)
        # beira das zonas (medidas com folga): o claro pouco saturado encostado na máscara ainda é lataria
        free1 = cv2.erode(free.astype(np.uint8) ^ 1, np.ones((3, 3), np.uint8)) == 0
        edge = (s[..., 3] > 0) & free1 & (c.max(axis=2) > 150) & (c.max(axis=2) - c.min(axis=2) < 50)
        m |= edge & (cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
        if k in conv:  # branco convertido em tons chapados (pixel a pixel deixava chuvisco)
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
            stamp(s, m8, 'onca', (*to_s(bx, by), size, 0))
            print('  emblema (sprite):', *to_s(bx, by), size)
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'{ID}-{k}.png'), optimize=True)
        Image.fromarray(m8, 'L').convert('RGBA').save(os.path.join(out, f'{ID}-{k}-mask.png'), optimize=True)
        print(k, s.shape[1], s.shape[0], 'origem', ox, oy, 'fator', round(f, 3), 'máscara', int((m8 > 0).sum()))
        if k in PLATE_FRAME:
            x0, y0, x1, y1 = PLATE_FRAME[k]
            print('  placa (sprite):', *to_s(x0, y0), *to_s(x1, y1), s.shape[1], s.shape[0])
        if k == 'rear':
            x0, y0, x1, y1 = REAR_SIG
            print('  pisca (u0, f0, u1, f1):', *fr(x0, y0), *fr(x1, y1), 'lente vermelha:', fr(*REAR_RED),
                  'altura/largura', round(s.shape[0] / s.shape[1], 3))
        if k == 'front':
            hx, hy, hr = FRONT_HEAD
            sx, sy, sr = FRONT_SIG
            print('  farol (u, f, r):', *fr(hx, hy), round(hr / f / s.shape[1], 3), 'pisca (u, f, r):', *fr(sx, sy), round(sr / f / s.shape[1], 3))
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
