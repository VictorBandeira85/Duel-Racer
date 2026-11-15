"""Queda das motos do trânsito (arte do Victor: folha com 4 quadros vistos de TRÁS, fundo magenta):
1) moto derrapando inclinada com o piloto; 2) piloto voando, moto deitada soltando faísca;
3) moto deitada com poeira + piloto rolando; 4) moto caída + piloto sentado tonto com estrelas.

Cada quadro é recortado em peças separadas (moto e piloto, por componentes conexos) para o jogo
deslizar a moto e o piloto no asfalto com distâncias próprias (src/motofall.ts):
  skid  = quadro 1 inteiro (moto + piloto + fumaça do pneu)
  slide = moto do quadro 2 (com as faíscas)      fly  = piloto do quadro 2 (no ar)
  dust  = moto do quadro 3 (com a poeira)        roll = piloto do quadro 3 (bola + riscos de giro)
  down  = moto do quadro 4 (parada)              sit  = piloto do quadro 4 (sentado, com as estrelas)
No quadro 4 a moto e o piloto se encostam (retrovisor no joelho): separados por watershed com
sementes (moto à esquerda, piloto à direita), que corta pelo contorno preto.

Pixel art como em tools/ref/motos.py (cor do miolo de cada bloco + paleta curta, magenta vira
transparente), na MESMA escala dos sprites moto-*-rear: o fator sai da altura do quadro 1 (moto em pé,
um pouco inclinada) contra a altura do sprite da traseira.

Grava src/assets/motofall/<modelo>-<peça>.png e src/assets/motofall/motofall.json (largura e altura
de cada peça em pixels do sprite, e a lanterna medida nas peças da moto, para a luz à noite).

Uso: python3 tools/ref/motofall.py <custom.png> <sport.png> <pop.png>
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from motos import magenta, shrink  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'src/assets/motofall')
TRAFFIC = os.path.join(ROOT, 'src/assets/traffic')
# fronteiras dos quadros na folha (2172 px de largura; medidas nas colunas vazias)
FRAMES = [(0, 460), (460, 990), (990, 1570), (1570, 2172)]
# quadro 4: sementes do watershed, retângulos (x0, y0, x1, y1) na folha medidos no encosto (moto: a
# traseira e o guidão com o retrovisor; piloto: o tronco e a bota que encosta no retrovisor)
SPLIT = {
    'custom': ([(0, 0, 1790, 724), (0, 0, 1870, 495)], [(1935, 0, 2172, 724), (1835, 520, 2172, 724)]),
    'sport': ([(0, 0, 1760, 724), (0, 0, 1860, 500)], [(1930, 0, 2172, 724), (1830, 525, 2172, 724)]),
    'pop': ([(0, 0, 1790, 724), (0, 0, 1880, 515)], [(1945, 0, 2172, 724), (1830, 528, 2172, 724)]),
}
# o quadro 1 é a moto inclinada: perde um pouco de altura em relação à traseira em pé
SKID_H = 0.97


def light(a, m):
    """componente pequeno e quase todo claro (riscos brancos de movimento)"""
    px = a[m]
    return px.size and (px.min(axis=1) > 170).mean() > 0.6


def comps(fg, x0, x1):
    m = np.zeros_like(fg)
    m[:, x0:x1] = fg[:, x0:x1]
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
    return [(lab == i, st[i]) for i in range(1, n) if st[i, 4] >= 25]


def near(st, box, pad):
    x, y, w, h = st[:4]
    return x < box[2] + pad and x + w > box[0] - pad and y < box[3] + pad and y + h > box[1] - pad


def box_of(m):
    ys, xs = np.nonzero(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def pieces(model, a, fg):
    mag = magenta(a)
    out = {}
    # quadro 1: tudo (moto, piloto, fumaça, riscos do pneu)
    m = np.zeros_like(fg)
    m[:, FRAMES[0][0]:FRAMES[0][1]] = fg[:, FRAMES[0][0]:FRAMES[0][1]]
    out['skid'] = m
    # quadros 2 e 3: o maior componente de cima é o piloto, o de baixo é a moto; os pequenos vão para
    # a peça mais perto (faíscas e poeira com a moto, riscos de giro com a bola); riscos brancos de
    # movimento em volta da moto deitada (quadro 2) saem
    for k, (moto_name, rider_name) in ((1, ('slide', 'fly')), (2, ('dust', 'roll'))):
        cs = comps(fg, *FRAMES[k])
        big = sorted(cs, key=lambda c: -c[1][4])[:2]
        if k == 1:
            rider, moto = sorted(big, key=lambda c: c[1][1])  # o de cima voa
        else:
            moto, rider = sorted(big, key=lambda c: c[1][0])  # a bola rola à direita
        mm, rm = moto[0].copy(), rider[0].copy()
        mb, rb = box_of(mm), box_of(rm)
        for c, st in cs:
            if c is moto[0] or c is rider[0]:
                continue
            if k == 1 and light(a, c):
                continue
            dm = abs(st[0] + st[2] / 2 - (mb[0] + mb[2]) / 2) + abs(st[1] + st[3] / 2 - (mb[1] + mb[3]) / 2)
            dr = abs(st[0] + st[2] / 2 - (rb[0] + rb[2]) / 2) + abs(st[1] + st[3] / 2 - (rb[1] + rb[3]) / 2)
            if k == 2 and near(st, rb, 60) and dr < dm:
                rm |= c
            elif near(st, mb, 30):
                mm |= c
        out[moto_name], out[rider_name] = mm, rm
    # quadro 4: estrelas e anel com o piloto; moto e piloto separados por watershed
    x0, x1 = FRAMES[3]
    cs = comps(fg, x0, x1)
    body = max(cs, key=lambda c: c[1][4])[0]
    mark = np.zeros(a.shape[:2], np.int32)
    mark[mag] = 1
    mark[:, :x0] = 1
    for lbl, rects in zip((2, 3), SPLIT[model]):
        for rx0, ry0, rx1, ry1 in rects:
            r = np.zeros_like(body)
            r[ry0:ry1, max(rx0, x0):rx1] = True
            mark[body & r] = lbl
    ws = cv2.watershed(np.ascontiguousarray(a.astype(np.uint8)[..., ::-1]), mark.copy())
    moto = body & (ws == 2)
    rider = body & (ws == 3)
    # as linhas do watershed (-1) dentro do desenho vão para o lado com mais vizinhos
    edge = body & (ws == -1)
    dm = cv2.dilate(moto.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    moto |= edge & dm & ~(cv2.dilate(rider.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    rider |= edge & ~moto
    # farelos soltos do corte voltam para o outro lado
    for _ in range(2):
        for src, dst in ((moto, rider), (rider, moto)):
            n, lab, st, _ = cv2.connectedComponentsWithStats(src.astype(np.uint8), connectivity=8)
            keep = 1 + int(np.argmax(st[1:, 4]))
            for i in range(1, n):
                if i != keep and st[i, 4] < 400:
                    src[lab == i] = False
                    dst[lab == i] = True
    rb = box_of(rider)
    for c, st in cs:
        if c is body or not near(st, rb, 40):
            continue
        rider |= c  # estrelas e o anel delas (farelos longe do piloto ficam de fora)
    out['down'], out['sit'] = moto, rider
    return out


def lamp(o, lying):
    """lanterna (vermelho vivo) da moto deitada: [u, f] na peça"""
    H, W = o.shape[:2]
    hsv = cv2.cvtColor(np.ascontiguousarray(o[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue, sat, val = hsv[..., 0] * 360 / 256, hsv[..., 1], hsv[..., 2]
    red = (o[..., 3] > 0) & ((hue < 16) | (hue > 345)) & (sat > 150) & (val > 175)
    if lying:  # deitada: a traseira (lanterna) fica na metade esquerda; o tanque/carenagem à direita
        red[:, int(W * 0.56):] = False
    n, lab, st, cen = cv2.connectedComponentsWithStats(red.astype(np.uint8))
    if n < 2:
        return None
    # o bloco vermelho mais compacto e mais à esquerda da metade (a lanterna fica na traseira, junto da
    # placa; faixas vermelhas da carenagem são compridas)
    best = max(range(1, n), key=lambda i: st[i, 4] / max(1, st[i, 2] * st[i, 3]) * st[i, 4])
    return [round(cen[best][0] / W, 3), round(cen[best][1] / H, 3)]


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for model, path in zip(('custom', 'sport', 'pop'), sys.argv[1:4]):
        a = np.array(Image.open(path).convert('RGB')).astype(int)
        mag = magenta(a)
        fg = cv2.morphologyEx((~mag).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
        rear = Image.open(os.path.join(TRAFFIC, f'moto-{model}-rear.png'))
        ps = pieces(model, a, fg)
        sb = box_of(ps['skid'])
        f = (sb[3] - sb[1]) / (rear.size[1] * SKID_H)
        meta[model] = {}
        for name, m in ps.items():
            box = box_of(m)
            o = shrink(a.astype(np.uint8), m & ~mag, box, f, colors=32)
            al = o[..., 3] > 0
            ys, xs = np.nonzero(al)
            o = o[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            Image.fromarray(o).save(os.path.join(OUT, f'{model}-{name}.png'), optimize=True)
            info = {'w': int(o.shape[1]), 'h': int(o.shape[0])}
            if name in ('skid', 'slide', 'dust', 'down'):
                info['lamp'] = lamp(o, name != 'skid')
            meta[model][name] = info
            print(model, name, info, 'fator', round(f, 2))
    with open(os.path.join(OUT, 'motofall.json'), 'w') as fh:
        json.dump(meta, fh, indent=1)


if __name__ == '__main__':
    main()
