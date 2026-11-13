"""Fundo panorâmico (relevo do horizonte) desenhado pelo Victor no gerador de imagens, em pixel art
ampliada sobre magenta chapado (#FF00FF), virando a faixa nativa do jogo (bgart.ts: 1024 x 64).
- acha a grade da arte (período dos blocos em x e y, como regrid.py) e pega a cor do miolo de cada bloco
- a arte emenda nas laterais: é repetida em x (uma cópia sim, outra espelhada, para as mesmas árvores
  não aparecerem em fila) e reamostrada para caber exatamente em 1024 colunas
  (a diferença de período fica espalhada: no máximo um bloco pulado a cada ~40, sem borrão)
- o magenta vira transparente; o relevo fica encostado embaixo da faixa de 64 linhas
- MESA_ONLY=1 (mesetas): o verde da frente (morros e copas) sai; abaixo do relevo azul cada coluna
  continua com o azul mais escuro dela até o pé da faixa (as camadas da frente cobrem o resto)
Uso: python3 tools/ref/bg_panorama.py <arte.png> <saida.png> [repeticoes=6]
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from regrid import period_phase  # noqa: E402

W, H = 1024, 64


def main():
    src, out = sys.argv[1], sys.argv[2]
    reps = int(sys.argv[3]) if len(sys.argv) > 3 else 6
    a = np.array(Image.open(src).convert('RGB')).astype(int)
    mag = (a[..., 0] > 170) & (a[..., 1] < 110) & (a[..., 2] > 170)
    g = cv2.cvtColor(a.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(float)
    top = int(np.where((~mag).any(1))[0].min())
    py, phy = period_phase(np.abs(np.diff(g, axis=0))[top:].sum(1), 9.5, 18)  # blocos quase quadrados (~12 px)
    phy += top
    hh, ww = a.shape[:2]
    rows = []
    y = phy + py / 2
    while y - py / 2 < hh:
        if y >= top - py and y < hh:
            rows.append(y)
        y += py
    px = ww * reps / W  # período de amostragem em x (próximo do período da arte)
    o = np.zeros((H, W, 4), np.uint8)
    r = max(1, int(min(px, py) * 0.22))
    y0 = H - len(rows)
    for j, cy in enumerate(rows):
        yy = int(round(cy))
        for i in range(W):
            t = ((i + 0.5) * px) % (2 * ww)
            cx = int(t if t < ww else 2 * ww - 1 - t)  # repetições alternadas espelhadas: menos repetição à vista
            ys, xs = slice(max(0, yy - r), min(hh, yy + r + 1)), np.arange(cx - r, cx + r + 1) % ww
            blk = a[ys][:, xs].reshape(-1, 3)
            m = mag[ys][:, xs].reshape(-1)
            if m.mean() > 0.5:
                continue
            c = np.median(blk[~m], axis=0)
            if 0 <= y0 + j < H:
                o[y0 + j, i] = [*c.astype(np.uint8), 255]
    if os.environ.get('MESA_ONLY'):
        rgb = o[..., :3].astype(int)
        green = (o[..., 3] > 0) & (rgb[..., 1] > rgb[..., 2] - 20)
        g0 = np.array([np.where(green[:, i])[0].min() if green[:, i].any() else H for i in range(W)])
        # pé das mesetas: um azul só (o mais escuro da base), em faixas horizontais lisas, sem listras
        foot = [o[y - 1, i, :3] for i, y in enumerate(g0) if 0 < y < H and o[y - 1, i, 3]]
        base = np.median(np.array(foot), axis=0) * 0.8 if foot else np.array([40, 70, 120])
        cut = int(np.percentile(g0, 20))
        for i in range(W):
            for y in range(min(g0[i], cut), H):
                o[y, i] = [*base.astype(np.uint8), 255]
    Image.fromarray(o).save(out, optimize=True)
    print(out, 'linhas de relevo:', len(rows), 'periodo', round(px, 2), round(py, 2))


if __name__ == '__main__':
    main()
