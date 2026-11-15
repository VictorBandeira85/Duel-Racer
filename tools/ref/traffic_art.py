"""Trânsito com a arte do Victor (traseira e frente sobre magenta) virando os sprites do jogo
(src/assets/traffic/<modelo>-<vista>.png + -mask.png): recorta o carro, reamostra em 160 px de largura
pegando a cor do miolo de cada bloco (sem borrar), o magenta vira transparente, apaga marcas reais
(logos e letreiros pintados por cima com a cor em volta) e faz a máscara de pintura (lataria: cor da
carroceria, menos vidros, luzes, grade, para-choques, pneus e placa medidos à mão em EXCL).
Uso: python3 tools/ref/traffic_art.py <pasta com as artes> <modelo...>   (modelos: sedan hatch pickup)
     arquivos: <modelo>-front.png|jpg e <modelo>-rear.png|jpg
"""
import os
import sys

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/traffic')
W = 160
CROP = {('sedan', 'front'): (100, 0, None, None)}  # pedaço de outro objeto na borda esquerda


def load(src, model, view):
    for ext in ('png', 'jpg', 'jpeg'):
        p = os.path.join(src, f'{model}-{view}.{ext}')
        if os.path.exists(p):
            a = np.array(Image.open(p).convert('RGB')).astype(int)
            c = CROP.get((model, view))
            if c:
                a = a[c[1]:c[3], c[0]:c[2]]
            return a
    raise FileNotFoundError(model + view)


def reduce(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = (r > 150) & (g < 130) & (b > 150) & (r - g > 90) & (b - g > 90)
    ys, xs = np.where(~mag)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    bs = (x1 - x0) / W
    H = int(round((y1 - y0) / bs))
    o = np.zeros((H, W, 4), np.uint8)
    rr = max(1, int(bs * 0.2))
    for j in range(H):
        cy = int(y0 + (j + 0.5) * bs)
        for i in range(W):
            cx = int(x0 + (i + 0.5) * bs)
            blk = a[cy - rr:cy + rr + 1, cx - rr:cx + rr + 1].reshape(-1, 3)
            m = mag[cy - rr:cy + rr + 1, cx - rr:cx + rr + 1].reshape(-1)
            if m.mean() > 0.5:
                continue
            o[j, i] = [*np.median(blk[~m], axis=0).astype(np.uint8), 255]
    return o


# por vista (coordenadas na grade de 160 px): vidros (polígono), amostra da lataria (caixa), áreas
# excluídas da máscara (luzes da mesma cor da lataria) e marcas a apagar: (x0, y0, x1, y1, lado de onde
# vem a cor da linha: 'L' = pixel à esquerda da caixa, 'R' = à direita, 'G<x>' = coluna x da grade)
SPEC = {
    ('hatch', 'front'): {'glass': [(37, 5), (123, 5), (139, 42), (21, 42)], 'body': (40, 45, 120, 56),
                         'erase': [(72, 63, 89, 80, 'G68')]},
    ('hatch', 'rear'): {'glass': [(31, 9), (129, 9), (141, 42), (19, 42)], 'body': (50, 46, 74, 60),
                        'erase': [(15, 47, 29, 61, 'R'), (29, 50, 41, 58, 'R'), (120, 50, 146, 58, 'L')]},
    ('sedan', 'front'): {'glass': [(36, 5), (126, 5), (139, 39), (19, 39)], 'body': (30, 42, 130, 55)},
    ('sedan', 'rear'): {'glass': [(35, 6), (126, 6), (138, 41), (23, 41)], 'body': (20, 44, 70, 60),
                        'excl': [(0, 83, 160, 123)], 'gray': [(0, 83, 160, 123)],
                        'erase': [(76, 53, 85, 61, 'L')]},  # emblema redondo da tampa sai  # para-choque e pneus azul-escuros: viram preto/cinza
    ('pickup', 'front'): {'glass': [(32, 7), (131, 7), (141, 40), (21, 40)], 'body': (30, 42, 130, 52), 'sat': 0.07},
    ('pickup', 'rear'): {'glass': [(38, 10), (123, 10), (125, 35), (36, 35)], 'body': (20, 60, 140, 80),
                         'excl': [(0, 58, 14, 100), (146, 58, 160, 100)],
                         'erase': [(14, 85, 46, 94, 'R'), (134, 85, 145, 94, 'L')]},
}


def hsv(o):
    import cv2
    h = cv2.cvtColor(o[..., :3].copy(), cv2.COLOR_RGB2HSV_FULL).astype(float)
    return h[..., 0] * 360 / 256, h[..., 1] / 255, h[..., 2] / 255


def poly(H, W, pts):
    from PIL import ImageDraw
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return np.array(m) > 0


def build(o, spec):
    import cv2
    o = o.copy()
    for x0, y0, x1, y1, side in spec.get('erase', []):  # marcas reais saem: cada linha recebe a cor de fora da caixa
        for y in range(y0, y1):
            if side == 'L':
                o[y, x0:x1] = o[y, x0 - 1]
            elif side == 'R':
                o[y, x0:x1] = o[y, x1]
            else:
                o[y, x0:x1] = o[y, int(side[1:])]
    for x0, y0, x1, y1 in spec.get('gray', []):  # peças pretas que a arte pintou da cor do carro: tira a cor
        sub = o[y0:y1, x0:x1, :3].astype(float)
        lum = (sub @ [0.3, 0.59, 0.11]) * 0.9
        o[y0:y1, x0:x1, :3] = np.clip(np.stack([lum] * 3, -1), 0, 255).astype(np.uint8)
    H, W = o.shape[:2]
    op = o[..., 3] > 0
    hh, ss, vv = hsv(o)
    glass = poly(H, W, spec['glass'])
    x0, y0, x1, y1 = spec['body']
    bs = op[y0:y1, x0:x1] & (ss[y0:y1, x0:x1] > spec.get('sat', 0.15))
    ang = np.deg2rad(hh[y0:y1, x0:x1][bs])
    h0 = (np.rad2deg(np.arctan2(np.sin(ang).mean(), np.cos(ang).mean())) + 360) % 360
    dh = np.abs((hh - h0 + 180) % 360 - 180)
    excl = glass.copy()
    for a, b, c, d in spec.get('excl', []):
        excl[b:d, a:c] = True
    m = op & ~excl & (dh < 24) & (ss > spec.get('sat', 0.15) * 0.8) & (vv > 0.1)
    # reflexos claros e frisos finos no meio da lataria (fechamento curto, vertical e horizontal)
    k = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 1), np.uint8))
    k = cv2.morphologyEx(k, cv2.MORPH_CLOSE, np.ones((1, 3), np.uint8)) > 0
    m = (m | (k & op & ~excl & (vv > 0.15))) 
    # bordas e reflexos da cor da lataria colados na máscara (contorno escuro, filete claro rosado):
    # com outra cor eles sobravam na cor de fábrica
    for _ in range(3):
        near = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        m = m | (near & op & ~excl & (dh < 32) & (ss > 0.2) & (vv > 0.08))
    # grupos soltos pequenos (pixel azul no pneu, na grade) saem
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if st[i, 4] < 6:
            m[lab == i] = False
    return o, m, h0


def lamps(o, rear):
    """centros das lanternas (traseira: vermelho vivo) ou faróis (frente: branco), em fração"""
    import cv2
    H, W = o.shape[:2]
    r, g, b, a = [o[..., i].astype(int) for i in range(4)]
    if rear:
        c = (a > 0) & (r > 170) & (g < 90) & (b < 90)
    else:
        c = (a > 0) & (np.minimum(np.minimum(r, g), b) > 170)
        c[:H // 3] = False
    out = []
    for half in (slice(0, W // 2), slice(W // 2, W)):
        cc = np.zeros_like(c)
        cc[:, half] = c[:, half]
        if not rear:  # faróis: o maior grupo claro de cada lado acima da placa
            n, lab, st, cen = cv2.connectedComponentsWithStats(cc.astype(np.uint8))
            if n > 1:
                i = 1 + int(np.argmax(st[1:, 4]))
                out.append([round(cen[i][0] / W, 3), round(cen[i][1] / H, 3)])
            continue
        ys, xs = np.nonzero(cc)
        if len(xs):
            out.append([round(xs.mean() / W, 3), round(ys.mean() / H, 3)])
    return out


def plate(o):
    import cv2
    H, W = o.shape[:2]
    r, g, b, a = [o[..., i].astype(int) for i in range(4)]
    c = (a > 0) & (np.minimum(np.minimum(r, g), b) > 175) & (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b) < 30)
    c[:H // 2] = False
    c[:, :W // 4] = False
    c[:, 3 * W // 4:] = False
    n, lab, st, _ = cv2.connectedComponentsWithStats(c.astype(np.uint8))
    i = 1 + int(np.argmax(st[1:, 4]))
    x, y, w, h = st[i, :4]
    return [int(x), int(y), int(x + w), int(y + h), W, H]


def main():
    src = sys.argv[1]
    for model in sys.argv[2:]:
        for view in ('front', 'rear'):
            o = reduce(load(src, model, view))
            Image.fromarray(o).save(os.path.join(src, 'out', f'{model}-{view}-raw.png'))
            o, m, h0 = build(o, SPEC[(model, view)])
            Image.fromarray(o).save(os.path.join(OUT, f'{model}-{view}.png'), optimize=True)
            Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(os.path.join(OUT, f'{model}-{view}-mask.png'), optimize=True)
            print(f'{model}-{view}', o.shape[1], 'x', o.shape[0], 'matiz', round(h0), 'máscara', int(m.sum()),
                  'luzes', lamps(o, view == 'rear'), 'placa', plate(o) if view == 'rear' else '')


if __name__ == '__main__':
    main()
