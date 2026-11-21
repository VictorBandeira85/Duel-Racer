"""Capas da revista do Vetor GSi (Vectra GSi, pixel art do Victor). Só marcas fictícias; o que some é refeito
pelo entorno (cv2.inpaint só nas letras):
- estrada (o prata na estrada): a placa "QUATRO RODAS" (revista real) vira placa preta lisa; gravata -> Vanguarda
- motor: o "CHEVROLET" da tampa de válvulas sai (fica "16V"; o "SFI" fica)
- folheto (o vermelho de trás): a faixa de cima com os logos reais vira papel liso; saem o título, o "VECTRA" e o
  "CHEVROLET" da tampa (fica "GSI"), o texto da placa e o "CHEVROLET" do quadrinho do motor; gravata -> Vanguarda
Reduz para 560 x 315 com paleta curta.  Uso: python3 tools/ref/vectra_photos.py <pasta> <src/assets/photos>
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


def wipe(a, box, sel, grow=3):
    x0, y0, x1, y1 = box
    m = np.zeros(a.shape[:2], np.uint8)
    sub = a[y0:y1, x0:x1].astype(int)
    m[y0:y1, x0:x1] = sel(sub[..., 0], sub[..., 1], sub[..., 2])
    m = cv2.dilate(m, np.ones((grow, grow), np.uint8))
    return cv2.inpaint(a, m, 5, cv2.INPAINT_TELEA)


light = lambda r, g, b: (r + g + b) / 3 > 150       # noqa: E731
every = lambda r, g, b: np.ones_like(r, bool)       # noqa: E731


def estrada(a):
    a[614:688, 270:428] = (22, 22, 28)
    a[614:688, 270:272] = a[614:688, 426:428] = a[614:616, 270:428] = a[686:688, 270:428] = (150, 150, 160)
    a = wipe(a, (352, 526, 404, 574), every, 1)
    logo(a, 378, 550, 36)
    return a


def motor(a):
    # o "CHEVROLET" sobre a chapa escura inclinada: dentro do polígono da chapa, tudo vira a cor dela
    pl = np.array([(552, 436), (926, 466), (926, 522), (552, 490)], np.int32)
    m = cv2.fillPoly(np.zeros(a.shape[:2], np.uint8), [pl], 1) > 0
    lum = a.astype(int).mean(axis=2)
    a[m] = np.median(a[m & (lum < 70)], axis=0).astype(np.uint8)
    return a


def folheto(a):
    paper = np.median(a[60:100, 520:900].reshape(-1, 3), axis=0).astype(np.uint8)
    a[0:116] = paper
    # título: coberto pelo asfalto logo acima
    a[583:626, 40:400] = a[582:539:-1, 40:400]       # asfalto de cima refletido (emenda sem degrau; o pneu fica à direita)
    a[626:648, 40:400] = a[583:605, 40:400]
    a[583:648, 400:720] = a[583:648, 80:400][:, ::-1]
    a = wipe(a, (410, 182, 506, 234), light, 5)      # "VECTRA" da tampa
    a = wipe(a, (732, 228, 884, 282), light, 5)      # "CHEVROLET" da tampa
    a = wipe(a, (530, 266, 724, 338), light, 5)      # texto da placa
    a = wipe(a, (603, 203, 668, 242), every, 1)
    logo(a, 635, 222, 34)
    a = wipe(a, (1390, 745, 1555, 800), light, 5)    # "CHEVROLET" do quadrinho do motor
    return a


FN = {'vt-estrada': ('estrada', estrada), 'vt-motor': ('motor', motor), 'vt-folheto': ('folheto', folheto)}


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
