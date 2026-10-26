"""Carros do trânsito e viatura da polícia (traseira e frente), 160 px de largura.

A carroceria fica marcada na máscara: no jogo cada carro do trânsito recebe uma cor.
Saída: src/assets/traffic/<modelo>-rear.png / -front.png (+ máscaras) e traffic.json
com a altura relativa de cada sprite e as luzes (freio e giroflex), em frações.
"""
import json
import os
import sys

from kit import Pic

W = 160
GLASS, GLASS_HI, BLACK, DARK, GREY = (38, 48, 62), (90, 110, 132), (14, 14, 16), (40, 40, 44), (96, 98, 104)
RED, RED_D, AMBER, WHITE, CHROME = (214, 26, 22), (120, 12, 10), (240, 150, 30), (236, 236, 228), (190, 192, 198)
BASE = '#2a6fdb'


def tires(p, w=24, h=18, inset=12):
    for x0 in (inset, W - inset - w):
        p.rect(x0, 0, x0 + w, h, BLACK)
        for y in range(2, h, 4):
            p.line([x0 + 2, y, x0 + w - 2, y], (30, 30, 34, 255))


def plate(p, y, w=28, h=8):
    p.rect(80 - w // 2, y, 80 + w // 2, y + h, WHITE)
    p.rect(80 - w // 2 + 2, y + 2, 80 + w // 2 - 2, y + h - 2, (150, 150, 150))


def mirrors(p, y):
    for x in (2, W - 12):
        p.rect(x, y, x + 10, y + 6, 'body', body=True)
        p.rect(x + 1, y + 1, x + 9, y + 2, 'hi', body=True)


def shade(p, deck):
    p.band(0, deck - 12, 'sh')
    p.band(0, 14, 'sh2')
    p.edge_light()


def cabin(p, y0, y1, w0, w1, glass_inset=6):
    p.poly([80 - w0, y0, 80 + w0, y0, 80 + w1, y1, 80 - w1, y1], 'body', body=True)
    p.poly([80 - w0 + glass_inset, y0 + 2, 80 + w0 - glass_inset, y0 + 2, 80 + w1 - glass_inset + 2, y1 - 3,
            80 - w1 + glass_inset - 2, y1 - 3], GLASS)
    p.poly([80 - w0 + glass_inset + 6, y0 + 3, 80 - w0 + glass_inset + 14, y0 + 3, 80 - w1 + glass_inset + 10, y1 - 4,
            80 - w1 + glass_inset + 4, y1 - 4], GLASS_HI)


# ------------------------------------------------------------- traseiras
def sedan_rear(color=BASE, police=False):
    p = Pic(W, 92, color)
    tires(p)
    p.poly([4, 10, 156, 10, 159, 22, 158, 46, 150, 52, 10, 52, 2, 46, 1, 22], 'body', body=True)
    cabin(p, 52, 80, 58, 44)
    shade(p, 46)
    p.rect(2, 10, 158, 16, BLACK)
    p.rect(4, 12, 156, 14, CHROME)
    for x0 in (8, 120):
        p.rect(x0, 30, x0 + 32, 42, BLACK)
        p.rect(x0 + 1, 31, x0 + 31, 41, RED)
        p.rect(x0 + (1 if x0 < 80 else 21), 31, x0 + (11 if x0 < 80 else 31), 41, AMBER)
        p.rect(x0 + 1, 38, x0 + 31, 39, (255, 110, 90))
    plate(p, 20)
    p.rect(68, 4, 74, 9, CHROME)
    mirrors(p, 54)
    if police:
        p.rect(52, 80, 108, 86, BLACK)
        p.rect(54, 81, 79, 85, (150, 20, 20))
        p.rect(81, 81, 106, 85, (20, 40, 150))
    p.outline()
    glow = {'dots': [[0.15, 0.6], [0.85, 0.6]]}
    if police:
        glow['siren'] = [[0.34, 0.07, 0.49, 0.11], [0.51, 0.07, 0.66, 0.11]]
    return p, glow


def hatch_rear(color=BASE):
    p = Pic(W, 96, color)
    tires(p, inset=14)
    p.poly([6, 10, 154, 10, 157, 22, 156, 44, 148, 50, 12, 50, 4, 44, 3, 22], 'body', body=True)
    cabin(p, 44, 84, 56, 46, 8)
    shade(p, 44)
    p.rect(4, 10, 156, 16, BLACK)
    for x0 in (10, 134):
        p.rect(x0, 24, x0 + 16, 46, BLACK)
        p.rect(x0 + 1, 25, x0 + 15, 45, RED)
        p.rect(x0 + 1, 25, x0 + 15, 30, AMBER)
    plate(p, 22)
    p.rect(30, 4, 36, 9, CHROME)
    mirrors(p, 50)
    p.outline()
    return p, {'dots': [[0.11, 0.62], [0.89, 0.62]]}


def pickup_rear(color=BASE):
    p = Pic(W, 98, color)
    tires(p, w=26, inset=10)
    # caçamba: tampa traseira larga; cabine mais estreita lá na frente
    p.poly([4, 12, 156, 12, 158, 24, 158, 56, 2, 56, 2, 24], 'body', body=True)
    p.poly([28, 56, 132, 56, 128, 86, 32, 86], 'body', body=True)
    p.poly([36, 62, 124, 62, 120, 82, 40, 82], GLASS)
    p.poly([44, 63, 52, 63, 48, 81, 44, 81], GLASS_HI)
    shade(p, 56)
    p.rect(2, 52, 158, 56, 'sh2', body=True)
    p.line([10, 30, 150, 30], 'sh2', body=True)
    p.rect(0, 8, 160, 14, CHROME)
    for x0 in (4, 146):
        p.rect(x0, 22, x0 + 10, 50, BLACK)
        p.rect(x0 + 1, 23, x0 + 9, 49, RED)
        p.rect(x0 + 1, 23, x0 + 9, 30, AMBER)
    plate(p, 16)
    mirrors(p, 60)
    p.outline()
    return p, {'dots': [[0.06, 0.6], [0.94, 0.6]]}


def van_rear(color=BASE):
    p = Pic(W, 132, color)
    tires(p, w=24, inset=14)
    p.poly([4, 12, 156, 12, 158, 22, 158, 122, 150, 130, 10, 130, 2, 122, 2, 22], 'body', body=True)
    shade(p, 120)
    p.line([80, 18, 80, 124], 'sh3', body=True)
    for x0 in (14, 86):
        p.rect(x0, 84, x0 + 60, 118, GLASS)
        p.rect(x0 + 4, 86, x0 + 14, 116, GLASS_HI)
    p.rect(70, 60, 78, 64, CHROME)
    p.rect(82, 60, 90, 64, CHROME)
    p.rect(2, 10, 158, 16, BLACK)
    for x0 in (4, 146):
        p.rect(x0, 22, x0 + 10, 54, BLACK)
        p.rect(x0 + 1, 23, x0 + 9, 53, RED)
        p.rect(x0 + 1, 23, x0 + 9, 31, AMBER)
    plate(p, 20)
    p.outline()
    return p, {'dots': [[0.06, 0.73], [0.94, 0.73]]}


def truck_rear(color=BASE):
    p = Pic(W, 168, color)
    for x0 in (8, 34, 102, 128):
        p.rect(x0, 0, x0 + 24, 20, BLACK)
    # baú claro com faixa na cor da empresa
    p.rect(2, 22, 158, 166, (216, 216, 210))
    p.rect(2, 22, 158, 26, (160, 160, 156))
    p.line([80, 28, 80, 162], (150, 150, 146), 2)
    for x in (40, 120):
        p.rect(x - 2, 30, x + 2, 160, (170, 170, 166))
    p.rect(2, 120, 158, 134, 'body', body=True)
    p.line([2, 134, 158, 134], 'hi', body=True)
    p.rect(2, 160, 158, 166, (190, 190, 186))
    p.rect(6, 14, 154, 20, (230, 190, 40))
    for x in range(10, 150, 12):
        p.rect(x, 14, x + 6, 20, BLACK)
    for x0 in (6, 140):
        p.rect(x0, 30, x0 + 14, 42, RED)
        p.rect(x0, 44, x0 + 14, 50, AMBER)
    plate(p, 24)
    p.outline()
    return p, {'dots': [[0.08, 0.78], [0.92, 0.78]]}


# ------------------------------------------------------------- frentes
def front_base(p, hood, top, w_roof, lights, grille):
    tires(p)
    p.poly([4, 10, 156, 10, 159, 20, 158, hood - 4, 150, hood, 10, hood, 2, hood - 4, 1, 20], 'body', body=True)
    p.poly([80 - w_roof - 18, hood, 80 + w_roof + 18, hood, 80 + w_roof, top, 80 - w_roof, top], 'body', body=True)
    p.poly([80 - w_roof - 13, hood + 2, 80 + w_roof + 13, hood + 2, 80 + w_roof - 2, top - 3, 80 - w_roof + 2, top - 3], GLASS)
    p.poly([80 - w_roof - 4, hood + 3, 80 - w_roof + 4, hood + 3, 80 - w_roof + 10, top - 4, 80 - w_roof + 3, top - 4], GLASS_HI)
    p.band(0, 18, 'sh')
    p.band(0, 13, 'sh2')
    p.edge_light()
    gx0, gx1, gy0, gy1 = grille
    p.rect(gx0, gy0, gx1, gy1, BLACK)
    for y in range(gy0 + 2, gy1, 2):
        p.line([gx0 + 1, y, gx1 - 1, y], DARK)
    for x0, y0, x1, y1 in lights:
        p.rect(x0, y0, x1, y1, WHITE)
        p.rect(x0 + 1, y0 + 1, x0 + 3, y1 - 1, (255, 255, 255))
    p.rect(2, 10, 158, 14, CHROME)
    mirrors(p, hood + 2)


def sedan_front(color=BASE, police=False):
    p = Pic(W, 84, color)
    front_base(p, 40, 74, 42, [(10, 26, 38, 34), (122, 26, 150, 34)], (44, 122, 24, 34))
    for x0 in (10, 140):
        p.rect(x0, 18, x0 + 10, 22, AMBER)
    if police:
        p.rect(50, 74, 110, 80, BLACK)
        p.rect(52, 75, 79, 79, (150, 20, 20))
        p.rect(81, 75, 108, 79, (20, 40, 150))
    p.outline()
    return p


def hatch_front(color=BASE):
    p = Pic(W, 88, color)
    front_base(p, 38, 78, 44, [(12, 26, 40, 33), (120, 26, 148, 33)], (48, 112, 24, 32))
    p.outline()
    return p


def pickup_front(color=BASE):
    p = Pic(W, 92, color)
    front_base(p, 48, 84, 40, [(8, 30, 30, 40), (130, 30, 152, 40)], (34, 126, 26, 42))
    p.rect(76, 26, 84, 42, CHROME)
    p.outline()
    return p


def van_front(color=BASE):
    p = Pic(W, 124, color)
    front_base(p, 52, 118, 62, [(8, 30, 30, 40), (130, 30, 152, 40)], (40, 120, 24, 40))
    p.outline()
    return p


def truck_front(color=BASE):
    p = Pic(W, 150, color)
    for x0 in (8, 128):
        p.rect(x0, 0, x0 + 24, 20, BLACK)
    p.rect(4, 14, 156, 110, 'body', body=True)
    p.rect(14, 64, 146, 104, GLASS)
    p.rect(20, 66, 40, 102, GLASS_HI)
    p.rect(30, 20, 130, 50, BLACK)
    for y in range(22, 50, 3):
        p.line([32, y, 128, y], DARK)
    for x0 in (8, 136):
        p.rect(x0, 26, x0 + 16, 40, WHITE)
    p.rect(2, 110, 158, 148, (216, 216, 210))                    # baú atrás, mais alto
    p.rect(0, 12, 160, 18, CHROME)
    p.band(0, 40, 'sh')
    p.edge_light()
    p.outline()
    return p


MODELS = {
    'sedan': (sedan_rear, sedan_front), 'hatch': (hatch_rear, hatch_front), 'pickup': (pickup_rear, pickup_front),
    'van': (van_rear, van_front), 'truck': (truck_rear, truck_front),
}

if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    meta = {}
    for k, (rf, ff) in MODELS.items():
        r, glow = rf()
        r.save(f'{out}/{k}-rear.png')
        f = ff()
        f.save(f'{out}/{k}-front.png')
        meta[k] = {'h': round(r.h / W, 3), 'hf': round(f.h / W, 3), 'glow': glow}
    # viatura: preto e branco fixo (sem máscara de cor)
    r, glow = sedan_rear('#f2f2f2', police=True)
    for y in range(r.h - 1 - 46, r.h - 1 - 22):
        for x in range(W):
            px = r.im.getpixel((x, y))
            if r.mask.getpixel((x, y)) and px[3]:
                r.im.putpixel((x, y), (24, 24, 28, 255))
    r.im.save(f'{out}/police-rear.png')
    f = sedan_front('#f2f2f2', police=True)
    f.im.save(f'{out}/police-front.png')
    meta['police'] = {'h': round(r.h / W, 3), 'hf': round(f.h / W, 3), 'glow': glow}
    json.dump(meta, open(f'{out}/traffic.json', 'w'), indent=1)
    print(json.dumps(meta))
