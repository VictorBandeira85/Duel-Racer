"""Importa arte pronta (pixel art em fundo branco) como sprite do jogo.

Remove o fundo branco ligado às bordas (o branco interno, como vidros e faróis,
é preservado), recorta o carro e reduz para a largura pedida.

Uso: python3 tools/ref/import_art.py <imagem> <saida.png> <largura> [vaos] [--fechar=y0:y1]
  vaos: fração do topo da imagem onde áreas brancas fechadas também viram
        transparentes (ex.: 0.4 para o vão sob a asa do F40)
"""
import sys

import cv2
import numpy as np
from PIL import Image


def main():
    src, out, width = sys.argv[1], sys.argv[2], int(sys.argv[3])
    img = cv2.imread(src)
    h, w = img.shape[:2]
    # "quase branco" ligado às bordas = fundo
    near_white = (img.min(axis=2) > 225).astype(np.uint8)
    bg = np.zeros((h + 2, w + 2), np.uint8)
    work = near_white.copy()
    for x, y in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if work[y, x]:
            cv2.floodFill(work, bg, (x, y), 2)
    fg = (work != 2).astype(np.uint8)
    # --fechar=y0:y1 (fração da altura): nessas linhas o que fica entre a primeira e a última
    # parte do carro é carroceria (teto branco ligado ao fundo por uma fresta no contorno)
    for arg in sys.argv[4:]:
        if arg.startswith('--fechar='):  # y0:y1[:x0:x1] (x limita as colunas, fora ficam retrovisores)
            v = [float(t) for t in arg.split('=')[1].split(':')]
            a, b = int(v[0] * h), int(v[1] * h)
            c0, c1 = (int(v[2] * w), int(v[3] * w)) if len(v) > 2 else (0, w)
            for y in range(a, b):
                xs = np.where(fg[y, c0:c1])[0] + c0
                if len(xs) > 1:
                    fg[y, xs.min():xs.max() + 1] = 1
    args = [v for v in sys.argv[4:] if not v.startswith('--')]
    gaps = float(args[0]) if args else 0
    if gaps:
        n, lab, st, _ = cv2.connectedComponentsWithStats(near_white, 8)
        for i in range(1, n):
            if st[i, cv2.CC_STAT_TOP] + st[i, cv2.CC_STAT_HEIGHT] < gaps * h and st[i, cv2.CC_STAT_AREA] > 0.001 * h * w:
                fg[lab == i] = 0
    # remove sobras pequenas e a franja clara da borda
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8)
    keep = np.zeros_like(fg, bool)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 0.002 * h * w:
            keep |= lab == i
    ys, xs = np.where(keep)
    img, keep = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1], keep[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    hh = round(img.shape[0] * width / img.shape[1])
    # a arte já é pixel art: amostra o centro de cada bloco (sem misturar cores vizinhas)
    src_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    xs_ = ((np.arange(width) + 0.5) * img.shape[1] / width).astype(int)
    ys_ = ((np.arange(hh) + 0.5) * img.shape[0] / hh).astype(int)
    q = src_rgb[ys_][:, xs_]
    a = cv2.resize(keep.astype(np.float32), (width, hh), interpolation=cv2.INTER_AREA) >= 0.5
    Image.fromarray(np.dstack([q, (a * 255).astype(np.uint8)]), 'RGBA').save(out)
    print(out, (width, hh))


if __name__ == '__main__':
    main()
