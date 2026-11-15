"""Vidro (vigia traseiro e para-brisa) de cada sprite de trás/frente, para pôr o motorista dentro dele.
Mesma regra da trinca em src/damage.ts (fora da máscara de pintura, metade de cima do carro, tom de vidro:
azulado/cinza, nem contorno preto nem branco; a maior mancha ligada), com os furos de dentro preenchidos
(bancos e encostos escuros desenhados atrás do vidro) e cortes à mão onde a regra erra (CUT/ONLY).
Saída: src/assets/people/glass.json, por sprite (<pasta>/<nome> sem .png):
  {"s": [[y, x0, x1], ...] (trechos do vidro por linha, x1 exclusivo), "d": [cx, topo, cabeça]}
  d = onde fica o motorista em pixels do sprite: meio da cabeça, topo da cabeça e largura da cabeça.
Também grava uma folha de conferência (máscara e motorista simulado) em <saída da folha>.
Uso: python3 tools/ref/driver_glass.py [folha.png]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
A = os.path.join(ROOT, 'src/assets')

# sem motorista à vista: a traseira não mostra a cabine (caminhão baú, motor por cima do vidro)
SKIP = {'traffic/truck-rear', 'cars/diablo-rear', 'cars/patrolsv-rear', 'cars/f40-rear', 'cars/countach-rear', 'traffic/policesv-rear'}
# caminhões da arte do Victor (tools/ref/truck_art.py): de trás só carroceria, baú ou tanque
SKIP |= {f'traffic/{m}-rear' for m in ('kenworth', 'f4000', 'cargo', 'mb1113', 'vw790', 'volvon10')}
# lugar do motorista: [cx, topo, cabeça] em fração do retângulo do vidro (x0..x1, y0..y1); de trás, o
# meio da cabeça vai para cima do encosto do banco do motorista desenhado na arte, quando há (HEADREST)
SEAT = {
    'traffic/van-rear': [0.27, 0.12, 0.11], 'traffic/kombi-rear': [0.3, 0.1, 0.12], 'traffic/fusca-rear': [0.4, 0.05, 0.16],
    'traffic/van-front': [0.7, 0.18, 0.13], 'traffic/suv-front': [0.7, 0.12, 0.13], 'traffic/sedan90-front': [0.7, 0.12, 0.12],
    'traffic/truck-front': [0.74, 0.1, 0.12], 'traffic/kombi-front': [0.75, 0.1, 0.13],
}
# banco do motorista desenhado na arte (encosto com o apoio de cabeça), medido em pixels do sprite
# ampliado: [x0, y0 (topo do apoio de cabeça), x1, y1]. De frente o motorista fica à direita de quem olha
# (mão brasileira), de trás à esquerda; o Kaze NX (NSX) é mão inglesa: o contrário. O motorista senta nele:
# de frente, na frente do encosto (cabeça na altura do apoio); de trás, atrás dele (o banco da arte fica
# por cima do corpo e a cabeça aparece acima do encosto).
SEATBOX = {
    'cars/f40-front': [115, 14, 143, 31], 'cars/nsx-front': [52, 19, 79, 33], 'cars/nsx-rear': [123, 20, 150, 31],
    'cars/diablo-front': [129, 27, 155, 41], 'cars/patrolsv-front': [129, 29, 155, 43], 'traffic/policesv-front': [129, 29, 155, 43],
    'cars/countach-front': [154, 30, 187, 52], 'cars/countach-front-up': [154, 30, 187, 52],
    'cars/testarossa-front': [108, 18, 131, 30], 'cars/testarossa-front-up': [108, 18, 131, 30], 'cars/testarossa-rear': [80, 22, 114, 34],
    'cars/959-front': [154, 30, 182, 50], 'cars/959-rear': [80, 28, 106, 43],
    'cars/viper-front': [105, 25, 126, 41], 'cars/zr1-front': [121, 19, 146, 30], 'cars/zr1-rear': [58, 20, 84, 29],
    'cars/br-monza-front': [160, 31, 192, 48], 'cars/br-monza-rear': [73, 32, 105, 48],
    'cars/br-monzacoupe-front': [157, 29, 190, 50], 'cars/br-monzacoupe-rear': [72, 36, 107, 53],
    'cars/br-passat-front': [154, 27, 187, 44], 'cars/br-passat-rear': [66, 36, 104, 55],
    'cars/br-santana-front': [155, 32, 188, 48], 'cars/br-santana-rear': [68, 31, 109, 49],
    'cars/br-voyage-front': [153, 33, 185, 50], 'cars/br-voyage-rear': [70, 38, 107, 56],
    'cars/br-voyagesport-front': [155, 32, 183, 50], 'cars/br-voyagesport-rear': [64, 32, 102, 50],
    'cars/br-golgti-front': [128, 38, 156, 53], 'cars/br-golgti-rear': [48, 55, 76, 66],
    'cars/br-corsa-front': [114, 24, 140, 40], 'cars/br-corsa-rear': [59, 49, 92, 70],
    'cars/br-uno-front': [144, 35, 174, 52], 'cars/br-uno-rear': [47, 31, 74, 45],
    'cars/br-pumagte-front': [153, 30, 185, 44], 'cars/br-pumagte-rear': [73, 27, 105, 38],
    'cars/br-pumagtb-front': [57, 8, 68, 14], 'cars/br-pumagtb-rear': [26, 7, 39, 13],
    'cars/br-kadett-front': [79, 15, 95, 24], 'cars/br-kadett-rear': [25, 10, 37, 17],
    'cars/br-vectra-front': [94, 15, 116, 28], 'cars/br-vectra-rear': [31, 10, 47, 17],
    'cars/patrol-front': [123, 36, 144, 50], 'cars/patrol-rear': [54, 37, 78, 50],
    'traffic/sedan-rear': [44, 25, 64, 38], 'traffic/sedan-front': [97, 22, 115, 35],
    'traffic/hatch-rear': [42, 26, 65, 39], 'traffic/hatch-front': [96, 21, 116, 34],
    'traffic/pickup-rear': [45, 25, 65, 33], 'traffic/pickup-front': [97, 20, 119, 33],
    'traffic/police-rear': [43, 31, 59, 43], 'traffic/police-front': [99, 30, 115, 42],
}
HEAD_SEAT = 0.42  # largura da cabeça / largura do encosto da arte

# laterais (frente para a esquerda: vemos o lado esquerdo do carro, o do motorista): encosto de cabeça do
# banco do motorista na arte [x0, y0, x1, y1] e a janela da porta [x da coluna A, x da coluna B]; o
# motorista é posto com o encosto de cabeça da folha em cima do da arte e o banco da folha sai (o da arte
# fica). Onde a arte não mostra o encosto, ele foi posto logo à frente da coluna B, como nos outros.
# far: mão inglesa (Kaze NX), o motorista fica no banco de lá, atrás do banco do passageiro e mais escuro.
SIDE = {
    'cars/959-side': ([238, 24, 250, 37], [180, 246]),
    'cars/br-corsa-side': ([115, 15, 125, 24], [84, 125]),
    'cars/br-golgti-side': ([172, 42, 182, 50], [118, 183]),
    'cars/br-kadett-side': ([72, 7, 77, 14], [51, 77]),
    'cars/br-monza-side': ([212, 24, 224, 34], [152, 226]),
    'cars/br-monzacoupe-side': ([227, 23, 239, 37], [158, 242]),
    'cars/br-passat-side': ([220, 30, 229, 39], [160, 231]),
    'cars/br-pumagtb-side': ([68, 4, 73, 10], [55, 74]),
    'cars/br-pumagte-side': ([235, 28, 244, 38], [176, 251]),
    'cars/br-santana-side': ([212, 21, 223, 33], [160, 224]),
    'cars/br-uno-side': ([141, 18, 149, 29], [100, 150]),
    'cars/br-vectra-side': ([102, 9, 109, 18], [75, 109]),
    'cars/br-voyage-side': ([214, 22, 226, 35], [150, 227]),
    'cars/br-voyagesport-side': ([224, 23, 238, 38], [165, 238]),
    'cars/countach-side': ([216, 20, 223, 27], [170, 230]), 'cars/countach-side-up': ([216, 20, 223, 27], [170, 230]),
    'cars/diablo-side': ([226, 21, 238, 32], [185, 262]), 'cars/diablo-side-up': ([226, 21, 238, 32], [185, 262]),
    'cars/patrolsv-side': ([226, 31, 238, 42], [172, 266]), 'cars/patrolsv-side-up': ([226, 31, 238, 42], [172, 266]),
    'cars/f40-side': ([177, 12, 187, 27], [145, 190]), 'cars/f40-side-up': ([177, 12, 187, 27], [145, 190]),
    'cars/nsx-side': ([173, 12, 182, 22], [120, 183], 'far'), 'cars/nsx-side-up': ([173, 12, 182, 22], [120, 183], 'far'),
    'cars/testarossa-side': ([196, 14, 206, 24], [145, 206]), 'cars/testarossa-side-up': ([196, 14, 206, 24], [145, 206]),
    'cars/viper-side': ([176, 27, 183, 34], [146, 186]),
    'cars/zr1-side': ([187, 14, 196, 26], [150, 198]),
    'cars/patrol-side': ([146, 28, 152, 38], [114, 153]),
}
SIDE_POLY = {
    'cars/patrol-side': [(130, 19), (153, 19), (153, 40), (114, 40)],
    'cars/patrolsv-side': [(205, 21), (262, 21), (266, 45), (172, 45)], 'cars/patrolsv-side-up': [(205, 21), (262, 21), (266, 45), (172, 45)],
}
SIDE_OPEN = {'cars/viper-side': [(146, 0), (186, 0), (186, 36), (146, 36)]}  # conversível: a cabeça no ar, acima da porta
# encosto de cabeça da folha (drv-man-side) e o meio da cabeça dela: a escala e o lugar saem daqui
SIDE_REF = {'hr_cx': 62.0, 'hr_top': 22, 'hr_h': 13, 'head_cx': 43.0}
DEF_REAR = [0.29, 0.04, 0.145]
DEF_FRONT = [0.71, 0.08, 0.14]
# vidro limitado a um retângulo em pixels do sprite (x0, y0, x1, y1) quando a mancha vaza
ONLY = {
    'cars/br-passat-front': (40, 0, 220, 70),
    'traffic/kenworth-front': (38, 70, 124, 100),  # só o para-brisa (grade e chaminés cromadas passavam por vidro)
}
# vidro desenhado à mão (polígono em pixels do sprite): arte sem máscara de pintura ou com o interior
# preto cortando a mancha
POLY = {
    'cars/diablo-front': [(62, 16), (158, 16), (192, 44), (27, 44)],
    'traffic/policesv-front': [(62, 18), (158, 18), (192, 45), (28, 45)],
    'cars/patrolsv-front': [(62, 18), (158, 18), (192, 45), (28, 45)],
    'cars/f40-front': [(60, 4), (140, 4), (167, 32), (33, 32)],
    'cars/patrol-rear': [(44, 22), (156, 22), (172, 51), (28, 51)],
}
# conversível visto de trás: a cabeça aparece acima do encosto, no ar (só nos pixels transparentes do
# polígono, sem vidro na frente; o banco da arte fica na frente do corpo)
OPEN = {
    # acima da linha de cima do encosto esquerdo (y 31); a cabeça fica na frente da barra (que no
    # RT/10 passa na altura do pescoço) e o banco da arte tapa o resto do corpo
    'cars/viper-rear': [(50, 6), (104, 6), (104, 31), (50, 31)],
}
OPEN_SEAT = {'cars/viper-rear': [79, 12, 17]}


def load(path):
    a = np.array(Image.open(path).convert('RGBA')).astype(int)
    return a


def labels(cand):
    h, w = cand.shape
    lab = np.zeros((h, w), int)
    sizes = [0]
    for sy in range(h):
        for sx in range(w):
            if not cand[sy, sx] or lab[sy, sx]:
                continue
            n = len(sizes)
            st, cnt = [(sy, sx)], 0
            lab[sy, sx] = n
            while st:
                y, x = st.pop()
                cnt += 1
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n
                        st.append((ny, nx))
            sizes.append(cnt)
    return lab, sizes


def components(cand, frac=0.2):
    """a maior mancha e as do lado dela (vidros separados por coluna: picape, perua) com pelo menos
    frac do tamanho da maior, na mesma faixa de linhas"""
    lab, sizes = labels(cand)
    if len(sizes) < 2:
        return np.zeros_like(cand, bool)
    big = int(np.argmax(sizes))
    ys = np.where(lab == big)[0]
    y0, y1 = ys.min(), ys.max()
    m = lab == big
    for n, sz in enumerate(sizes):
        if n == 0 or n == big or sz < sizes[big] * frac:
            continue
        yy = np.where(lab == n)[0]
        if yy.min() <= y1 and yy.max() >= y0 and min(y1, yy.max()) - max(y0, yy.min()) > (y1 - y0) * 0.5:
            m |= lab == n
    return m


def grow(core, wide):
    lab, _ = labels(wide | core)
    keep = set(np.unique(lab[core])) - {0}
    return np.isin(lab, list(keep))


def fill_holes(m):
    """o que não se liga à borda pelo lado de fora vira vidro"""
    h, w = m.shape
    out = np.zeros((h + 2, w + 2), bool)
    pad = np.zeros((h + 2, w + 2), bool)
    pad[1:-1, 1:-1] = m
    st = [(0, 0)]
    out[0, 0] = True
    while st:
        y, x = st.pop()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h + 2 and 0 <= nx < w + 2 and not pad[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                st.append((ny, nx))
    return ~out[1:-1, 1:-1]


def poly_mask(pts, h, w):
    from PIL import ImageDraw
    im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(im).polygon(pts, fill=255)
    return np.array(im) > 127


def glass_of(key):
    folder, name = key.split('/')
    a = load(os.path.join(A, folder, name + '.png'))
    h, w = a.shape[:2]
    al = a[..., 3] > 127
    if key in OPEN:
        return a, poly_mask(OPEN[key], h, w)
    if key in POLY:
        return a, poly_mask(POLY[key], h, w) & al
    mp = os.path.join(A, folder, name + '-mask.png')
    body = np.zeros((h, w), bool)
    if os.path.exists(mp):
        mk = np.array(Image.open(mp).convert('L').resize((w, h), Image.NEAREST))
        body = mk > 127
    ys, xs = np.where(al)
    y0, y1 = ys.min(), ys.max() + 1
    H = y1 - y0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = r * 0.3 + g * 0.59 + b * 0.11
    rows = np.zeros((h, w), bool)
    rows[y0 + int(H * 0.03):y0 + int(H * 0.62)] = True
    if key in ONLY:
        x0_, y0_, x1_, y1_ = ONLY[key]
        box = np.zeros((h, w), bool)
        box[y0_:y1_, x0_:x1_] = True
        rows &= box
    cand = al & ~body & (lum > 30) & (lum < 215) & (b >= r - 6) & (b >= g - 26) & ~((r > 150) & (g < 100)) & rows
    core = components(cand, 0.2)
    # a abertura inteira da janela: a partir do vidro, tudo o que não é lataria nem contorno preto
    # (encostos e bancos escuros, frisos do desembaçador), até o friso preto em volta
    wide = al & ~body & (lum >= 12) & (lum <= 225) & ~((r > 170) & (g < 90) & (b < 90)) & rows
    m = grow(core, wide)
    m = fill_holes(m) & al
    return a, m


def headrest(a, m, front):
    """meio do encosto do banco do motorista desenhado na arte (mancha escura na metade de baixo do
    vidro, do lado do motorista), ou None"""
    ys, xs = np.where(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    lum = a[..., :3] @ [0.3, 0.59, 0.11]
    gl = np.median(lum[m])
    band = np.zeros_like(m)
    band[y0 + int((y1 - y0) * 0.4):y1] = True
    dark = m & band & (lum < gl * 0.72)
    mid = (x0 + x1) // 2
    lo, hi = (mid, x1) if front else (x0, mid)
    prof = dark[:, lo:hi].sum(0).astype(float)
    if prof.sum() < 6:
        return None
    k = max(3, (x1 - x0) // 12)
    sm = np.convolve(prof, np.ones(k) / k, 'same')
    i = int(np.argmax(sm))
    if sm[i] < 1.5:
        return None
    # meio da mancha: onde o perfil cai abaixo da metade do pico, dos dois lados
    l, r_ = i, i
    while l > 0 and sm[l - 1] > sm[i] * 0.5:
        l -= 1
    while r_ < len(sm) - 1 and sm[r_ + 1] > sm[i] * 0.5:
        r_ += 1
    return lo + (l + r_ + 1) / 2


def spans(m):
    out = []
    for y in range(m.shape[0]):
        xs = np.where(m[y])[0]
        if not len(xs):
            continue
        s = xs[0]
        for p, q in zip(xs, list(xs[1:]) + [None]):
            if q is None or q != p + 1:
                out.append([int(y), int(s), int(p + 1)])
                if q is not None:
                    s = q
    return out


def seat(key, a, m):
    """[meio da cabeça, topo da cabeça, largura da cabeça] em pixels do sprite"""
    ys, xs = np.where(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    front = '-front' in key
    if key in OPEN:  # conversível: a cabeça sobre o encosto esquerdo
        return OPEN_SEAT[key]
    if key in SEATBOX:
        bx0, by0, bx1, by1 = SEATBOX[key]
        hw = HEAD_SEAT * (bx1 - bx0)
        cx = (bx0 + bx1) / 2
        # de frente: cabeça na frente do apoio de cabeça, um pouco acima dele; de trás: a nuca no topo do
        # encosto, a cabeça quase toda acima dele
        top = by0 - (0.15 if front else 0.95) * hw
        return [round(float(cx), 1), round(float(top), 1), round(float(hw), 1)]
    u, f, hw = SEAT.get(key, DEF_FRONT if front else DEF_REAR)
    return [round(float(x0 + u * (x1 - x0)), 1), round(float(y0 + f * (y1 - y0)), 1), round(float(hw * (x1 - x0)), 1)]


def side_glass(key):
    folder, name = key.split('/')
    a = load(os.path.join(A, folder, name + '.png'))
    h, w = a.shape[:2]
    hr, win = SIDE[key][0], SIDE[key][1]
    if key in SIDE_OPEN:
        return a, poly_mask(SIDE_OPEN[key], h, w)
    if key in SIDE_POLY:
        m = poly_mask(SIDE_POLY[key], h, w) & (a[..., 3] > 127)
    else:
        _, m = glass_of(key)
    cols = np.zeros_like(m)
    cols[:, win[0]:win[1]] = True
    return a, m & cols


# comprimento real de cada carro (m): na lateral a cabeça (~21 cm de frente a nuca) sai na proporção do
# carro inteiro da arte, igual em todos (antes vinha da altura do encosto medido, que variava muito)
CAR_LEN = {
    '959': 4.26, 'br-corsa': 3.73, 'br-golgti': 3.81, 'br-kadett': 4.03, 'br-monza': 4.36, 'br-monzacoupe': 4.26,
    'br-passat': 4.19, 'br-pumagtb': 4.10, 'br-pumagte': 4.00, 'br-santana': 4.53, 'br-uno': 3.64, 'br-vectra': 4.43,
    'br-voyage': 4.07, 'br-voyagesport': 4.07, 'countach': 4.14, 'diablo': 4.46, 'patrolsv': 4.46, 'f40': 4.36,
    'nsx': 4.40, 'testarossa': 4.49, 'viper': 4.45, 'zr1': 4.53, 'patrol': 4.90,
}
HEAD_M = 0.21


def side_seat(key):
    hr = SIDE[key][0]
    R = SIDE_REF
    folder, name = key.split('/')
    al = load(os.path.join(A, folder, name + '.png'))[..., 3] > 0
    xs = np.nonzero(al.any(0))[0]
    L = xs.max() - xs.min() + 1
    s = HEAD_M / CAR_LEN[name.replace('-side-up', '').replace('-side', '')] * L / REF_HEAD
    hcx = (hr[0] + hr[2]) / 2
    cx = hcx - (R['hr_cx'] - R['head_cx']) * s
    top = hr[1] - R['hr_top'] * s
    return [round(cx, 1), round(top, 1), round(REF_HEAD * s, 1)]


def side_protect(key, a, m):
    """mão inglesa: o encosto do banco do passageiro (o da arte, mais perto de nós) fica na frente"""
    p = np.zeros_like(m)
    if len(SIDE[key]) < 3:
        return p
    x0, y0, x1, y1 = SIDE[key][0]
    L = lumof(a[..., :3].astype(float))
    gl = np.median(L[m])
    p[y0 - 1:, x0 - 1:x1 + 2] = True
    return p & m & (L < gl * 0.85)


def lumof(c):
    return c @ np.array([0.3, 0.59, 0.11])


def protect(key, a, m):
    """de trás: os pixels do banco da arte (encosto e apoio de cabeça) que ficam na frente do motorista"""
    p = np.zeros_like(m)
    if key not in SEATBOX or '-front' in key:
        return p
    bx0, by0, bx1, by1 = SEATBOX[key]
    L = lumof(a[..., :3].astype(float))
    gl = np.median(L[m])
    box = np.zeros_like(m)
    box[max(0, by0 - 1):by1 + 1, max(0, bx0 - 1):bx1 + 1] = True
    return box & m & (L < gl * 0.85)


def clip_row(key):
    """de trás, com banco na arte: o motorista só até um pouco abaixo do topo do encosto (cabeça, pescoço e
    a ponta dos ombros); o banco dele na folha não entra"""
    if key not in SEATBOX or '-front' in key:
        return None
    bx0, by0, bx1, by1 = SEATBOX[key]
    return int(round(by0 + 0.25 * (by1 - by0)))


def tones(key, a, m):
    """cor do vidro (mediana) e o tom do interior visto pelo vidro (sombras sem cor forte: bancos escuros,
    painel), que dá a cor do motorista"""
    px = a[m][:, :3].astype(float)
    G = np.median(px, 0)
    L = lumof(px)
    mx, mn = px.max(1), px.min(1)
    sat = (mx - mn) / np.maximum(mx, 1)
    sh = px[(L < lumof(G) * 0.85) & (sat < 0.5)]
    T = np.median(sh, 0) if len(sh) > 8 else G * 0.6
    tl = lumof(T)
    if tl < 45:  # vidro quase preto (Toro V12): o motorista não some de todo
        T = T * (45 / max(tl, 1)) if tl > 5 else T + 45
    return G, T


# ---- simulação do desenho do jogo (src/drivers.ts), para a folha de conferência ----
DRV = os.path.join(A, 'people')


def compose(a, m, d, did, view, open_=False, prot=None, G=None, T=None, clip=None, cut=False):
    meta = json.load(open(os.path.join(DRV, 'drivers.json')))
    mt = meta[f'{did}-{view}']
    dw, dh, hcx = mt[:3]
    ccol = mt[9] if cut and len(mt) > 9 else 1e9  # lateral: o banco da folha sai (fica o da arte)
    im = Image.open(os.path.join(DRV, f'drv-{did}-{view}.png')).convert('RGBA')
    cx, top, hw = d
    s = hw / REF_HEAD
    nw, nh = max(1, round(dw * s)), max(1, round(dh * s))
    sm = np.array(im.resize((nw, nh), Image.BILINEAR if s < 1 else Image.NEAREST)).astype(float)
    ox, oy = round(cx - hcx * s), round(top)
    out = a.astype(float).copy()
    for y in range(nh):
        for x in range(nw):
            X, Y = ox + x, oy + y
            if not (0 <= X < a.shape[1] and 0 <= Y < a.shape[0]) or not m[Y, X]:
                continue
            if sm[y, x, 3] < 128 or (prot is not None and prot[Y, X]) or (clip is not None and Y > clip) or x >= ccol * s:
                continue
            dc = sm[y, x, :3]
            out[Y, X, :3] = dc * 0.85 if open_ else shade(dc, G, T, a[Y, X, :3].astype(float))
            out[Y, X, 3] = 255
    return out.clip(0, 255).astype(np.uint8)


REF_HEAD = 22.0  # largura da cabeça do motorista na folha (px nativos): o jogo escala por ela


def shade(dc, G, T, orig):
    """o mesmo que tint() em src/drivers.ts: o motorista no tom do interior visto pelo vidro (T, o dos
    bancos escuros), quase sem cor própria, com o desenho dele em claro/escuro; os reflexos claros do vidro
    da arte continuam por cima"""
    L = lumof(dc)
    c = L + (dc - L) * 0.35  # pouca cor
    c = T * (0.55 + 1.7 * c / 255)  # claro/escuro do desenho em volta do tom do interior
    ref = max(0.0, lumof(orig) - lumof(G) - 25)  # brilho/reflexo do vidro da arte
    return c + ref * 0.8


def main():
    sheet = sys.argv[1] if len(sys.argv) > 1 else None
    keys = []
    for m in ['sedan', 'hatch', 'pickup', 'van', 'truck', 'fusca', 'kombi', 'suv', 'sedan90', 'police', 'policesv',
              'kenworth', 'f4000', 'cargo', 'mb1113', 'vw790', 'volvon10']:
        for v in ['rear', 'front']:
            keys.append(f'traffic/{m}-{v}')
    for f in sorted(os.listdir(os.path.join(A, 'cars'))):
        if f.endswith('.png') and ('-rear' in f or '-front' in f) and 'mask' not in f:
            keys.append('cars/' + f[:-4])
    out, tiles = {}, []
    for k in SIDE:
        a, m = side_glass(k)
        d = side_seat(k)
        G, T = tones(k, a, m) if k not in SIDE_OPEN else (np.array([60.0, 60, 60]), np.array([60.0, 60, 60]))
        pr = side_protect(k, a, m)
        far = len(SIDE[k]) > 2
        if far:
            T = T * 0.7
        out[k] = {'s': spans(m), 'd': d, 'g': [int(v) for v in G], 't': [int(v) for v in T], **({'p': spans(pr)} if pr.any() else {}), **({'o': 1} if k in SIDE_OPEN else {}), **({'f': 1} if far else {})}
        if sheet:
            tiles.append((k, [a.astype(np.uint8), compose(a, m, d, 'man', 'side', k in SIDE_OPEN, pr, G, T, None, True), compose(a, m, d, 'rival', 'side', k in SIDE_OPEN, pr, G, T, None, True)]))
    for k in keys:
        if k in SKIP:
            continue
        a, m = glass_of(k)
        if m.sum() < 20:
            print('sem vidro', k)
            continue
        d = seat(k, a, m)
        pr = protect(k, a, m)
        G, T = tones(k, a, m)
        out[k] = {'s': spans(m), 'd': d, 'g': [int(v) for v in G], 't': [int(v) for v in T], **({'p': spans(pr)} if pr.any() else {}), **({'c': clip_row(k)} if clip_row(k) is not None else {}), **({'o': 1} if k in OPEN else {})}
        if sheet:
            view = 'front' if '-front' in k else 'back'
            ov = a.copy()
            ov[m, 0] = 255
            ov[m, 3] = 255
            ov[m, 1] = ov[m, 1] // 2
            comp = compose(a, m, d, 'man', view, k in OPEN, pr, G, T, clip_row(k))
            comp2 = compose(a, m, d, 'rival', view, k in OPEN, pr, G, T, clip_row(k))
            tiles.append((k, [a.astype(np.uint8), comp, comp2]))
    with open(os.path.join(A, 'people', 'glass.json'), 'w') as fh:
        json.dump(out, fh, separators=(',', ':'))
    print(len(out), 'vidros')
    if sheet:
        from PIL import ImageDraw
        cw, ch, per = 440, 240, 6
        for n in range(0, len(tiles), per):
            part = tiles[n:n + per]
            sh = Image.new('RGBA', (3 * cw, len(part) * ch), (255, 0, 255, 255))
            dr = ImageDraw.Draw(sh)
            for i, (k, ims) in enumerate(part):
                for j, im in enumerate(ims):
                    p = Image.fromarray(im)
                    sc = min(cw / p.width, (ch - 12) / p.height, 3)
                    p = p.resize((max(1, int(p.width * sc)), max(1, int(p.height * sc))), Image.NEAREST)
                    sh.alpha_composite(p, (j * cw, i * ch + 12))
                dr.text((2, i * ch), k, fill=(255, 255, 255))
            sh.save(sheet.replace('.png', f'-{n // per}.png'))

if __name__ == '__main__':
    main()
