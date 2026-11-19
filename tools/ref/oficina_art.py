"""Oficina (arte do Victor): fundo de dia e de noite (cena 1536 x 1024) e os móveis, ferramentas e o mecânico
sobre magenta -> src/assets/oficina/. Tudo numa escala só: 84 px por metro (o dobro do que a foto da garagem
mostra: desenhado sem suavizar, fica nítido). O fundo tem ~200 px por metro na arte (a estante, ~2 m, vai de y
260 a 660; a faixa amarela do piso em y 680). Cada objeto recebe a altura real dele (H, metros), recortado do
magenta (franja rosada vira contorno) e reduzido pela cor do miolo de cada bloco (nada de borrar).
O mecânico vira três quadros (mech-0 em pé com a chave, mech-1 agachado na roda, mech-2 fazendo joia).
Uso: python3 tools/ref/oficina_art.py <pasta com fundo-dia.png, fundo-noite.png, elevador.png, ...> <src/assets/oficina>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

PXM = 84
BG_PXM = 200
H = {'elevador': 2.4, 'carrinho': 1.05, 'bancada': 1.15, 'macaco': 1.0, 'cavalete': 0.6, 'pneus': 0.95,
     'compressor': 0.95, 'guincho': 1.8, 'motor': 1.3, 'tambor': 1.25, 'dinamometro': 1.45}
MECH_H = 1.75


def magenta(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 140) & (b > 140) & (r - g > 80) & (b - g > 80)


def reduce(a, alpha, f):
    """cada pixel = mediana do miolo do bloco f x f (alfa = maioria)"""
    Hh, Ww = a.shape[:2]
    h, w = max(1, int(round(Hh / f))), max(1, int(round(Ww / f)))
    out = np.zeros((h, w, 4), np.uint8)
    rr = max(1, int(f * 0.25))
    for j in range(h):
        cy = min(Hh - 1, int((j + 0.5) * f))
        for i in range(w):
            cx = min(Ww - 1, int((i + 0.5) * f))
            blk = a[max(0, cy - rr):cy + rr + 1, max(0, cx - rr):cx + rr + 1].reshape(-1, 3)
            al = alpha[max(0, cy - rr):cy + rr + 1, max(0, cx - rr):cx + rr + 1].reshape(-1)
            if al.mean() < 0.5:
                continue
            out[j, i] = [*np.median(blk[al], axis=0).astype(np.uint8), 255]
    return out


def cut(a):
    m = magenta(a.astype(int))
    obj = ~m
    obj = cv2.morphologyEx(obj.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    # franja rosada: pixel de objeto encostado no magenta com vermelho e azul altos -> contorno escuro
    ai = a.astype(int)
    fr = obj & (ai[..., 0] - ai[..., 1] > 50) & (ai[..., 2] - ai[..., 1] > 50)
    a = a.copy()
    a[fr] = (24, 16, 24)
    return a, obj


def main():
    src, out = sys.argv[1], sys.argv[2]
    for when in ('dia', 'noite'):
        a = np.array(Image.open(os.path.join(src, f'fundo-{when}.png')).convert('RGB'))
        o = reduce(a, np.ones(a.shape[:2], bool), BG_PXM / PXM)
        Image.fromarray(o).save(os.path.join(out, f'fundo-{when}.png'), optimize=True)
        print('fundo', when, o.shape[1], o.shape[0])
    for name, hm in H.items():
        a = np.array(Image.open(os.path.join(src, f'{name}.png')).convert('RGB'))
        a, obj = cut(a)
        ys, xs = np.nonzero(obj)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        f = (y1 - y0) / (hm * PXM)
        o = reduce(a[y0:y1, x0:x1], obj[y0:y1, x0:x1], f)
        Image.fromarray(o).save(os.path.join(out, f'{name}.png'), optimize=True)
        print(name, o.shape[1], o.shape[0])
    a = np.array(Image.open(os.path.join(src, 'mecanico.png')).convert('RGB'))
    a, obj = cut(a)
    runs = [(0, 455), (455, 1078), (1078, a.shape[1])]   # as três poses (a roda da do meio encosta)
    ys = np.nonzero(obj.any(axis=1))[0]
    f = None
    for k, (x0, x1) in enumerate(runs[:3]):
        sub = obj[:, x0:x1]
        yy = np.nonzero(sub.any(axis=1))[0]
        if f is None:   # o primeiro (em pé) dá a escala: 1,75 m
            f = (yy.max() + 1 - yy.min()) / (MECH_H * PXM)
        o = reduce(a[yy.min():yy.max() + 1, x0:x1], sub[yy.min():yy.max() + 1], f)
        Image.fromarray(o).save(os.path.join(out, f'mech-{k}.png'), optimize=True)
        print('mech', k, o.shape[1], o.shape[0])


if __name__ == '__main__':
    main()
