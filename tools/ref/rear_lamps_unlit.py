"""Lanternas apagadas na arte (revisão das traseiras): o jogo acende pisca, freio e lanterna por cima, então
nada pode parecer aceso no sprite.
- Gaúcho GTI (br-golgti-rear): as lentes âmbar e vermelha vinham com "miolo" de lâmpada acesa (amarelo e
  branco, anel laranja no vermelho): voltam para a cor da lente; a âmbar de baixo vira vermelha (o pisca é a
  primeira parte da faixa fumê de cima, sigRear em cars.ts).
- Onça GTE (br-pumagte-rear): a lente clara de dentro é a luz de ré; tinha um ponto laranja de lâmpada e tom
  bege quente: vira vidro claro neutro (o pisca passa para a ponta de fora, vermelho, em cars.ts).
Rodar depois de golgti_sprites.py / pumagte_sprites2.py.  Uso: python3 tools/ref/rear_lamps_unlit.py
"""
import os

import numpy as np
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'assets', 'cars')


def both(W, x0, x1):
    return [(x0, x1), (W - x1, W - x0)]


def gti():
    p = os.path.join(D, 'br-golgti-rear.png')
    a = np.array(Image.open(p).convert('RGBA'))
    W = a.shape[1]
    n = 0
    for (lx0, lx1), base, gmax in [((3, 16), (240, 106, 2), 0x80), ((17, 34), (248, 12, 3), 0x28), ((46, 60), (248, 6, 3), 0x28)]:
        for x0, x1 in both(W, lx0, lx1):
            for y in range(116, 128):
                for x in range(x0, x1):
                    r, g, b, al = a[y, x]
                    if al and r > 0xc0 and g > gmax:
                        a[y, x, :3] = base
                        n += 1
    # no Gol GTI de verdade o pisca é a primeira parte (de fora) da faixa fumê de cima; a faixa de baixo é
    # toda vermelha: a lente âmbar de baixo, na ponta, vira vermelha (o mesmo tom, sombreado pelo brilho)
    for x0, x1 in both(W, 3, 18):
        for y in range(116, 128):
            for x in range(x0, x1):
                r, g, b, al = a[y, x].astype(int)
                if al and r > 0x70 and g > 0x0c and g > b:
                    a[y, x, :3] = (r, min(g, max(3, int(r * 0.05))), min(b, 3))
                    n += 1
    Image.fromarray(a).save(p, optimize=True)
    print('gti', n)


def gte():
    p = os.path.join(D, 'br-pumagte-rear.png')
    a = np.array(Image.open(p).convert('RGBA'))
    W = a.shape[1]
    n = 0
    for x0, x1 in both(W, 69, 80):
        for y in range(92, 104):
            for x in range(x0, x1):
                r, g, b, al = a[y, x].astype(int)
                if not al or max(r, g, b) < 0x60:
                    continue  # contorno escuro fica
                l = (max(r, g, b) + min(r, g, b)) / 2 / 255
                if r - b > 0x50:  # ponto laranja da lâmpada: tom do vidro em volta
                    l = 0.62
                v = int(min(235, 90 + l * 150))
                a[y, x, :3] = (v - 6, v - 2, v + 6)
                n += 1
    Image.fromarray(a).save(p, optimize=True)
    print('gte', n)


gti()
gte()
