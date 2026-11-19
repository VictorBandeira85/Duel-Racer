"""Fotos da revista da Onça GTB (Puma GTB S2, pixel art do Victor). Só marcas fictícias; o que some é
coberto com a textura do entorno (nunca tarja):
- motor: o "PUMA" da tampa de válvulas some (as nervuras continuam linha a linha) e o logo da Onça vai no
  meio; o canto magenta da arte fica fora do recorte;
- ponte (foto grande da página da revista): só a foto, sem o letreiro "Puma GTB S2" (asfalto continuado);
- traseira (foto pequena da mesma página): só a foto;
- teste (o Onça amarelo na pista): o "PUMA" da grade some (lâminas continuadas) e vira o logo da Onça, a
  placa "TESTE QUATRO" fica lisa e o adesivo da porta é coberto com a lataria amarela.
Reduz para 560 x 315 com paleta curta (cores do logo da Onça garantidas).
Uso: python3 tools/ref/pumagtb_photos.py <pasta com motor/revista/teste.png> <src/assets/photos>
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from brand_badges import logo_img  # noqa: E402
from pumagte_photos import onca  # noqa: E402


def rowfill(a, x0, y0, x1, y1, src):
    for y in range(y0, y1):
        a[y, x0:x1] = np.median(np.concatenate([a[y, s0:s1] for s0, s1 in src]), axis=0).astype(np.uint8)


def motor(a):
    rowfill(a, 626, 414, 904, 468, [(520, 620), (910, 1010)])
    onca(a, 765, 441, 40, 40)
    return a[40:902, 140:1672]


def ponte(a):
    rowfill(a, 88, 505, 455, 576, [(72, 86)])
    return a[134:557, 70:822]


def traseira(a):
    return a[118:498, 1222:1607]


def teste(a):
    rowfill(a, 682, 422, 846, 456, [(600, 678), (848, 862)])
    onca(a, 765, 439, 30, 30)
    a[631:714, 489:719] = (232, 230, 222)  # placa lisa (fica o quadro)
    rowfill(a, 1408, 376, 1504, 504, [(1362, 1404)])
    return a


FN = {'pb-motor': ('motor', motor), 'pb-ponte': ('revista', ponte), 'pb-teste': ('teste', teste)}


def main():
    src, out = sys.argv[1], sys.argv[2]
    cols = sorted({tuple(int(v) for v in c[:3]) for c in logo_img('onca', 9).reshape(-1, 4) if c[3] > 0})
    for name, (k, fn) in FN.items():
        a = np.ascontiguousarray(np.array(Image.open(os.path.join(src, f'{k}.png')).convert('RGB')))
        a = np.ascontiguousarray(fn(a))
        im = Image.fromarray(a)
        if os.environ.get('DBG'):
            im.save(os.path.join(os.environ['DBG'], f'{name}.png'))
        h = a.shape[0] * 560 // a.shape[1]
        im = im.resize((560, min(315, h)) if h <= 315 else (a.shape[1] * 315 // a.shape[0], 315), Image.LANCZOS)
        n = 156
        qz = im.quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        pal = Image.new('P', (1, 1))
        pal.putpalette((qz.getpalette()[:n * 3] + [v for c in cols for v in c] + [0] * 768)[:768])
        im = im.quantize(palette=pal, dither=Image.Dither.NONE)
        im.save(os.path.join(out, f'{name}.png'), optimize=True)
        print(name, im.size, os.path.getsize(os.path.join(out, f'{name}.png')))


if __name__ == '__main__':
    main()
