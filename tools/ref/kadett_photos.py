"""Capas da revista do Cadete GSi (Kadett GSi, pixel art do Victor). Só marcas fictícias; o que some é
refeito pelo entorno (cv2.inpaint só nos pixels do texto):
- praia (conversível vinho na beira do mar): o "KADETT" do adesivo da porta sai, fica o "GSi"
- revista (vermelho espirrando água): o título amarelo some (a faixa fica vermelha lisa, o jogo põe o título),
  saem "Carrosnaweb" e a seta pontilhada (site real), o texto da placa e a gravata vira o emblema da Vanguarda
- duelo (branco e o GTI preto): gravata do Kadett -> Vanguarda, logo da VW -> Ipê, saem o "KADETT" do adesivo
  e os letreiros apagados do capô e do para-choque
Reduz para 560 x 315 com paleta curta.  Uso: python3 tools/ref/kadett_photos.py <pasta> <src/assets/photos>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402


def logo(a, cx, cy, s, bid='vanguarda'):
    lg = np.array(Image.fromarray(logo_img(bid, 9)).resize((s, s), Image.NEAREST))
    m = lg[..., 3] > 0
    a[cy - s // 2:cy - s // 2 + s, cx - s // 2:cx - s // 2 + s][m] = lg[..., :3][m]


def wipe(a, box, sel, grow=3):
    """refaz pelo entorno os pixels do texto dentro da caixa (sel: função da cor -> máscara)"""
    x0, y0, x1, y1 = box
    m = np.zeros(a.shape[:2], np.uint8)
    sub = a[y0:y1, x0:x1].astype(int)
    m[y0:y1, x0:x1] = sel(sub[..., 0], sub[..., 1], sub[..., 2])
    m = cv2.dilate(m, np.ones((grow, grow), np.uint8))
    return cv2.inpaint(a, m, 5, cv2.INPAINT_TELEA)


light = lambda r, g, b: (r + g + b) / 3 > 170          # noqa: E731
dark = lambda r, g, b: (r + g + b) / 3 < 90            # noqa: E731


def patch(a, box, col_box):
    x0, y0, x1, y1 = box
    cx0, cy0, cx1, cy1 = col_box
    a[y0:y1, x0:x1] = np.median(a[cy0:cy1, cx0:cx1].reshape(-1, 3), axis=0).astype(np.uint8)


def praia(a):
    return wipe(a, (640, 560, 760, 594), light)


def revista(a):
    rgb = a.astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    ban = np.zeros(a.shape[:2], bool)
    ban[0:122, 0:880] = True
    yel = ban & (r > 180) & (g > 120) & (b < 110)
    red = np.median(a[ban & (r > 150) & (g < 60)].reshape(-1, 3), axis=0).astype(np.uint8)
    yel = cv2.dilate(yel.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    a[yel & ban] = red
    a = wipe(a, (40, 120, 330, 172), lambda r, g, b: np.ones_like(r, bool), 1)  # "Carrosnaweb" e a tarja escura
    a = wipe(a, (105, 165, 150, 362), light, 5)           # seta pontilhada
    pl = np.array([(384, 542), (614, 579), (612, 629), (380, 591)], np.int32)   # miolo da placa: preto liso
    mk = np.zeros(a.shape[:2], np.uint8)
    cv2.fillPoly(mk, [pl], 1)
    a[mk > 0] = np.median(a[(mk > 0) & (a.astype(int).mean(axis=2) < 70)].reshape(-1, 3), axis=0).astype(np.uint8)
    patch(a, (490, 420, 566, 460), (470, 465, 600, 480))  # gravata: grade escura
    logo(a, 528, 440, 34)
    return a


def duelo(a):
    patch(a, (236, 344, 276, 380), (230, 385, 280, 392))
    logo(a, 256, 362, 30, 'ipe')
    patch(a, (652, 512, 710, 540), (640, 545, 720, 556))
    logo(a, 681, 526, 26)
    a = wipe(a, (1240, 626, 1334, 664), dark, 3)          # "KADETT" do adesivo
    a = wipe(a, (800, 386, 1020, 410), dark, 3)           # letreiro apagado do capô
    a = wipe(a, (478, 548, 528, 570), lambda r, g, b: (r - b) > 30, 3)
    a = wipe(a, (812, 614, 884, 638), lambda r, g, b: (r - b) > 30, 3)
    return a


FN = {'kd-praia': ('praia', praia), 'kd-revista': ('revista', revista), 'kd-duelo': ('duelo', duelo)}


def main():
    src, out = sys.argv[1], sys.argv[2]
    for name, (k, fn) in FN.items():
        a = np.ascontiguousarray(np.array(Image.open(os.path.join(src, f'{k}.png')).convert('RGB')))
        a = fn(a)
        im = Image.fromarray(a)
        if os.environ.get('DBG'):
            im.save(os.path.join(os.environ['DBG'], f'{name}.png'))
        im = im.resize((560, 315), Image.LANCZOS).quantize(160, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        im.save(os.path.join(out, f'{name}.png'), optimize=True)
        print(name, im.size)


if __name__ == '__main__':
    main()
