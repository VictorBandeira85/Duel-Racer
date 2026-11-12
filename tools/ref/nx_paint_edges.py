"""Kaze NX: pixels vermelhos que sobravam na lataria com outras cores. Eram as bordas da carroceria
(contorno do teto/capô/aerofólio, cantos dos para-lamas, molduras dos retrovisores): tons de vermelho
mais escuros ou mais claros que a máscara de pintura, feita só pelo vermelho "cheio", deixava de fora.
Acrescenta à máscara de cada vista os pixels avermelhados colados nela (até 2 px), menos:
- as lanternas e a luz de freio do aerofólio (traseira: contorno medido, o mesmo de nx_rear_mask_fix.py)
- os emblemas (manchas vermelhas compactas: calotas das rodas e emblema do capô)
- o que encosta nas lentes laranja dos piscas
Conferir com: python3 tools/qa/paint_leftover.py nsx <saída.png>
Uso: python3 tools/ref/nx_paint_edges.py"""
import os
import numpy as np
from PIL import Image

CARS = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/cars')


def grow(m, n):
    o = m.copy()
    for _ in range(n):
        p = o.copy()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            p |= np.roll(np.roll(o, dy, axis=0), dx, axis=1)
        o = p
    return o


def comps(m):
    """componentes ligados (4 vizinhos) de uma máscara pequena"""
    seen = np.zeros(m.shape, bool)
    H, W = m.shape
    for y0, x0 in zip(*np.nonzero(m)):
        if seen[y0, x0]:
            continue
        st, pts = [(y0, x0)], []
        seen[y0, x0] = True
        while st:
            y, x = st.pop()
            pts.append((y, x))
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    st.append((yy, xx))
        yield pts


for v in ('side', 'front', 'rear'):
    a = np.array(Image.open(os.path.join(CARS, f'nsx-{v}.png')).convert('RGBA')).astype(int)
    mp = os.path.join(CARS, f'nsx-{v}-mask.png')
    m0 = Image.open(mp)
    m = np.array(m0.convert('L')) > 127
    H, W = m.shape
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    # inclui os vermelhos bem escuros do contorno (r de 18 a 45): com outra cor apareciam como franja marrom
    redish = (al > 0) & (r == mx) & (mx > 14) & ((r - np.maximum(g, b)) > np.maximum(10, 0.3 * mx)) & (g <= 0.5 * r + 12) & (b <= 0.6 * r + 12)
    # laranja de verdade (pouco azul): os reflexos rosados da lataria têm verde e azul parecidos e não contam
    orange = (al > 0) & (r > 180) & (g > 0.45 * r) & (g < 0.85 * r) & (b < 0.3 * r)
    cand = redish & ~m & ~grow(orange, 2)
    yy, xx = np.mgrid[0:H, 0:W]
    if v == 'rear':
        xl = np.interp(yy, [38, 40, 44, 50, 60, 61], [26, 23, 19.5, 15, 10, 10])
        cand &= ~((yy >= 38) & (yy <= 61) & (xx >= xl) & (xx <= W - xl))
    # emblemas: o do capô (frente) é uma mancha vermelha compacta; os das calotas (lateral) ficam no
    # miolo das rodas (centros medidos na arte de 300 px)
    if v == 'side':
        for cx, cy in ((62, 58), (232, 58)):
            cand &= (xx - cx) ** 2 + (yy - cy) ** 2 > 12 ** 2
        # lentes dos piscas laterais (vermelho-alaranjadas): blocos pequenos bem cheios; os degraus do
        # contorno do capô são finos e não entram aqui
        for pts in comps(cand):
            ys, xs = [p[0] for p in pts], [p[1] for p in pts]
            h, w = max(ys) - min(ys) + 1, max(xs) - min(xs) + 1
            if h >= 3 and w >= 4 and len(pts) > 0.75 * h * w and max(h, w) <= 14:
                for y, x in pts:
                    cand[y, x] = False
    else:
        for pts in comps(cand):
            ys, xs = [p[0] for p in pts], [p[1] for p in pts]
            h, w = max(ys) - min(ys) + 1, max(xs) - min(xs) + 1
            if len(pts) >= 12 and h >= 3 and w >= 3 and len(pts) > 0.45 * h * w and max(h, w) <= 14:
                for y, x in pts:
                    cand[y, x] = False
    add = cand & grow(m, 2)
    # friso do teto acima do para-brisa (frente) e contornos dos retrovisores/colunas acima das lanternas
    # (traseira): avermelhados soltos, longe da máscara; entram pela região
    warm = (al > 0) & ~m & (r > g + 14) & (r > b + 14) & ~grow(orange, 2)
    if v == 'front':
        add |= warm & (yy < 8)
    if v == 'rear':
        add |= warm & (yy >= 24) & (yy < 62) & ~((yy >= 38) & (xx >= xl) & (xx <= W - xl))
    m2 = m | add
    Image.fromarray((m2 * 255).astype(np.uint8), 'L').convert(m0.mode).save(mp, optimize=True)
    print(v, 'acrescentados', int(add.sum()))
