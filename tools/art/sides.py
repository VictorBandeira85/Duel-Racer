"""Perfis (vista lateral, 300 px, frente à esquerda) dos carros desenhados por código."""
import sys

from kit import Pic

GLASS, GLASS_HI, BLACK, DARK = (38, 48, 62), (96, 118, 140), (16, 16, 18), (34, 34, 38)
RED, AMBER, CHROME = (200, 24, 20), (240, 150, 30), (196, 198, 204)
H = 92


def glass(p, pts, stripe=None):
    p.poly(pts, GLASS)
    if stripe:
        p.poly(stripe, GLASS_HI)


def arches(p, wheels):
    for cx, r in wheels:
        # contorno do para-lama (um tom mais escuro) e caixa de roda preta
        box = [cx - r - 6, p.h - 1 - r - r - 6, cx + r + 6, p.h - 1 - r + r + 6]
        p.d.arc(box, 180, 360, fill=p.c['sh2'], width=2)
        p.ellipse(cx, r, r + 4, r + 4, BLACK)


def shade(p, low, crease):
    p.band(0, crease, 'sh')
    p.band(0, low, 'sh2')
    p.edge_light()
    # vinco de luz na lateral, logo acima da parte sombreada
    px, mk = p.im.load(), p.mask.load()
    y = p.h - 1 - crease - 1
    for x in range(p.w):
        if mk[x, y] and px[x, y][:3] == p.c['body'][:3]:
            px[x, y] = p.c['hi']


def arch_lip(p, wheels):
    for cx, r in wheels:
        p.ellipse(cx, r, r + 6, r + 6, 'sh', body=True)
        p.ellipse(cx, r, r + 5, r + 5, (16, 16, 18))


def finish(p, wheels, style):
    for cx, r in wheels:
        p.wheel(cx, r, r, style)
    p.outline()


def diablo(color):
    p = Pic(300, H, color)
    p.poly([1, 15, 2, 22, 10, 27, 50, 33, 106, 40, 150, 70, 184, 71, 204, 64, 250, 55, 288, 49, 297, 45, 299, 38,
            298, 20, 290, 13, 268, 12, 90, 12, 20, 13, 6, 13], 'body', body=True)
    shade(p, 13, 25)
    glass(p, [114, 45, 148, 68, 178, 68, 192, 50, 186, 45], [124, 47, 138, 61, 146, 61, 132, 47])
    p.poly([196, 50, 240, 57, 238, 49, 206, 43], BLACK)
    p.poly([200, 49, 236, 55, 236, 52, 204, 47], DARK)
    p.line([104, 13, 108, 44], 'sh3')
    p.line([192, 13, 190, 47], 'sh3')
    p.line([30, 29, 60, 33], 'sh2')
    p.rect(3, 19, 7, 22, AMBER)
    p.rect(291, 40, 297, 45, RED)
    p.poly([126, 47, 136, 49, 136, 53, 128, 52], 'sh')
    arches(p, [(67, 22), (245, 23)])
    finish(p, [(67, 22), (245, 23)], 'star5')
    return p


def zr1(color):
    p = Pic(300, H, color)
    p.poly([1, 18, 3, 27, 15, 31, 60, 37, 118, 44, 160, 77, 192, 79, 255, 58, 290, 55, 298, 50, 299, 22,
            292, 12, 270, 10, 50, 10, 18, 12, 6, 14], 'body', body=True)
    shade(p, 13, 24)
    glass(p, [127, 47, 158, 73, 188, 75, 193, 48], [137, 49, 152, 66, 158, 66, 144, 49])
    glass(p, [200, 52, 200, 74, 250, 59, 240, 52])
    p.rect(14, 19, 290, 21, 'sh3')
    for k in range(3):
        p.line([98 + k * 5, 24, 104 + k * 5, 33], BLACK)
    p.line([116, 13, 120, 44], 'sh3')
    p.line([196, 13, 196, 48], 'sh3')
    p.rect(4, 22, 9, 25, AMBER)
    p.rect(292, 36, 298, 42, RED)
    p.poly([130, 47, 140, 49, 140, 53, 132, 52], 'sh')
    arches(p, [(70, 21), (234, 22)])
    finish(p, [(70, 21), (234, 22)], 'dish')
    return p


def testarossa(color):
    p = Pic(300, H, color)
    p.poly([1, 17, 3, 26, 12, 30, 60, 36, 110, 42, 152, 73, 190, 74, 210, 64, 296, 58, 299, 52, 299, 22,
            292, 12, 268, 10, 46, 10, 18, 12, 6, 14], 'body', body=True)
    shade(p, 13, 23)
    glass(p, [120, 45, 150, 70, 182, 71, 186, 47], [130, 47, 144, 62, 150, 62, 137, 47])
    # aletas laterais sobre a grande entrada de ar
    p.poly([132, 24, 250, 24, 254, 47, 136, 47], BLACK)
    for y in (27, 31, 35, 39, 43):
        p.poly([134, y, 252, y, 252, y + 2, 134, y + 2], 'body', body=True)
        p.line([134, y + 2, 252, y + 2], 'hi', body=True)
    p.line([112, 13, 116, 43], 'sh3')
    p.poly([126, 56, 140, 61, 140, 57, 130, 52], 'body', body=True)
    p.line([126, 56, 140, 61], 'hi', body=True)
    p.rect(3, 19, 7, 22, AMBER)
    p.rect(292, 38, 298, 44, RED)
    arches(p, [(67, 21), (238, 22)])
    finish(p, [(67, 21), (238, 22)], 'star5')
    return p


def countach(color):
    p = Pic(300, H, color)
    p.poly([1, 16, 3, 22, 105, 42, 160, 71, 186, 71, 200, 66, 230, 63, 288, 58, 297, 54, 299, 24,
            292, 12, 270, 10, 50, 10, 18, 12, 6, 13], 'body', body=True)
    shade(p, 13, 22)
    glass(p, [118, 45, 158, 69, 184, 69, 186, 52, 150, 46], [128, 47, 146, 62, 152, 62, 136, 47])
    # tomada NACA na porta e caixa de ar atrás do vidro
    p.poly([118, 25, 162, 36, 162, 29], BLACK)
    p.poly([186, 71, 228, 72, 230, 63, 200, 66], 'body', body=True)
    p.poly([190, 64, 226, 67, 226, 63, 192, 61], BLACK)
    for x in range(196, 226, 5):
        p.line([x, 62, x + 1, 66], DARK)
    # asa traseira em V
    p.poly([262, 58, 266, 72, 271, 72, 269, 58], 'sh')
    p.poly([246, 72, 299, 74, 299, 79, 250, 78], 'body', body=True)
    p.line([250, 78, 299, 79], 'hi', body=True)
    p.line([108, 13, 112, 43], 'sh3')
    p.rect(3, 18, 7, 21, AMBER)
    p.rect(292, 40, 298, 46, RED)
    arches(p, [(70, 21), (248, 23)])
    finish(p, [(70, 21), (248, 23)], 'dish')
    return p


def nsx(color):
    p = Pic(300, H, color)
    p.poly([1, 17, 3, 26, 14, 30, 60, 36, 116, 42, 158, 75, 194, 76, 236, 62, 270, 57, 296, 59, 299, 55, 299, 24,
            292, 13, 268, 12, 48, 12, 18, 13, 6, 14], 'body', body=True)
    shade(p, 13, 24)
    glass(p, [126, 46, 157, 72, 193, 73, 230, 61, 220, 49], [136, 48, 151, 65, 157, 65, 143, 48])
    p.poly([192, 48, 197, 74, 202, 74, 198, 48], BLACK)
    p.poly([205, 26, 223, 26, 223, 44, 209, 44], BLACK)
    for y in range(29, 44, 3):
        p.line([209, y, 222, y], DARK)
    p.line([266, 56, 299, 58], BLACK)
    p.line([114, 13, 118, 43], 'sh3')
    p.rect(4, 22, 9, 25, AMBER)
    p.rect(292, 40, 298, 54, RED)
    arches(p, [(71, 20), (244, 21)])
    finish(p, [(71, 20), (244, 21)], 'star5')
    return p


def viper(color):
    p = Pic(300, H, color)
    p.poly([1, 20, 4, 30, 20, 36, 70, 42, 125, 46, 210, 46, 245, 50, 290, 51, 298, 46, 299, 24,
            292, 12, 268, 10, 48, 10, 18, 12, 6, 14], 'body', body=True)
    shade(p, 13, 26)
    # para-brisa baixo com moldura preta, banco e santantônio
    p.poly([120, 46, 142, 62, 150, 62, 130, 46], BLACK)
    glass(p, [126, 47, 142, 59, 145, 59, 130, 47])
    p.poly([172, 46, 178, 56, 188, 56, 188, 46], DARK)
    p.poly([196, 46, 202, 59, 216, 59, 216, 46, 212, 46, 212, 55, 204, 55, 201, 46], BLACK)
    # escapamento lateral e saída de ar do para-lama
    p.rect(92, 9, 160, 14, CHROME)
    for x in range(96, 158, 6):
        p.rect(x, 10, x + 3, 13, (110, 112, 118))
    p.poly([96, 22, 112, 26, 112, 35, 98, 31], BLACK)
    p.rect(3, 22, 8, 25, AMBER)
    p.rect(292, 38, 298, 44, RED)
    arches(p, [(68, 22), (232, 23)])
    finish(p, [(68, 22), (232, 23)], 'star3')
    return p


CARS = {'diablo': (diablo, '#f0c010'), 'testarossa': (testarossa, '#d01c1c'),
        'countach': (countach, '#e8e8e2'), 'nsx': (nsx, '#1a1a1e'), 'viper': (viper, '#c81e24')}

if __name__ == '__main__':
    out = sys.argv[1]
    for k, (fn, col) in CARS.items():
        p = fn(col)
        # recorta a altura ao que foi desenhado
        bbox = p.im.getbbox()
        p.im = p.im.crop((0, bbox[1], 300, H))
        p.mask = p.mask.crop((0, bbox[1], 300, H))
        p.save(f'{out}/{k}-side.png')
