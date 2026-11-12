"""Sprites do Silber 95 (Porsche 959 1987, prata, pixel art do Victor). A arte (1672 x 941) vem com
CENÁRIO: parede de tijolos escuros, asfalto com faixas amarelas e a sombra do carro embaixo. A lateral já
vem com a frente para a esquerda.
Recorte (molde de monza_sprites.py, adaptado): o rejunte dos tijolos é quase tão escuro quanto o contorno
do carro, então a inundação pura vaza ou prende tijolo. O miolo do carro sai das manchas claras entre as
linhas escuras (máx. RGB >= 26) em que o tom FRIO (azul >= vermelho: prata, vidro) é maioria: tijolo,
rejunte, asfalto e faixa amarela são quentes. Em volta do miolo entra o contorno preto (só o preto de
verdade, mais escuro que o rejunte), os buracos fechados viram carro (lanternas, faróis, grades, insertos
dourados das rodas) e a sombra/asfalto de baixo sai por geometria: na lateral abaixo da soleira ficam só
os discos dos pneus; atrás e na frente, abaixo do para-choque, só as faixas dos pneus, linha a linha.
Marcas reais somem: o "PORSCHE" da faixa vermelha das lanternas (o painel do meio vira refletor liso, as
lentes dos lados ficam) e o brasão do capô (no lugar entra o emblema da Silber, stamp de brand_badges.py).
Placa traseira já é lisa (a do jogo vai por cima: PLATE_BOX). As rodas não têm logo legível.
Vira pixel art nítida (lateral 400, frente/traseira 260: shrink de monza_sprites.py).
Máscara de pintura (prata, o caso difícil: a cor sozinha não separa a lataria do aro, da grade e do
farol): lataria = tom frio pouco colorido e não escuro, FORA das zonas medidas na arte (faróis,
lanternas, piscas, grades e saídas de ar, placa, escapamentos, maçaneta, rodas) e dos vidros (manchas
fechadas de maioria azul), mais o contorno escuro encostado nela e os reflexos brancos. Retrovisores e
aerofólio (da cor do carro) entram.
Uso: python3 tools/ref/silber_sprites.py <pasta com side/front/rear.png> <src/assets/cars>   (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink  # noqa: E402
from brand_badges import stamp  # noqa: E402

ID = '959'
WIDTH = {'side': 400, 'rear': 260, 'front': 260}
# lateral: centro das rodas, raio do pneu, linha de baixo da carroceria (abaixo só os pneus) e pé do pneu
SIDE_WHEELS, SIDE_R, S_BOT, S_FOOT = ((465, 653), (1202, 652)), 104, 724, 757
# frente/traseira: linha de baixo do para-choque; abaixo dela só os pneus (x0, x1 de cada um) até o pé
CUT = {'front': (806, 860, [(328, 478), (1193, 1342)]), 'rear': (792, 854, [(330, 508), (1166, 1342)])}
CX = {'front': 835, 'rear': 837}  # eixo de simetria (as zonas de um lado são espelhadas)
# caixa do carro na arte: as manchas frias (prata, vidro, aro) e as lentes daqui de dentro são o miolo
BOX = {'side': (150, 300, 1580, 770), 'front': (316, 150, 1356, 870), 'rear': (316, 150, 1358, 870)}


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def circle(cx, cy, r):
    return [(cx + r * np.cos(t), cy + r * np.sin(t)) for t in np.linspace(0, 2 * np.pi, 48)]


# zonas fora da máscara (pixels da arte). 'all': polígonos inteiros; 'dark': retângulos em que só sai o
# vão escuro das grades/saídas de ar fechado (com os frisos claros de dentro), a lataria em volta fica;
# em 'sym'/'dsym' vale também o espelho. Lentes coloridas (lanternas, piscas) saem sozinhas pela cor.
ZONES = {
    'side': {'all': [[(193, 598), (204, 572), (268, 509), (292, 509), (288, 532), (222, 598)],  # farol
                     ],
             'dark': [rect(926, 502, 1016, 548),   # maçaneta (contorno escuro e o cromo de dentro)
                      rect(160, 650, 252, 712),    # vãos do para-choque dianteiro
                      rect(252, 618, 354, 710),    # grade da frente
                      rect(1436, 590, 1564, 704)]},  # saída de ar traseira
    'front': {'all': [rect(0, 806, 1672, 941)],    # pneus
              'dark': [rect(632, 692, 1040, 810)],  # grade do meio
              'sym': [circle(476, 534, 76)],       # farol
              'dsym': [rect(508, 640, 604, 702),   # farolete escuro ao lado do pisca
                       rect(414, 696, 652, 804),   # grade do lado
                       rect(318, 626, 394, 804)]},  # frisos do canto
    'rear': {'all': [rect(342, 524, 1334, 596),    # faixa das lanternas
                     rect(676, 622, 1002, 718),    # placa
                     rect(0, 792, 1672, 941)],     # pneus
             'dark': [rect(384, 708, 1294, 800)],  # escapamentos e grades de baixo
             'dsym': [rect(318, 600, 412, 780)]},  # frisos do canto
}
# emblema da Silber no capô: centro (pixels da arte) e lado (pixels do sprite)
BADGE = {'front': (836, 565, 9)}
# placa traseira: interior do quadro (pixels da arte), para PLATE_BOX
PLATE = {'rear': (690, 630, 990, 708)}


def segment(a, k):
    rgb = a.astype(int)
    mx, lum = rgb.max(axis=2), rgb.mean(axis=2)
    H, W = lum.shape
    yy, xx = np.mgrid[0:H, 0:W]
    bar = mx < 26
    n, lab, st, _ = cv2.connectedComponentsWithStats((~bar).astype(np.uint8), connectivity=4)
    cool = (rgb[..., 2] >= rgb[..., 0]) & (lum > 60)
    frac = np.bincount(lab.ravel(), weights=cool.ravel(), minlength=n) / np.maximum(1, st[:, cv2.CC_STAT_AREA])
    frac[0] = 0
    # lentes (laranja/vermelho saturado): o tijolo e o asfalto são quentes mas pouco coloridos; a faixa
    # amarela do chão passa da caixa do carro e fica de fora
    lens = ((rgb[..., 0] - rgb[..., 2]) > 60) & ((mx - rgb.min(axis=2)) > 90)
    fl = np.bincount(lab.ravel(), weights=lens.ravel(), minlength=n) / np.maximum(1, st[:, cv2.CC_STAT_AREA])
    fl[0] = 0
    core = (((frac > 0.5) & (st[:, cv2.CC_STAT_AREA] > 400)) | ((fl > 0.4) & (st[:, cv2.CC_STAT_AREA] > 150)))[lab]
    n, lab, st, _ = cv2.connectedComponentsWithStats(core.astype(np.uint8), 8)
    keep = np.zeros(n, bool)
    bx0, by0, bx1, by1 = BOX[k]
    for i in range(1, n):  # manchas frias dentro da caixa do carro (lataria, vidros, aros, peças)
        x, y, w, h = st[i, :4]
        keep[i] = x >= bx0 and y >= by0 and x + w <= bx1 and y + h <= by1
    car = keep[lab]
    # contorno preto em volta (mais escuro que o rejunte dos tijolos)
    black = mx < 20
    for _ in range(12):
        car |= black & (cv2.dilate(car.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    if k == 'side':
        wh = np.zeros((H, W), bool)
        for cx, cy in SIDE_WHEELS:
            wh |= np.hypot(xx - cx, yy - cy) <= SIDE_R
        car |= wh & (yy <= S_FOOT)
        car &= (yy <= S_BOT) | (wh & (yy <= S_FOOT))
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    n, lab = cv2.connectedComponents((~car).astype(np.uint8), connectivity=4)
    car |= lab != lab[0, 0]  # buracos fechados viram carro
    if k != 'side':
        y0, y1, spans = CUT[k]
        car &= yy <= y0
        for x0, x1 in spans:  # pneus: o retângulo inteiro (banda de rodagem e contorno), até o pé
            car[y0 - 20:y1 + 1, x0:x1 + 1] = True
    car = cv2.morphologyEx(car.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(car, 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    n, lab = cv2.connectedComponents((~car).astype(np.uint8), connectivity=4)
    return car | (lab != lab[0, 0])


def rowfill(a, x0, y0, x1, y1):
    """apaga um emblema: cada linha recebe a cor da lataria logo à esquerda e à direita dele"""
    for y in range(y0, y1):
        l, r = np.median(a[y, x0 - 8:x0 - 1], axis=0), np.median(a[y, x1 + 1:x1 + 8], axis=0)
        t = np.linspace(0, 1, x1 - x0)[:, None]
        a[y, x0:x1] = (l * (1 - t) + r * t).astype(np.uint8)


def debrand(a, k):
    if k == 'front':
        rowfill(a, 810, 540, 862, 592)  # brasão do capô (o da Silber entra no sprite)
    elif k == 'rear':
        # "PORSCHE": o painel do meio da faixa vira refletor liso; cada linha recebe o vinho do fundo
        # dele (a metade mais escura da linha, sem as letras)
        x0, x1 = 646, 1042
        for y in range(536, 590):
            row = a[y, x0:x1].astype(int)
            lum = row.mean(axis=1)
            a[y, x0:x1] = np.median(row[lum <= np.percentile(lum, 45)], axis=0).astype(np.uint8)


def zone_mask(k, shape, a=None):
    z = np.zeros(shape, np.uint8)
    Z = ZONES[k]
    if a is not None:
        lum = a.astype(int).mean(axis=2)
        rs = [np.array(p, float) for p in Z.get('dark', [])]
        for p in Z.get('dsym', []):
            p = np.array(p, float)
            rs += [p, np.c_[2 * CX[k] - p[:, 0], p[:, 1]]]
        for p in rs:
            x0, y0 = np.floor(p.min(axis=0)).astype(int)
            x1, y1 = np.ceil(p.max(axis=0)).astype(int)
            d = (lum[y0:y1, x0:x1] < 45).astype(np.uint8)
            d = cv2.morphologyEx(d, cv2.MORPH_CLOSE, np.ones((17, 9), np.uint8))  # frisos de dentro
            n, lab = cv2.connectedComponents(1 - d, connectivity=4)
            edge = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
            d |= ~np.isin(lab, list(edge)) & (d == 0)  # buracos fechados
            d = cv2.dilate(d.astype(np.uint8), np.ones((3, 3), np.uint8))
            z[y0:y1, x0:x1] |= d
    polys = [np.array(p, float) for p in Z.get('all', [])]
    for p in Z.get('sym', []):
        p = np.array(p, float)
        polys += [p, np.c_[2 * CX[k] - p[:, 0], p[:, 1]]]
    for p in polys:
        cv2.fillPoly(z, [np.round(p).astype(np.int32)], 1)
    if k == 'side':
        for cx, cy in SIDE_WHEELS:
            cv2.circle(z, (cx, cy), SIDE_R, 1, -1)
    return z > 0


def glass_zone(a, car):
    """vidros: cada mancha fechada pelo contorno/borracha preta em que o azul do vidro é maioria sai
    inteira (bancos e reflexos acinzentados vistos pelo vidro)"""
    rgb = a.astype(int)
    lum = rgb.mean(axis=2)
    blue = (rgb[..., 2] - rgb[..., 0] > 30) & (rgb.max(axis=2) - rgb.min(axis=2) > 40)
    n, lab, st, _ = cv2.connectedComponentsWithStats((car & (lum > 30)).astype(np.uint8), 4)
    frac = np.bincount(lab.ravel(), weights=blue.ravel(), minlength=n) / np.maximum(1, st[:, cv2.CC_STAT_AREA])
    frac[0] = 0
    z = (frac > 0.35)[lab] | (car & blue)
    return cv2.dilate(z.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0


def paint(a, car, k):
    """lataria prata: tom frio (azul >= vermelho - 4), pouco colorido e não escuro, fora das zonas e dos
    vidros; mais o contorno/meio-tom escuro encostado e os reflexos brancos"""
    rgb = a.astype(int)
    r, b = rgb[..., 0], rgb[..., 2]
    lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    warm = cv2.dilate((((r - b) > 40) & (sat > 70)).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0  # lentes
    ok = car & ~zone_mask(k, car.shape, a) & ~glass_zone(a, car) & ~warm
    m = ok & (b - r >= -4) & (lum > 85) & (sat < 60)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    for _ in range(4):  # contorno e vincos escuros (frios) encostados
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m |= ok & near & (b - r >= -6) & (sat < 60) & (lum > 30)  # o preto puro do contorno fica
    for _ in range(40):  # reflexos claros encostados
        near = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        new = ok & near & ~m & (lum > 190) & (sat < 45)
        if not new.any():
            break
        m |= new
    return m


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    for k in ('side', 'front', 'rear'):
        a = np.array(Image.open(os.path.join(src, f'{k}.png')).convert('RGB'))
        car = segment(a, k)
        debrand(a, k)
        mk = paint(a, car, k)
        s, (ox, oy, f) = shrink(a, car, WIDTH[k])
        to_s = lambda x, y: (int(round((x - ox) / f)), int(round((y - oy) / f)))
        g8, _ = shrink(np.dstack([mk * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
        z8, _ = shrink(np.dstack([(zone_mask(k, car.shape, a) | glass_zone(a, car)) * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
        al = s[..., 3] > 0
        m = (g8[..., 0] > 127) & al
        free = (z8[..., 0] < 128) & al
        c = s[..., :3].astype(int)
        silver = free & (c[..., 2] - c[..., 0] >= -6) & (c.max(axis=2) - c.min(axis=2) < 60) & (c.mean(axis=2) > 30)
        # sobras do miolo dos blocos: pixels prata/escuros frios cercados de máscara entram, e as bordas
        # (contorno escuro e reflexo claro) encostadas nela também
        for _ in range(2):
            n8 = cv2.filter2D(m.astype(np.uint8), -1, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT)
            m |= silver & ~m & (n8 >= 5)
        m8 = (m * 255).astype(np.uint8)
        if k in BADGE:
            bx, by, size = BADGE[k]
            stamp(s, m8, 'silber', (*to_s(bx, by), size, 0))
        if k == 'side':
            print('prata da lateral (mediana da lataria):', '#%02x%02x%02x' % tuple(int(v) for v in np.median(s[..., :3][m], axis=0)))
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'{ID}-{k}.png'), optimize=True)
        Image.fromarray(m8, 'L').convert('RGBA').save(os.path.join(out, f'{ID}-{k}-mask.png'), optimize=True)
        print(k, s.shape[1], s.shape[0], 'origem', ox, oy, 'fator', round(f, 3), 'máscara', int((m8 > 0).sum()))
        fr = lambda x, y: (round((x - ox) / f / s.shape[1], 4), round((y - oy) / f / s.shape[0], 4))
        if k in PLATE:
            x0, y0, x1, y1 = PLATE[k]
            print('  placa (sprite):', *to_s(x0, y0), *to_s(x1, y1), s.shape[1], s.shape[0])
        if k == 'rear':
            print('  faixa das lanternas (u, f):', fr(345, 534), fr(1331, 594), 'pisca:', fr(348, 534), fr(440, 594))
        if k == 'front':
            print('  farol (u, f, r):', fr(476, 534), round(68 / f / s.shape[1], 3), 'pisca:', fr(372, 640), fr(480, 696))
        if k == 'side':
            print('  rodas (u, v):', [fr(cx, cy) for cx, cy in SIDE_WHEELS])
        if dbg:
            v = np.array(Image.fromarray(s).resize((s.shape[1] * 4, s.shape[0] * 4), Image.NEAREST))
            bg = np.zeros_like(v[..., :3]); bg[:] = (0, 200, 0)
            al4 = v[..., 3:] / 255
            Image.fromarray((v[..., :3] * al4 + bg * (1 - al4)).astype(np.uint8)).save(os.path.join(dbg, f'out-{k}.png'))
            mm = np.array(Image.fromarray(m8).resize((s.shape[1] * 4, s.shape[0] * 4), Image.NEAREST)) > 0
            bl = v[..., :3].copy(); bl[mm] = (40, 70, 230)  # máscara chapada de azul para conferir
            Image.fromarray((bl * al4 + bg * (1 - al4)).astype(np.uint8)).save(os.path.join(dbg, f'blue-{k}.png'))


if __name__ == '__main__':
    main()
