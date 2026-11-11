"""Sprites do Jornada LS (VW Voyage LS 1.6 1986 duas portas, pixel art do Victor). A lateral (frente
para a esquerda) e a traseira vêm recortadas (alfa); a frente vem em fundo escuro em degradê com brilho
alaranjado em volta dos piscas: o fundo é inundado a partir do alto (o contorno preto do carro segura),
e embaixo do para-choque só as faixas dos pneus ficam (a sombra sai por geometria).
Marcas reais somem: emblema da grade, miolo das calotas, "VOLKSWAGEN" e "VOYAGE LS" da tampa (o "1.6"
da grade fica); no lugar entra o emblema da Ipê (stamp de brand_badges.py) na grade e na tampa.
Vira pixel art nítida (lateral 400, frente/traseira 260: shrink de monza_sprites.py).
Máscara de pintura: o verde-acinzentado da lataria (a pintura é o único tom esverdeado do carro; vidros
são azuis, para-choques/calotas/faróis são neutros) e os reflexos brancos encostados nela, fora das
zonas de faróis, lanternas, rodas e retrovisor.
Uso: python3 tools/ref/voyage_sprites.py <pasta com side/front/rear.png> <src/assets/cars>   (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from monza_sprites import shrink  # noqa: E402
from brand_badges import stamp  # noqa: E402

ID = 'br-voyage'
WIDTH = {'side': 400, 'rear': 260, 'front': 260}
# lateral: centro das rodas, raio do pneu (zona fora da máscara) e do miolo da calota (emblema)
SIDE_WHEELS, SIDE_R, HUB_R = ((437, 587), (1638, 587)), 140, 27
# a arte da lateral corta o pé dos pneus (uns 10 px): círculo do pneu ajustado ao contorno de baixo
# (centro x, centro y, raio), para completar o que falta até o chão
TIRE = ((437.1, 575.9, 156.8), (1638.3, 575.9, 156.2))
# frente: linha de baixo da saia; abaixo dela só as faixas dos pneus, até o pé do pneu
F_CUT = (888, 988, [(212, 382), (1153, 1323)])
# zonas fora da máscara (pixels da arte): x0, y0, x1, y1
ZONES = {
    'front': [(0, 516, 1535, 652),            # faróis, piscas e grade
              (150, 280, 300, 400), (1235, 280, 1385, 400),  # retrovisores
              (270, 805, 406, 878), (1129, 805, 1265, 878),  # faróis de neblina
              (600, 715, 935, 840)],          # placa
    'rear': [(0, 516, 1536, 656),             # lanternas, painel preto e placa
             (750, 442, 786, 478),            # fechadura
             (350, 812, 418, 900)],           # escapamento
    'side': [],  # retrovisor, maçaneta, pisca e lanterna saem pela cor (pretos ou saturados)
}
# emblema da Ipê: centro (pixels da arte) e lado (pixels do sprite)
BADGE = {'front': (767, 583, 11), 'rear': (316, 461, 9)}


def segment_front(a):
    lum = a.astype(int).mean(axis=2)
    H, W = lum.shape
    yy, xx = np.mgrid[0:H, 0:W]
    y0, y1, spans = F_CUT
    # fundo: tudo o que se alcança do alto da imagem sem cruzar o contorno preto (o degradê e o brilho
    # alaranjado em volta do carro são mais claros que o contorno)
    can = (lum >= 8).astype(np.uint8)
    n, lab = cv2.connectedComponents(can, connectivity=4)
    car = lab != lab[20, W // 2]
    # embaixo do carro o fundo é tão preto quanto o contorno: ficam só os pneus, fechados linha a linha
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


def tire_feet(rgba):
    """completa o pé dos pneus cortado pela borda de baixo da arte: cada coluna continua para baixo
    até o círculo do pneu, escurecendo até o contorno preto"""
    H0 = rgba.shape[0]
    pad = int(max(cy + r for _, cy, r in TIRE)) + 2 - H0
    out = np.concatenate([rgba, np.zeros((pad, rgba.shape[1], 4), np.uint8)])
    yy, xx = np.mgrid[0:out.shape[0], 0:out.shape[1]]
    y0 = H0 - 5  # as últimas linhas da arte já vêm meio apagadas
    for cx, cy, r in TIRE:
        d = np.hypot(xx - cx, yy - cy)
        new = (yy >= y0) & (d <= r)
        src = np.broadcast_to(out[y0 - 1, :, :3].astype(float), out[..., :3].shape)
        k = np.clip((r - d) / 9, 0, 1)[..., None]  # 0 no contorno, 1 por dentro
        col = src * k * np.clip(1 - (yy - y0)[..., None] / 40, 0.5, 1) + np.array([6.0, 6, 6]) * (1 - k)
        out[..., :3][new] = col[new].astype(np.uint8)
        out[..., 3][new] = 255
    return out


def debrand(a, k):
    if k == 'front':
        for y in range(534, 632):  # emblema: cada linha da grade continua (as barras são horizontais)
            a[y, 716:818] = np.median(np.concatenate([a[y, 664:712], a[y, 822:870]]), axis=0).astype(np.uint8)
    elif k == 'rear':
        # "VOLKSWAGEN" e "VOYAGE LS": a tampa é sombreada em faixas horizontais, cada linha recebe a cor
        # da tampa lisa no meio (o rowfill borrava: o letreiro da direita encosta no vinco da lateral)
        for x0, y0, x1, y1 in ((282, 428, 568, 494), (988, 434, 1272, 492)):
            for y in range(y0, y1):
                a[y, x0:x1] = np.median(np.concatenate([a[y, 600:720], a[y, 820:960]]), axis=0).astype(np.uint8)
    else:
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        for cx, cy in SIDE_WHEELS:  # miolo da calota: disco liso da cor da calota em volta
            d = np.hypot(xx - cx, yy - cy)
            ring = a[(d > HUB_R) & (d < HUB_R + 7)]
            lum = ring.mean(axis=1)
            a[d <= HUB_R] = np.median(ring[lum > np.percentile(lum, 50)], axis=0).astype(np.uint8)


def paint_mask(a, car, k):
    """lataria, medida na arte inteira (antes da paleta curta): o tom esverdeado (verde acima do
    vermelho e do azul) + reflexos e vincos brancos encostados nela"""
    rgb = a.astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum, sat = rgb.mean(axis=2), rgb.max(axis=2) - rgb.min(axis=2)
    H, W = car.shape
    yy, xx = np.mgrid[0:H, 0:W]
    ok = car.copy()
    for x0, y0, x1, y1 in ZONES[k]:
        ok[y0:y1, x0:x1] = False
    if k == 'side':
        for cx, cy in SIDE_WHEELS:
            ok &= np.hypot(xx - cx, yy - cy) > SIDE_R
    m = ok & (g - r >= 5) & (g - b >= 1) & (lum > 50) & (sat < 60)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    for _ in range(60):  # reflexos e vincos claros encostados na pintura
        near = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        m |= ok & near & (lum > 150) & (sat < 26) & (b - g < 8)
    return m


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    for k in ('front', 'rear', 'side'):
        im = Image.open(os.path.join(src, f'{k}.png'))
        if k == 'front':
            a = np.array(im.convert('RGB'))
            car = segment_front(a)
        else:
            rgba = np.array(im.convert('RGBA'))
            if k == 'side':
                rgba = tire_feet(rgba)
            a, car = np.ascontiguousarray(rgba[..., :3]), rgba[..., 3] > 128
            n, lab, st, _ = cv2.connectedComponentsWithStats(car.astype(np.uint8), 8)
            car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
        debrand(a, k)
        s, (ox, oy, f) = shrink(a, car, WIDTH[k])
        to_s = lambda x, y: (int(round((x - ox) / f)), int(round((y - oy) / f)))
        g8, _ = shrink(np.dstack([paint_mask(a, car, k) * 255] * 3).astype(np.uint8), car, WIDTH[k], colors=0)
        m = (g8[..., 0] > 127) & (s[..., 3] > 0)
        # pixels soltos da cor da lataria cercados de máscara (sobras do miolo dos blocos) entram
        c = s[..., :3].astype(int)
        body = (s[..., 3] > 0) & (c.mean(axis=2) > 70) & (c.max(axis=2) - c.min(axis=2) < 40) & (c[..., 1] >= c[..., 0]) & (c[..., 1] >= c[..., 2] - 2)
        for _ in range(2):
            m |= body & ~m & (cv2.filter2D(m.astype(np.uint8), -1, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT) >= 6)
        m8 = (m * 255).astype(np.uint8)
        if k in BADGE:
            bx, by, size = BADGE[k]
            stamp(s, m8, 'ipe', (*to_s(bx, by), size, 0))
        Image.fromarray(s, 'RGBA').save(os.path.join(out, f'{ID}-{k}.png'), optimize=True)
        Image.fromarray(m8, 'L').convert('RGBA').save(os.path.join(out, f'{ID}-{k}-mask.png'), optimize=True)
        print(k, s.shape[1], s.shape[0], 'origem', ox, oy, 'fator', round(f, 3), 'máscara', int((m8 > 0).sum()))
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
