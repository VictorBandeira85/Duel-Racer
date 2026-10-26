"""Traseiras e frentes (200 px de largura) dos carros desenhados por código.

Saída: <carro>-rear.png e <carro>-front.png (+ máscaras), e imprime a altura relativa
(h = altura/largura) e onde acendem as luzes de freio, para o cars.ts.
"""
import json
import sys

from kit import Pic

W = 200
GLASS, GLASS_HI, BLACK, DARK, GREY = (38, 48, 62), (90, 110, 132), (14, 14, 16), (40, 40, 44), (96, 98, 104)
RED, RED_D, AMBER, WHITE, CHROME = (214, 26, 22), (120, 12, 10), (240, 150, 30), (236, 236, 228), (190, 192, 198)


def tires(p, w=30, h=24, inset=14):
    for x0 in (inset, W - inset - w):
        p.rect(x0, 0, x0 + w, h, BLACK)
        for y in range(2, h, 4):
            p.line([x0 + 2, y, x0 + w - 2, y], (30, 30, 34, 255))


def mirror_pair(p, y, w=12, h=7, x=4):
    for sx in (x, W - x - w):
        p.rect(sx, y, sx + w, y + h, 'body', body=True)
        p.rect(sx + 1, y + 1, sx + w - 1, y + 2, 'hi', body=True)


def plate(p, y, w=36, h=10):
    p.rect(100 - w // 2, y, 100 + w // 2, y + h, WHITE)
    p.rect(100 - w // 2 + 3, y + 3, 100 + w // 2 - 3, y + h - 3, (150, 150, 150))


def shade_rear(p, deck):
    p.band(0, deck - 14, 'sh')
    p.band(0, 18, 'sh2')
    p.edge_light()


# ---------------------------------------------------------------- traseiras
def diablo_rear(c):
    p = Pic(W, 104, c)
    tires(p)
    p.poly([4, 12, 196, 12, 199, 30, 198, 52, 186, 60, 14, 60, 2, 52, 1, 30], 'body', body=True)
    p.poly([46, 60, 154, 60, 140, 92, 60, 92], 'body', body=True)   # cabine
    p.poly([56, 62, 144, 62, 134, 88, 66, 88], GLASS)
    p.poly([70, 64, 82, 64, 76, 86, 70, 86], GLASS_HI)
    shade_rear(p, 52)
    # faixa preta com as lanternas retangulares e a grade do motor
    p.rect(8, 34, 192, 52, BLACK)
    for x0 in (12, 156):
        p.rect(x0, 37, x0 + 32, 49, RED)
        p.rect(x0 + 1, 46, x0 + 31, 48, (255, 90, 70))
    for x0 in (46, 136):
        p.rect(x0, 37, x0 + 18, 49, AMBER)
    for y in range(37, 50, 3):
        p.line([66, y, 134, y], DARK)
    plate(p, 18)
    for x in (70, 82, 112, 124):
        p.ellipse(x, 10, 4, 3, CHROME)
        p.ellipse(x, 10, 2, 1, BLACK)
    mirror_pair(p, 62)
    p.outline()
    return p, {'bar': [0.06, 0.48, 0.22, 0.6]}


def zr1_rear(c):
    p = Pic(W, 108, c)
    tires(p)
    p.poly([6, 12, 194, 12, 198, 26, 197, 56, 180, 64, 20, 64, 3, 56, 2, 26], 'body', body=True)
    p.poly([40, 64, 160, 64, 146, 98, 54, 98], 'body', body=True)
    p.poly([48, 66, 152, 66, 140, 94, 60, 94], GLASS)           # vidro bolha
    p.poly([62, 68, 76, 68, 70, 92, 64, 92], GLASS_HI)
    shade_rear(p, 56)
    # quatro lanternas quadradas
    for x0 in (14, 46, 128, 160):
        p.rect(x0, 34, x0 + 26, 52, BLACK)
        p.rect(x0 + 2, 36, x0 + 24, 50, RED)
        p.rect(x0 + 4, 46, x0 + 22, 48, (255, 90, 70))
    p.rect(88, 40, 112, 46, 'sh2')
    plate(p, 18)
    for x in (30, 40, 160, 170):
        p.rect(x - 3, 6, x + 3, 12, CHROME)
    mirror_pair(p, 66)
    p.outline()
    return p, {'dots': [[0.13, 0.62], [0.3, 0.62], [0.7, 0.62], [0.87, 0.62]]}


def testarossa_rear(c):
    p = Pic(W, 104, c)
    tires(p, w=32, inset=10)
    p.poly([4, 12, 196, 12, 199, 28, 199, 58, 190, 64, 10, 64, 1, 58, 1, 28], 'body', body=True)
    p.poly([50, 64, 150, 64, 138, 92, 62, 92], 'body', body=True)
    p.poly([58, 66, 142, 66, 132, 88, 68, 88], GLASS)
    p.poly([72, 68, 84, 68, 78, 86, 72, 86], GLASS_HI)
    shade_rear(p, 58)
    # grade preta de ponta a ponta cobrindo as lanternas
    p.rect(6, 30, 194, 56, BLACK)
    for x0 in (12, 150):
        p.rect(x0, 34, x0 + 38, 52, RED_D)
    for y in range(32, 56, 3):
        p.line([6, y, 194, y], DARK)
    plate(p, 16)
    for x in (34, 46, 154, 166):
        p.ellipse(x, 8, 5, 3, CHROME)
        p.ellipse(x, 8, 3, 1, BLACK)
    mirror_pair(p, 66)
    p.outline()
    return p, {'bar': [0.06, 0.45, 0.25, 0.66]}


def countach_rear(c):
    p = Pic(W, 118, c)
    tires(p, w=34, h=26, inset=8)
    p.poly([4, 14, 196, 14, 199, 30, 198, 56, 184, 62, 16, 62, 2, 56, 1, 30], 'body', body=True)
    p.poly([52, 62, 148, 62, 136, 88, 64, 88], 'body', body=True)
    p.poly([62, 64, 138, 64, 128, 84, 72, 84], GLASS)
    shade_rear(p, 56)
    # lanternas tricolores e grade central
    for x0 in (8, 144):
        p.rect(x0, 34, x0 + 48, 54, BLACK)
        p.rect(x0 + 2, 36, x0 + 16, 52, RED)
        p.rect(x0 + 17, 36, x0 + 31, 52, AMBER)
        p.rect(x0 + 32, 36, x0 + 46, 52, RED)
    p.rect(60, 36, 140, 52, DARK)
    for x in range(64, 138, 4):
        p.line([x, 37, x, 51], BLACK)
    plate(p, 18)
    for x in (72, 84, 116, 128):
        p.ellipse(x, 10, 4, 3, CHROME)
        p.ellipse(x, 10, 2, 1, BLACK)
    # asa em V
    p.poly([60, 88, 66, 104, 72, 104, 68, 88], 'sh')
    p.poly([132, 88, 128, 104, 134, 104, 140, 88], 'sh')
    p.poly([20, 104, 180, 104, 186, 112, 100, 108, 14, 112], 'body', body=True)
    p.line([22, 106, 178, 106], 'hi', body=True)
    mirror_pair(p, 64)
    p.outline()
    return p, {'dots': [[0.07, 0.62], [0.2, 0.62], [0.8, 0.62], [0.93, 0.62]]}


def nsx_rear(c):
    p = Pic(W, 112, c)
    tires(p)
    p.poly([6, 12, 194, 12, 198, 26, 198, 60, 188, 68, 12, 68, 2, 60, 2, 26], 'body', body=True)
    p.poly([40, 68, 160, 68, 146, 102, 54, 102], 'body', body=True)
    p.poly([46, 70, 154, 70, 142, 100, 58, 100], (20, 20, 24))   # vidro escuro que dá a volta
    p.poly([52, 72, 148, 72, 138, 96, 62, 96], GLASS)
    shade_rear(p, 60)
    # aerofólio integrado e faixa de lanterna de ponta a ponta
    p.rect(4, 60, 196, 66, 'body', body=True)
    p.line([4, 66, 196, 66], 'hi2', body=True)
    p.rect(6, 40, 194, 54, BLACK)
    p.rect(8, 42, 192, 52, RED)
    p.rect(70, 42, 130, 52, (60, 14, 14))
    p.rect(8, 49, 192, 51, (255, 90, 70))
    plate(p, 18)
    for x in (156, 168):
        p.ellipse(x, 9, 4, 3, CHROME)
        p.ellipse(x, 9, 2, 1, BLACK)
    mirror_pair(p, 70)
    p.outline()
    return p, {'bar': [0.04, 0.53, 0.96, 0.64]}


def viper_rear(c):
    p = Pic(W, 96, c)
    tires(p, w=32, inset=12)
    p.poly([6, 12, 194, 12, 198, 26, 197, 50, 186, 58, 14, 58, 3, 50, 2, 26], 'body', body=True)
    shade_rear(p, 50)
    # santantônio, encostos e para-brisa visto por trás
    p.poly([56, 58, 144, 58, 136, 70, 64, 70], BLACK)
    p.poly([60, 58, 70, 80, 82, 80, 76, 58], BLACK)
    p.poly([140, 58, 130, 80, 118, 80, 124, 58], BLACK)
    p.rect(70, 76, 130, 82, BLACK)
    p.poly([66, 82, 134, 82, 128, 90, 72, 90], GLASS)
    # lanternas finas inclinadas
    for x0, d in ((14, 1), (186, -1)):
        p.poly([x0, 44, x0 + 40 * d, 46, x0 + 38 * d, 40, x0 + 2 * d, 38], RED)
        p.line([x0 + 2 * d, 39, x0 + 38 * d, 41], (255, 100, 80))
    plate(p, 20)
    mirror_pair(p, 60)
    p.outline()
    return p, {'dots': [[0.17, 0.55], [0.83, 0.55]]}


# ---------------------------------------------------------------- frentes
def front_base(p, hood, roof_w=90, roof_y=None, wind=True):
    tires(p)
    roof_y = roof_y or p.h - 8
    p.poly([4, 12, 196, 12, 199, 24, 198, hood - 4, 186, hood, 14, hood, 2, hood - 4, 1, 24], 'body', body=True)
    if wind:
        p.poly([100 - roof_w // 2 - 22, hood, 100 + roof_w // 2 + 22, hood, 100 + roof_w // 2, roof_y,
                100 - roof_w // 2, roof_y], 'body', body=True)
        p.poly([100 - roof_w // 2 - 16, hood + 2, 100 + roof_w // 2 + 16, hood + 2, 100 + roof_w // 2 - 2, roof_y - 4,
                100 - roof_w // 2 + 2, roof_y - 4], GLASS)
        p.poly([100 - roof_w // 2 - 6, hood + 4, 100 - roof_w // 2 + 6, hood + 4, 100 - roof_w // 2 + 14, roof_y - 6,
                100 - roof_w // 2 + 4, roof_y - 6], GLASS_HI)
    p.band(0, 20, 'sh')
    p.band(0, 14, 'sh2')
    p.edge_light()


def popups(p, y, w=36, x=14):
    for x0 in (x, W - x - w):
        p.rect(x0, y, x0 + w, y + 2, 'sh2', body=True)
        p.line([x0, y + 3, x0 + w, y + 3], 'hi', body=True)


def diablo_front(c):
    p = Pic(W, 92, c)
    front_base(p, 46, 84)
    popups(p, 40)
    p.rect(30, 18, 170, 30, BLACK)
    for x in range(34, 168, 5):
        p.line([x, 19, x, 29], DARK)
    for x0 in (8, 176):
        p.rect(x0, 24, x0 + 16, 30, AMBER)
    mirror_pair(p, 48)
    p.outline()
    return p


def zr1_front(c):
    p = Pic(W, 96, c)
    front_base(p, 48, 92)
    popups(p, 42, 40, 12)
    p.rect(60, 22, 140, 28, BLACK)
    for x0 in (14, 168):
        p.rect(x0, 22, x0 + 18, 28, WHITE)
        p.rect(x0 + 2, 18, x0 + 16, 20, AMBER)
    mirror_pair(p, 50)
    p.outline()
    return p


def testarossa_front(c):
    p = Pic(W, 92, c)
    front_base(p, 46, 84)
    popups(p, 40)
    p.rect(40, 18, 160, 30, BLACK)
    for y in range(20, 30, 3):
        p.line([42, y, 158, y], DARK)
    for x0 in (44, 140):
        p.rect(x0, 21, x0 + 16, 27, WHITE)
    for x0 in (8, 176):
        p.rect(x0, 26, x0 + 16, 30, AMBER)
    mirror_pair(p, 48)
    p.outline()
    return p


def countach_front(c):
    p = Pic(W, 88, c)
    front_base(p, 40, 80)
    popups(p, 34, 34, 18)
    for x0 in (10, 166):
        p.rect(x0, 26, x0 + 24, 31, AMBER)
        p.rect(x0, 20, x0 + 24, 25, WHITE)
    p.rect(60, 16, 140, 22, BLACK)
    mirror_pair(p, 42)
    p.outline()
    return p


def nsx_front(c):
    p = Pic(W, 96, c)
    front_base(p, 46, 96)
    popups(p, 40, 40, 12)
    p.rect(54, 16, 146, 26, BLACK)
    for x0 in (14, 166):
        p.rect(x0, 26, x0 + 20, 31, AMBER)
    mirror_pair(p, 48)
    p.outline()
    return p


def viper_front(c):
    p = Pic(W, 84, c)
    front_base(p, 44, 110, p.h - 14)
    # boca oval com barra e faróis fixos inclinados
    p.ellipse(100, 24, 46, 9, BLACK)
    p.rect(56, 23, 144, 25, 'sh', body=True)
    for x0, d in ((16, 1), (184, -1)):
        p.poly([x0, 34, x0 + 34 * d, 38, x0 + 32 * d, 44, x0, 40], WHITE)
        p.poly([x0 + 4 * d, 36, x0 + 14 * d, 37, x0 + 14 * d, 41, x0 + 4 * d, 40], (180, 200, 220))
    mirror_pair(p, 46)
    p.outline()
    return p


CARS = {
    'diablo': (diablo_rear, diablo_front, '#f0c010'), 'zr1': (zr1_rear, zr1_front, '#1d4fbf'),
    'testarossa': (testarossa_rear, testarossa_front, '#d01c1c'), 'countach': (countach_rear, countach_front, '#e8e8e2'),
    'nsx': (nsx_rear, nsx_front, '#1a1a1e'), 'viper': (viper_rear, viper_front, '#c81e24'),
}

if __name__ == '__main__':
    out = sys.argv[1]
    meta = {}
    for k, (rf, ff, col) in CARS.items():
        r, glow = rf(col)
        r.save(f'{out}/{k}-rear.png')
        f = ff(col)
        f.save(f'{out}/{k}-front.png')
        meta[k] = {'h': round(r.h / W, 3), 'hf': round(f.h / W, 3), 'glow': glow}
    print(json.dumps(meta))
