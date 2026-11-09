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
# Cada modelo do trânsito segue um carro real dos anos 90 (formas e luzes; sem marcas):
#   sedan   = sedã de três volumes tipo Chevrolet Monza       hatch  = VW Gol "quadrado"
#   pickup  = picape grande tipo Ford F-1000                   van    = furgão tipo Ford Econoline
#   truck   = caminhão cara-chata tipo Mercedes-Benz LP 1113   fusca  = VW Fusca
#   kombi   = VW Kombi                                         suv    = Ford Explorer (1ª geração)
#   sedan90 = Ford Taurus (1992)
def ribs(p, x0, y0, x1, y1, col=RED_D, step=2):
    for y in range(y0 + 1, y1, step):
        p.line([x0 + 1, y, x1 - 1, y], col)


def sedan_rear(color=BASE, police=False):
    """Monza: traseira alta e reta, lanternas largas com frisos até perto da placa, para-choque preto"""
    p = Pic(W, 92, color)
    tires(p)
    p.poly([4, 10, 156, 10, 159, 22, 158, 48, 152, 52, 8, 52, 2, 48, 1, 22], 'body', body=True)
    cabin(p, 52, 80, 54, 42, 9)
    shade(p, 46)
    p.rect(1, 10, 159, 20, BLACK)  # para-choque de plástico
    p.rect(3, 15, 157, 16, (60, 60, 64))
    p.rect(4, 26, 156, 44, BLACK)  # painel das lanternas
    for x0, x1, inner in ((6, 62, 52), (98, 154, 98)):
        p.rect(x0, 27, x1, 43, RED)
        ribs(p, x0, 27, x1, 43)
        p.rect(inner, 27, inner + 10, 43, AMBER if inner > 80 else AMBER)
        p.rect(x0 + 1, 40, x1 - 1, 41, (255, 120, 100))
    p.rect(62, 27, 98, 43, (30, 30, 34))
    plate(p, 31)
    p.line([8, 46, 152, 46], 'sh2', body=True)  # vinco da tampa do porta-malas
    mirrors(p, 54)
    if police:
        p.rect(52, 80, 108, 86, BLACK)
        p.rect(54, 81, 79, 85, (150, 20, 20))
        p.rect(81, 81, 106, 85, (20, 40, 150))
    p.outline()
    glow = {'dots': [[0.2, 0.62], [0.8, 0.62]]}
    if police:
        glow['siren'] = [[0.34, 0.07, 0.49, 0.11], [0.51, 0.07, 0.66, 0.11]]
    return p, glow


def hatch_rear(color=BASE):
    """Gol quadrado: tampa traseira com vidro grande, lanternas retangulares nos cantos"""
    p = Pic(W, 96, color)
    tires(p, inset=14)
    p.poly([6, 10, 154, 10, 157, 22, 156, 44, 150, 50, 10, 50, 4, 44, 3, 22], 'body', body=True)
    cabin(p, 44, 84, 56, 48, 7)
    shade(p, 44)
    p.rect(3, 10, 157, 18, BLACK)
    p.rect(5, 14, 155, 15, (60, 60, 64))
    for x0 in (8, 124):
        p.rect(x0, 22, x0 + 28, 42, BLACK)
        p.rect(x0 + 1, 23, x0 + 27, 41, RED)
        p.rect(x0 + 1, 34, x0 + 27, 41, AMBER)
        p.rect(x0 + (20 if x0 < 80 else 1), 23, x0 + (27 if x0 < 80 else 8), 28, WHITE)  # ré
        ribs(p, x0, 23, x0 + 27, 34)
    p.rect(40, 24, 120, 40, 'sh', body=True)  # rebaixo da placa
    plate(p, 28)
    p.line([60, 82, 100, 78], BLACK)  # palheta do limpador
    mirrors(p, 50)
    p.outline()
    return p, {'dots': [[0.14, 0.65], [0.86, 0.65]]}


def pickup_rear(color=BASE):
    """F-1000: tampa da caçamba larga com friso, lanternas verticais nas pontas, para-choque cromado com degrau"""
    p = Pic(W, 98, color)
    tires(p, w=26, inset=10)
    p.poly([4, 14, 156, 14, 158, 24, 158, 58, 2, 58, 2, 24], 'body', body=True)
    p.poly([30, 58, 130, 58, 126, 88, 34, 88], 'body', body=True)
    p.poly([40, 64, 120, 64, 116, 82, 44, 82], GLASS)
    p.poly([48, 65, 56, 65, 52, 81, 48, 81], GLASS_HI)
    shade(p, 58)
    p.rect(2, 54, 158, 58, 'sh2', body=True)
    p.rect(24, 34, 136, 44, 'sh', body=True)  # friso em relevo da tampa
    p.line([24, 44, 136, 44], 'hi', body=True)
    p.rect(72, 48, 88, 51, CHROME)  # maçaneta
    p.rect(0, 6, 160, 14, CHROME)
    p.rect(60, 8, 100, 12, (150, 152, 158))  # degrau
    for x0 in (3, 147):
        p.rect(x0, 20, x0 + 10, 54, BLACK)
        p.rect(x0 + 1, 21, x0 + 9, 53, RED)
        p.rect(x0 + 1, 21, x0 + 9, 28, AMBER)
        p.rect(x0 + 1, 29, x0 + 9, 33, WHITE)
    plate(p, 18)
    mirrors(p, 62)
    p.outline()
    return p, {'dots': [[0.05, 0.6], [0.95, 0.6]]}


def van_rear(color=BASE):
    """furgão tipo Econoline: duas portas traseiras com vidros, lanternas altas e estreitas"""
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
    for y in (40, 100):  # dobradiças
        p.rect(4, y, 8, y + 6, DARK)
        p.rect(152, y, 156, y + 6, DARK)
    p.rect(2, 10, 158, 16, CHROME)
    for x0 in (4, 146):
        p.rect(x0, 22, x0 + 10, 62, BLACK)
        p.rect(x0 + 1, 23, x0 + 9, 61, RED)
        p.rect(x0 + 1, 23, x0 + 9, 31, AMBER)
        p.rect(x0 + 1, 32, x0 + 9, 36, WHITE)
    plate(p, 20)
    p.outline()
    return p, {'dots': [[0.06, 0.7], [0.94, 0.7]]}


def truck_rear(color=BASE):
    """caminhão baú (cara-chata tipo LP 1113): baú claro com faixa na cor da empresa"""
    p = Pic(W, 168, color)
    for x0 in (8, 34, 102, 128):
        p.rect(x0, 0, x0 + 24, 20, BLACK)
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
    if grille:
        gx0, gx1, gy0, gy1 = grille
        p.rect(gx0, gy0, gx1, gy1, BLACK)
        for y in range(gy0 + 2, gy1, 2):
            p.line([gx0 + 1, y, gx1 - 1, y], DARK)
    for x0, y0, x1, y1 in lights:
        p.rect(x0, y0, x1, y1, WHITE)
        p.rect(x0 + 1, y0 + 1, x0 + 3, y1 - 1, (255, 255, 255))
    p.rect(2, 10, 158, 14, CHROME)
    mirrors(p, hood + 2)


def emblem(p, cx, cy, r=3):
    p.ellipse(cx, cy, r, r, CHROME)
    p.ellipse(cx, cy, r - 1, r - 1, (150, 152, 158))


def sedan_front(color=BASE, police=False):
    """Monza: faróis retangulares finos colados na grade preta de frisos, piscas nas quinas"""
    p = Pic(W, 84, color)
    front_base(p, 40, 74, 42, [(8, 26, 46, 33), (114, 26, 152, 33)], (46, 114, 25, 34))
    for x0 in (2, 152):
        p.rect(x0, 24, x0 + 6, 33, AMBER)
    emblem(p, 80, 29)
    p.rect(1, 10, 159, 20, BLACK)
    p.rect(3, 15, 157, 16, (60, 60, 64))
    if police:
        p.rect(50, 74, 110, 80, BLACK)
        p.rect(52, 75, 79, 79, (150, 20, 20))
        p.rect(81, 75, 108, 79, (20, 40, 150))
    p.outline()
    return p


def hatch_front(color=BASE):
    """Gol quadrado: faróis quadrados e grade preta de ponta a ponta entre eles"""
    p = Pic(W, 88, color)
    front_base(p, 38, 78, 44, [(10, 24, 36, 34), (124, 24, 150, 34)], (36, 124, 24, 34))
    for x0 in (10, 124):
        p.rect(x0, 20, x0 + 26, 23, AMBER)
    emblem(p, 80, 29)
    p.rect(3, 10, 157, 18, BLACK)
    p.outline()
    return p


def pickup_front(color=BASE):
    """F-1000: grade cromada alta de ponta a ponta com os faróis retangulares nas pontas"""
    p = Pic(W, 92, color)
    front_base(p, 50, 84, 40, [], None)
    p.rect(6, 24, 154, 46, CHROME)
    p.rect(30, 26, 130, 44, BLACK)
    for x in range(34, 128, 8):
        p.rect(x, 27, x + 4, 43, (70, 72, 78))
    p.rect(30, 34, 130, 36, CHROME)
    for x0 in (8, 130):
        p.rect(x0, 30, x0 + 22, 42, WHITE)
        p.rect(x0 + 1, 31, x0 + 4, 41, (255, 255, 255))
        p.rect(x0, 26, x0 + 22, 29, AMBER)
    p.rect(0, 8, 160, 16, CHROME)
    p.outline()
    return p


def van_front(color=BASE):
    p = Pic(W, 124, color)
    front_base(p, 52, 118, 62, [(8, 30, 30, 40), (130, 30, 152, 40)], (40, 120, 24, 40))
    p.rect(8, 26, 30, 29, AMBER)
    p.rect(130, 26, 152, 29, AMBER)
    p.outline()
    return p


def truck_front(color=BASE):
    """cara-chata tipo LP 1113: cabine reta, para-brisa grande, grade de frisos e faróis redondos no para-choque"""
    p = Pic(W, 150, color)
    for x0 in (8, 128):
        p.rect(x0, 0, x0 + 24, 20, BLACK)
    p.rect(4, 14, 156, 110, 'body', body=True)
    p.rect(14, 64, 146, 104, GLASS)
    p.rect(20, 66, 40, 102, GLASS_HI)
    p.line([80, 64, 80, 104], (60, 64, 72))
    p.rect(34, 30, 126, 56, BLACK)
    for y in range(32, 56, 3):
        p.line([36, y, 124, y], (150, 150, 156))
    emblem(p, 80, 60, 4)
    p.rect(2, 110, 158, 148, (216, 216, 210))
    p.rect(0, 12, 160, 24, (40, 40, 44))  # para-choque de aço
    for cx in (18, 142):
        p.ellipse(cx, 18, 7, 7, CHROME)
        p.ellipse(cx, 18, 5, 5, WHITE)
        p.ellipse(cx - 1, 19, 1, 1, (255, 255, 255))
        p.rect(cx - 5, 28, cx + 5, 32, AMBER)
    p.band(0, 40, 'sh')
    p.edge_light()
    p.outline()
    return p


# ------------------------------------------------------------- modelos dos anos 90 (pesquisa de
# mais vendidos: Gol/Uno/Monza/Escort/Fusca/Kombi no Brasil, Taurus/Accord e utilitários nos EUA)
def fusca_rear(color=BASE):
    """besouro: tampa do motor arredondada com grelhas, janelinha oval, para-lamas redondos"""
    p = Pic(W, 100, color)
    tires(p, w=22, h=16, inset=16)
    for cx in (24, 136):  # para-lamas traseiros, salientes dos lados
        p.ellipse(cx, 34, 22, 20, 'body', body=True)
    p.poly([24, 14, 136, 14, 144, 30, 142, 56, 128, 74, 110, 86, 50, 86, 32, 74, 18, 56, 16, 30], 'body', body=True)
    p.ellipse(80, 74, 22, 7, GLASS)
    p.ellipse(73, 76, 7, 3, GLASS_HI)
    shade(p, 40)
    for y in range(40, 52, 3):  # grelhas da tampa do motor
        p.line([62, y, 98, y], 'sh3', body=True)
    p.line([80, 28, 80, 62], 'sh2', body=True)
    for x in (34, 126):  # vinco entre o para-lama e a carroceria
        p.line([x, 16, x + (6 if x < 80 else -6), 54], 'sh2', body=True)
    for x0 in (8, 138):  # lanternas no alto dos para-lamas
        p.rect(x0, 38, x0 + 14, 50, BLACK)
        p.rect(x0 + 1, 39, x0 + 13, 49, RED)
        p.rect(x0 + 1, 45, x0 + 13, 49, AMBER)
    p.rect(14, 12, 146, 16, CHROME)  # para-choque fino
    plate(p, 20, 26, 8)
    p.rect(108, 8, 114, 12, CHROME)
    p.outline()
    return p, {'dots': [[0.08, 0.57], [0.92, 0.57]]}


def fusca_front(color=BASE):
    p = Pic(W, 96, color)
    tires(p, w=22, h=16, inset=16)
    for cx in (22, 138):
        p.ellipse(cx, 32, 22, 22, 'body', body=True)
    p.poly([28, 14, 132, 14, 138, 30, 132, 50, 114, 60, 46, 60, 28, 50, 22, 30], 'body', body=True)
    p.poly([42, 60, 118, 60, 108, 86, 52, 86], 'body', body=True)
    p.poly([48, 62, 112, 62, 104, 83, 56, 83], GLASS)
    p.poly([56, 63, 62, 63, 64, 82, 60, 82], GLASS_HI)
    p.band(0, 22, 'sh')
    p.edge_light()
    p.line([80, 20, 80, 56], 'sh2', body=True)
    for cx in (22, 138):  # faróis redondos em cima dos para-lamas
        p.ellipse(cx, 42, 9, 9, CHROME)
        p.ellipse(cx, 42, 7, 7, WHITE)
        p.ellipse(cx - 2, 44, 2, 2, (255, 255, 255))
        p.rect(cx - 3, 26, cx + 3, 29, AMBER)
    p.rect(14, 12, 146, 16, CHROME)
    p.outline()
    return p


def kombi_rear(color=BASE):
    """perua de linhas retas: metade de cima branca (fixa), janelas largas, tampa do motor embaixo"""
    p = Pic(W, 132, color)
    tires(p, w=24, inset=14)
    p.poly([6, 12, 154, 12, 156, 22, 156, 66, 4, 66, 4, 22], 'body', body=True)
    p.poly([4, 66, 156, 66, 154, 118, 146, 128, 14, 128, 6, 118], (232, 232, 224))
    p.poly([4, 66, 156, 66, 156, 70, 4, 70], (204, 204, 196))
    p.rect(22, 84, 138, 118, GLASS)
    p.rect(28, 86, 40, 116, GLASS_HI)
    shade(p, 60)
    p.rect(40, 26, 120, 52, 'sh', body=True)  # tampa do motor
    for y in range(30, 48, 4):
        p.line([46, y, 114, y], 'sh3', body=True)
    p.rect(74, 56, 86, 60, CHROME)
    for x0 in (8, 140):
        p.rect(x0, 34, x0 + 12, 54, BLACK)
        p.rect(x0 + 1, 35, x0 + 11, 53, RED)
        p.rect(x0 + 1, 35, x0 + 11, 41, AMBER)
    p.rect(2, 10, 158, 16, CHROME)
    plate(p, 18)
    p.outline()
    return p, {'dots': [[0.09, 0.66], [0.91, 0.66]]}


def kombi_front(color=BASE):
    p = Pic(W, 128, color)
    tires(p, w=24, inset=14)
    p.poly([6, 12, 154, 12, 156, 22, 156, 60, 4, 60, 4, 22], 'body', body=True)
    p.poly([80, 24, 150, 60, 10, 60], (232, 232, 224))  # o "V" branco do bico
    p.poly([4, 60, 156, 60, 154, 118, 146, 126, 14, 126, 6, 118], (232, 232, 224))
    for x0 in (12, 84):  # para-brisa bipartido
        p.rect(x0, 70, x0 + 64, 114, GLASS)
        p.rect(x0 + 4, 72, x0 + 12, 112, GLASS_HI)
    p.band(0, 22, 'sh')
    p.edge_light()
    p.ellipse(80, 42, 9, 9, CHROME)  # emblema redondo (genérico)
    p.ellipse(80, 42, 6, 6, (210, 210, 214))
    for cx in (22, 138):
        p.ellipse(cx, 36, 10, 10, CHROME)
        p.ellipse(cx, 36, 8, 8, WHITE)
        p.ellipse(cx - 2, 38, 2, 2, (255, 255, 255))
        p.rect(cx - 4, 22, cx + 4, 26, AMBER)
    p.rect(2, 10, 158, 16, CHROME)
    p.outline()
    return p


def suv_rear(color=BASE):
    """Explorer (1ª geração): tampa traseira com vidro grande, lanternas verticais altas nas colunas"""
    p = Pic(W, 120, color)
    tires(p, w=28, h=20, inset=10)
    p.poly([4, 16, 156, 16, 158, 26, 158, 70, 150, 74, 10, 74, 2, 70, 2, 26], 'body', body=True)
    cabin(p, 74, 110, 66, 62, 14)
    shade(p, 66)
    p.rect(0, 12, 160, 22, DARK)
    p.rect(2, 16, 158, 18, GREY)
    for x0 in (4, 142):  # lanternas verticais subindo pela coluna
        p.rect(x0, 30, x0 + 14, 98, BLACK)
        p.rect(x0 + 1, 31, x0 + 13, 97, RED)
        ribs(p, x0, 31, x0 + 13, 97, RED_D, 4)
        p.rect(x0 + 1, 50, x0 + 13, 58, AMBER)
        p.rect(x0 + 1, 40, x0 + 13, 46, WHITE)
    p.rect(40, 36, 120, 54, 'sh', body=True)
    plate(p, 40)
    p.rect(72, 58, 88, 61, CHROME)
    p.rect(14, 112, 146, 115, DARK)
    for x in (20, 140):
        p.rect(x, 108, x + 2, 114, DARK)
    mirrors(p, 76)
    p.outline()
    return p, {'dots': [[0.07, 0.6], [0.93, 0.6]]}


def suv_front(color=BASE):
    p = Pic(W, 116, color)
    tires(p, w=28, h=20, inset=10)
    front_base(p, 56, 104, 52, [(8, 36, 34, 46), (126, 36, 152, 46)], (40, 120, 30, 48))
    for x in range(48, 118, 10):
        p.rect(x, 31, x + 2, 47, DARK)
    p.rect(0, 12, 160, 20, DARK)
    p.rect(14, 106, 146, 109, DARK)
    p.outline()
    return p


def sedan90_rear(color=BASE):
    """sedã aerodinâmico do começo dos 90: lanterna inteiriça de ponta a ponta e vidro bem inclinado"""
    p = Pic(W, 90, color)
    tires(p)
    p.poly([6, 10, 154, 10, 158, 22, 156, 44, 146, 50, 14, 50, 4, 44, 2, 22], 'body', body=True)
    cabin(p, 50, 80, 60, 40, 7)
    shade(p, 44)
    p.rect(2, 10, 158, 18, 'sh2', body=True)  # para-choque na cor do carro
    p.line([4, 18, 156, 18], 'sh3', body=True)
    p.rect(6, 30, 154, 40, BLACK)  # faixa de lanternas inteiriça
    p.rect(7, 31, 153, 39, RED_D)
    for x0 in (8, 120):
        p.rect(x0, 31, x0 + 32, 39, RED)
        p.rect(x0 + (0 if x0 < 80 else 24), 31, x0 + (8 if x0 < 80 else 32), 39, AMBER)
    p.rect(60, 33, 100, 37, (150, 20, 18))
    plate(p, 20)
    mirrors(p, 52)
    p.outline()
    return p, {'dots': [[0.15, 0.6], [0.85, 0.6]]}


def sedan90_front(color=BASE):
    """Taurus 92: bico baixo sem grade, faróis finos ligados por uma faixa de luz clara no meio"""
    p = Pic(W, 82, color)
    front_base(p, 38, 72, 40, [(8, 26, 48, 33), (112, 26, 152, 33)], None)
    p.rect(48, 28, 112, 31, (220, 224, 230))
    p.rect(48, 28, 112, 28, (250, 250, 252))
    emblem(p, 80, 30, 3)
    p.rect(2, 10, 158, 18, 'sh2', body=True)
    p.rect(50, 12, 110, 17, BLACK)  # entrada de ar no para-choque
    for x0 in (2, 152):
        p.rect(x0, 26, x0 + 6, 33, AMBER)
    p.outline()
    return p


MODELS = {
    'sedan': (sedan_rear, sedan_front), 'hatch': (hatch_rear, hatch_front), 'pickup': (pickup_rear, pickup_front),
    'van': (van_rear, van_front), 'truck': (truck_rear, truck_front),
    'fusca': (fusca_rear, fusca_front), 'kombi': (kombi_rear, kombi_front), 'suv': (suv_rear, suv_front),
    'sedan90': (sedan90_rear, sedan90_front),
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
