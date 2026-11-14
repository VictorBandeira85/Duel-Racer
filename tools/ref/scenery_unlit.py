"""Versão de dia (luzes apagadas) de um objeto do cenário que veio desenhado com as luzes acesas.
Os pixels de luz amarela (janelas, lâmpadas, brilho em volta) viram vidro escuro azulado ou a cor da
parede em volta, conforme o tom. Áreas que são amarelas de verdade (faixas zebradas, guarda-sol,
frutas) ficam fora pela caixa de exclusão. Fica até a arte de dia do Victor chegar.
Uso: python3 tools/ref/scenery_unlit.py <aceso.png> <saida.png> [x0,y0,x1,y1 ...] (caixas mantidas) [+x0,y0,x1,y1 ...] (só apaga nelas)
"""
import sys

import cv2
import numpy as np
from PIL import Image


def main():
    src, out = sys.argv[1], sys.argv[2]
    keep = [tuple(int(v) for v in b.split(',')) for b in sys.argv[3:] if not b.startswith('+')]
    only = [tuple(int(v) for v in b[1:].split(',')) for b in sys.argv[3:] if b.startswith('+')]
    im = np.array(Image.open(src).convert('RGBA')).astype(int)
    r, g, b, a = im[..., 0], im[..., 1], im[..., 2], im[..., 3]
    lit = (a > 0) & (r > 190) & (g > 120) & (b < 140) & (r - b > 110)
    if only:  # caixas com '+': só apaga dentro delas
        m = np.zeros_like(lit)
        for x0, y0, x1, y1 in only:
            m[y0:y1, x0:x1] = True
        lit &= m
    for x0, y0, x1, y1 in keep:
        lit[y0:y1, x0:x1] = False
    o = im.copy()
    lum = (r * 0.3 + g * 0.59 + b * 0.11)
    # vidro: tons do mais claro (reflexo) ao mais escuro, pelo brilho da luz original
    glass = np.array([[46, 68, 104], [62, 90, 132], [90, 122, 168], [140, 170, 210]])
    lv = np.clip(((lum - 120) / 140 * 3).astype(int), 0, 3)
    # brilho alaranjado em volta das lâmpadas (na parede) volta a ser parede: preenchido a partir
    # dos vizinhos não acesos; o amarelo forte (vidro aceso) vira vidro escuro
    halo = lit & (g < 185)
    win = lit & ~halo
    for k in range(4):
        m = win & (lv == k)
        o[m, :3] = glass[[0, 1, 1, 2][k]]
    if halo.any():
        rgb = cv2.inpaint(o[..., :3].astype(np.uint8), halo.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
        o[halo, :3] = rgb[halo]
    Image.fromarray(o.astype(np.uint8)).save(out, optimize=True)
    print(out, int(lit.sum()), 'pixels apagados')


if __name__ == '__main__':
    main()
