"""Capas da revista do Corsário GSi (Corsa GSi, pixel art do Victor). Só marcas fictícias; o que some é
coberto com o entorno:
- motor (amarelo de capô aberto): o "CHEVROLET 16V" da tampa vira tampa lisa (cada linha com o cinza dela) e
  fica só "16V"; a gravata da grade vira o emblema da Vanguarda; o "GSI 16V" fica
- raio-x: saem o título, o texto e todas as etiquetas com marcas reais (fornecedores): fica só o carro
  (o maior bloco depois de uma abertura que apaga linhas finas e letras) sobre o amarelo da página;
  gravatas das rodas viram miolo cinza
- pista (o branco na curva): o raio da grade vira o emblema da Vanguarda
Reduz para 560 x 315 com paleta curta.
Uso: python3 tools/ref/corsa_photos.py <pasta com motor/raiox/pista.png> <src/assets/photos>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402


def logo(a, cx, cy, s):
    lg = np.array(Image.fromarray(logo_img('vanguarda', 9)).resize((s, s), Image.NEAREST))
    m = lg[..., 3] > 0
    a[cy - s // 2:cy - s // 2 + s, cx - s // 2:cx - s // 2 + s][m] = lg[..., :3][m]


def disc(a, cx, cy, r, col=None):
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    d = np.hypot(xx - cx, yy - cy)
    a[d <= r] = col if col is not None else np.median(a[(d > r + 3) & (d < r + 9)], axis=0).astype(np.uint8)


def motor(a):
    # letreiro da tampa: cada linha do miolo com o cinza da própria tampa (à direita do letreiro some só o
    # "CHEVROLET"; o "16V" fica)
    for y in range(428, 462):
        a[y, 632:825] = np.median(a[y, 600:628], axis=0).astype(np.uint8)
    disc(a, 836, 773, 46, np.median(a[750:760, 600:700].reshape(-1, 3), axis=0).astype(np.uint8))
    logo(a, 836, 772, 54)
    return a


def raiox(a):
    rgb = a.astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    yellow = (r > 200) & (g > 140) & (b < 120) & (r - b > 120)
    paper = np.median(a[yellow].reshape(-1, 3), axis=0).astype(np.uint8)
    obj = ~yellow
    op = cv2.morphologyEx(obj.astype(np.uint8), cv2.MORPH_OPEN, np.ones((13, 13), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(op, 8)
    car = lab == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    car = cv2.dilate(car.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    n, lab = cv2.connectedComponents((~car).astype(np.uint8), 4)   # furos do carro (vidros) entram
    car |= lab != lab[0, 0]
    car[355:460, 330:485] = False            # etiqueta "SISTEMA DE INJEÇÃO" encostada no capô
    out = a.copy()
    out[~car] = paper
    # pontas das linhas das etiquetas na beira do carro (vermelho fino) viram papel
    band = car & ~(cv2.erode(car.astype(np.uint8), np.ones((31, 31), np.uint8)) > 0)
    redl = (r > 150) & (g < 90) & (b < 90)
    out[band & redl] = paper
    # linhas das etiquetas atravessando o carro: vermelho fino (some numa abertura 5x5) é refeito pelo entorno
    thin = redl & car & ~(cv2.morphologyEx(redl.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)) > 0)
    thin = cv2.dilate(thin.astype(np.uint8), np.ones((5, 5), np.uint8))
    out = cv2.inpaint(out, thin, 4, cv2.INPAINT_TELEA)
    # sombra suave do papel (a página tinha um degradê leve): nada; moldura da página some junto
    for cx, cy, rr in [(853, 726, 17), (1391, 499, 13)]:
        disc(out, cx, cy, rr)
    return out


def pista(a):
    disc(a, 790, 605, 22, np.median(a[598:612, 690:740].reshape(-1, 3), axis=0).astype(np.uint8))
    logo(a, 790, 605, 30)
    return a


FN = {'cs-motor': ('motor', motor), 'cs-raiox': ('raiox', raiox), 'cs-pista': ('pista', pista)}


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
