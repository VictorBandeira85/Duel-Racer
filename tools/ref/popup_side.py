"""Lateral com os faróis escamoteáveis LEVANTADOS (<arte>-side-up.png e -side-up-mask.png).

A caixa do farol é desenhada em pixel art por cima da lateral pronta (src/assets/cars/<arte>-side.png),
no estilo da própria arte: contorno escuro de 1 px, brilho na aresta de cima, miolo e sombra embaixo,
com as cores tiradas da lataria logo abaixo do capô (cores que já existem na arte: a paleta não muda).
Vista de lado, a caixa levantada fica com a face (lente) virada para a frente e o tampo na horizontal:
um calço que sai do capô na frente com a altura `h` e morre no capô atrás (o capô sobe para trás).
Na frente fica só a borda da lente (1 px, já ACESA: no jogo os faróis só sobem acesos) com o aro
cromado em cima/embaixo e a carcaça escura atrás dela; o resto é a lateral da caixa na cor da
carroceria, que entra na máscara de pintura (repinta junto com o carro).

O jogo usa este sprite na tela do posto à noite (drawCarSide(..., lit) em cars.ts) e desenha um
brilho curto para a frente no ponto `popSide` de LAMPS (o script imprime o valor de cada carro).

Medidas por carro (pixels da lateral, frente para a esquerda):
  x0: coluna da face do farol (onde a caixa começa)
  h:  altura da face acima do capô (o tampo fica nessa altura até encostar no capô atrás)
Posição: a do farol do carro de verdade (pouco atrás do bico, à frente da roda dianteira).

Uso: python3 tools/ref/popup_side.py [arte ...] [--preview <pasta>]
"""
import colorsys
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
CARS = os.path.join(ROOT, 'src', 'assets', 'cars')

# x0, h: caixas baixas e largas no Diablo/LP5 (Countach), fina no Testarossa, larga e baixa no NSX,
# pequena na F40 (logo atrás dos faróis fixos sob o acrílico)
SPEC = {
    # caixa fechada (style box) em todos: a cunha fina antiga sumia na tela do posto (lente de 1 px)
    'diablo': dict(x0=48, h=16, style='box', depth=28, lift=4),
    'patrolsv': dict(x0=48, h=16, style='box', depth=28, lift=4, mask=False),  # viatura: sem máscara de pintura
    # LP5: caixa fechada e alta (como na countach-front-up: dois faróis redondos numa moldura preta),
    # com face da lente de 2 px acesa, moldura preta, traseira reta e o vão preto embaixo (levantada)
    'countach': dict(x0=40, h=19, style='box', depth=29, lift=5),
    'testarossa': dict(x0=30, h=11, style='box', depth=24, lift=3),
    'nsx': dict(x0=22, h=11, style='box', depth=26, lift=3),
    'f40': dict(x0=25, h=9, style='box', depth=18, lift=2),
}

LENS = (255, 246, 214)  # borda da lente acesa (branco quente)
CHROME = (206, 210, 216)
HOUSING = (34, 34, 40)


def lum(c):
    return (max(c) + min(c)) / 2  # luminosidade HSL (a mesma da repintura)


def hsv(c):
    h, s_, _ = colorsys.rgb_to_hsv(*(v / 255 for v in c))
    return h, s_


def palette(S, M, top, x0, x1):
    """Cores da lataria logo abaixo do capô: brilho, miolo, sombra e contorno (cores da arte)."""
    cols = []
    for x in range(x0, min(x1 + 12, S.shape[1])):
        y = top[x]
        for yy in range(y + 1, min(y + 11, S.shape[0])):
            if S[yy, x, 3] and (M is None or M[yy, x, 0] > 127):
                cols.append(tuple(int(v) for v in S[yy, x, :3]))
    cols.sort(key=lum)
    n = len(cols)

    def common(a, b):
        part = cols[int(n * a):max(int(n * a) + 1, int(n * b))]
        vals, cnt = np.unique(np.array(part), axis=0, return_counts=True)
        return tuple(int(v) for v in vals[cnt.argmax()])

    outline = min((tuple(int(v) for v in S[top[x], x, :3]) for x in range(x0, x1 + 1)), key=lum)
    hi, mid = common(0.8, 1.0), common(0.4, 0.65)
    # tons intermediários: as cores mais usadas da lataria em volta (paleta da própria arte), pela
    # luminosidade: meio-tom entre o brilho e o miolo, e a sombra a ~70% do miolo
    near = {}
    for x in range(max(0, x0 - 20), min(x1 + 40, S.shape[1])):
        for yy in range(top[x] + 1, min(top[x] + 30, S.shape[0])):
            if S[yy, x, 3] and (M is None or M[yy, x, 0] > 127):
                c = tuple(int(v) for v in S[yy, x, :3])
                near[c] = near.get(c, 0) + 1
    hm, sm = hsv(mid)
    # mesma família de cor do miolo (nada de tom rosado/acinzentado num carro vermelho)
    cand = [c for c, k in near.items() if k >= 3 and lum(c) > 0.3 * lum(mid)
            and (sm < 0.25 or (min(abs(hsv(c)[0] - hm), 1 - abs(hsv(c)[0] - hm)) < 0.05 and hsv(c)[1] > 0.6 * sm))]

    def nearest(t):
        return min(cand, key=lambda c: abs(lum(c) - t))

    return dict(hi=hi, mid2=nearest((lum(hi) + lum(mid)) / 2), mid=mid, lo=nearest(0.72 * lum(mid)), out=outline)


def build(art, spec):
    S = np.array(Image.open(os.path.join(CARS, f'{art}-side.png')).convert('RGBA'))
    mpath = os.path.join(CARS, f'{art}-side-mask.png')
    M = np.array(Image.open(mpath).convert('RGBA')) if spec.get('mask', True) and os.path.exists(mpath) else None
    H, W = S.shape[:2]
    top = [int(np.argmax(S[:, x, 3] > 0)) if S[:, x, 3].any() else H for x in range(W)]
    x0, h = spec['x0'], spec['h']
    yt = top[x0] - h  # linha do tampo (horizontal)
    # a caixa vai até o capô alcançar o tampo
    x1 = x0
    while top[x1 + 1] > yt + 1:
        x1 += 1
    pal = palette(S, M, top, x0, x1)
    O = S.copy()
    MO = M.copy() if M is not None else None

    def put(x, y, c, paint=False):
        O[y, x, :3] = c
        O[y, x, 3] = 255
        if MO is not None:
            MO[y, x, :3] = 255 if paint else 0
            MO[y, x, 3] = 255

    # contorno: frente (coluna x0-1) e tampo (linha yt-1), até encostar no capô
    for y in range(yt - 1, top[x0 - 1]):
        put(x0 - 1, y, pal['out'])
    for x in range(x0 - 1, x1 + 2):
        if top[x] > yt - 1:
            put(x, yt - 1, pal['out'])
    for x in range(x0, x1 + 1):
        yb = top[x]  # o contorno do capô fica (a fresta entre a caixa e o capô)
        for y in range(yt, yb):
            if x == x0:  # borda da lente acesa, aro cromado em cima e embaixo
                put(x, y, CHROME if y in (yt, yb - 1) else LENS)
            elif x == x0 + 1:  # carcaça escura logo atrás da lente
                put(x, y, HOUSING)
            elif y == yt:  # aresta de cima: brilho
                put(x, y, pal['hi'], True)
            elif y == yt + 1 and yb - yt > 3:  # meio-tom logo abaixo do brilho
                put(x, y, pal['mid2'], True)
            elif y >= yb - 2 and yb - yt > 3:  # embaixo: sombra
                put(x, y, pal['lo'], True)
            else:
                put(x, y, pal['mid'], True)
    lens_v = (yt + top[x0]) / 2
    return O, MO, (round((x0 + 0.5) / W, 3), round(lens_v / H, 3)), pal, (x0, x1, yt)


def build_box(art, spec):
    """Caixa levantada fechada (LP5): face da frente com aro cromado, lente acesa de 2 px e moldura
    preta; lateral na cor da carroceria com brilho em cima e sombra embaixo; traseira reta; embaixo da
    caixa, o vão preto do alojamento (a caixa subiu: entre ela e o capô aparece o buraco), que some
    junto da dobradiça atrás."""
    S = np.array(Image.open(os.path.join(CARS, f'{art}-side.png')).convert('RGBA'))
    mpath = os.path.join(CARS, f'{art}-side-mask.png')
    M = np.array(Image.open(mpath).convert('RGBA')) if spec.get('mask', True) and os.path.exists(mpath) else None
    H, W = S.shape[:2]
    top = [int(np.argmax(S[:, x, 3] > 0)) if S[:, x, 3].any() else H for x in range(W)]
    x0, h, D, lift = spec['x0'], spec['h'], spec['depth'], spec['lift']
    x1 = x0 + D
    yt = top[x0] - h
    pal = palette(S, M, top, x0, x1)
    O = S.copy()
    MO = M.copy() if M is not None else None

    def put(x, y, c, paint=False):
        O[y, x, :3] = c
        O[y, x, 3] = 255
        if MO is not None:
            MO[y, x, :3] = 255 if paint else 0
            MO[y, x, 3] = 255

    def bottom(x):  # fundo da caixa: `lift` px acima do capô na frente, encosta no capô na dobradiça
        k = (x - x0) / D
        return int(round(top[x0] - lift + k * (top[x1] - (top[x0] - lift))))

    CAV = (12, 12, 16)
    for x in range(x0 - 1, x1 + 2):
        yb = bottom(min(max(x, x0), x1))
        for y in range(yt - 1, max(yb, top[x]) + 1):
            if y >= top[x] and y > yb:
                break
            edge = x in (x0 - 1, x1 + 1) or y in (yt - 1, yb)
            if y > yb:  # vão do alojamento, entre a caixa e o capô
                put(x, y, CAV)
            elif edge:
                put(x, y, pal['out'])
            elif x == x0:  # aro cromado da face
                put(x, y, CHROME)
            elif x0 + 1 <= x <= x0 + 3:  # lente acesa (aro em cima e embaixo), larga para ler no celular
                put(x, y, CHROME if y in (yt, yb - 1) else LENS)
            elif x in (x0 + 4, x0 + 5):  # moldura preta dos faróis
                put(x, y, HOUSING)
            elif y == yt:
                put(x, y, pal['hi'], True)
            elif y == yt + 1:
                put(x, y, pal['mid2'], True)
            elif y >= yb - 2:
                put(x, y, pal['lo'], True)
            else:
                put(x, y, pal['mid'], True)
        # o vão continua até o capô (embaixo da caixa)
        if x0 <= x <= x1:
            for y in range(bottom(x) + 1, top[x]):
                put(x, y, CAV)
    lens_v = (yt + bottom(x0)) / 2
    return O, MO, (round((x0 + 2.5) / W, 3), round(lens_v / H, 3)), pal, (x0, x1, yt)


def main():
    args = sys.argv[1:]
    prev = None
    if '--preview' in args:
        i = args.index('--preview')
        prev = args[i + 1]
        del args[i:i + 2]
        os.makedirs(prev, exist_ok=True)
    for art in args or list(SPEC):
        O, MO, lens, pal, box = (build_box if SPEC[art].get('style') == 'box' else build)(art, SPEC[art])
        Image.fromarray(O).save(os.path.join(CARS, f'{art}-side-up.png'))
        if MO is not None:
            Image.fromarray(MO).save(os.path.join(CARS, f'{art}-side-up-mask.png'))
        print(f'{art}: caixa x {box[0]}..{box[1]} tampo y {box[2]}  popSide: [{lens[0]}, {lens[1]}]  cores {pal}')
        if prev:
            w = O.shape[1] // 2
            for name, im in (('up', O), ('orig', np.array(Image.open(os.path.join(CARS, f'{art}-side.png')).convert('RGBA')))):
                bg = Image.new('RGBA', (w, im.shape[0]), (90, 140, 90, 255))
                bg.alpha_composite(Image.fromarray(im[:, :w]))
                bg.resize((w * 4, im.shape[0] * 4), Image.NEAREST).save(os.path.join(prev, f'{art}-{name}.png'))


if __name__ == '__main__':
    main()
