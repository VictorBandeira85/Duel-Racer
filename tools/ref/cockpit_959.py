"""Gera o painel e o volante do 959 a partir de uma foto do interior (vista frontal).

1. recorta a região do painel na proporção da tela do jogo (256 px, pixel 8:7);
2. apaga o volante e os ponteiros (inpainting) para formar o fundo do painel;
3. recorta o volante (aro, almofada, braços) como sprite separado, para poder girar;
4. reduz tudo para pixels nativos com paleta limitada.

Uso: python3 tools/ref/cockpit_959.py <foto> <pasta-de-saida>
As posições abaixo foram medidas na foto com tools/ref/grid.py.
Sprites derivados de fotos de terceiros: só para o projeto privado.
"""
import sys

import cv2
import numpy as np
from PIL import Image

Y0, ROWS, NW = 542, 104, 256          # topo do painel na foto, linhas nativas, largura nativa
CX, CY, R, TH = 348, 232, 297, 42     # volante (px da foto, relativo ao recorte)
PAD = (166, 196, 550, 338)            # almofada central
ARMS = [(60, 200, 170, 262), (545, 200, 650, 300)]
GAUGES = [(262, 120, 60), (413, 112, 64), (565, 120, 60)]


def pixelate(rgb, size, colors):
    small = cv2.resize(rgb, size, interpolation=cv2.INTER_AREA)
    q = Image.fromarray(small).quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    return np.array(q.convert('RGB'))


def main():
    full, out = cv2.imread(sys.argv[1]), sys.argv[2]
    sx, sy = NW / full.shape[1], 1 / (full.shape[1] / NW / (8 / 7))
    crop = full[Y0:int(Y0 + ROWS / sy)].copy()
    h, w = crop.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot(xx - CX, yy - CY)
    ang = np.degrees(np.arctan2(yy - CY, xx - CX))
    wheel = ((d >= R - TH) & (d <= R + 4)) | ((d >= 226) & (d <= 266) & (ang > 12) & (ang < 168))
    for x0, y0, x1, y1 in [PAD, *ARMS]:
        wheel[y0:y1, x0:x1] = True
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    orange = (hsv[..., 0] >= 3) & (hsv[..., 0] <= 22) & (hsv[..., 1] > 110) & (hsv[..., 2] > 110)
    gauges = np.zeros((h, w), np.uint8)
    for gx, gy, gr in GAUGES:
        cv2.circle(gauges, (gx, gy), gr, 1, -1)
    needles = cv2.dilate((orange & (gauges > 0)).astype(np.uint8), np.ones((5, 5), np.uint8))
    hole = cv2.dilate(wheel.astype(np.uint8), np.ones((9, 9), np.uint8)) | needles
    bg = cv2.inpaint(crop, hole * 255, 9, cv2.INPAINT_TELEA)
    Image.fromarray(pixelate(cv2.cvtColor(bg, cv2.COLOR_BGR2RGB), (NW, ROWS), 48)).save(f'{out}/959-dash.png')

    # volante: usa a foto inteira, porque o topo do aro passa acima do painel
    wy0 = max(0, Y0 + CY - R - 8)
    wcrop = full[wy0:Y0 + CY + R + 8, CX - R - 8:CX + R + 8].copy()
    wh, ww = wcrop.shape[:2]
    yy, xx = np.mgrid[0:wh, 0:ww]
    ccx, ccy = R + 8, (Y0 + CY) - wy0
    d = np.hypot(xx - ccx, yy - ccy)
    ang = np.degrees(np.arctan2(yy - ccy, xx - ccx))
    v = cv2.cvtColor(wcrop, cv2.COLOR_BGR2HSV)[..., 2]
    ox, oy = CX - R - 8, wy0 - Y0

    def rect(x0, y0, x1, y1):
        m = np.zeros((wh, ww), bool)
        m[max(0, y0 - oy):max(0, y1 - oy), max(0, x0 - ox):max(0, x1 - ox)] = True
        return m

    m = ((d >= R - TH) & (d <= R + 4)) | rect(*PAD)
    for a in ARMS:
        m |= rect(*a) & (v > 40)
    m |= (d >= 226) & (d <= 266) & (ang > 12) & (ang < 168) & (v > 70)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros(m.shape, bool)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 3000:
            keep |= lab == i
    size = (round(ww * sx), round(wh * sy))
    rgb = pixelate(cv2.cvtColor(wcrop, cv2.COLOR_BGR2RGB), size, 24)
    alpha = cv2.resize(keep.astype(np.float32), size, interpolation=cv2.INTER_AREA) >= 0.5
    Image.fromarray(np.dstack([rgb, (alpha * 255).astype(np.uint8)]), 'RGBA').save(f'{out}/959-wheel.png')
    print('centro do volante no sprite:', round(ccx * sx, 1), round(ccy * sy, 1), '| no painel:', round(CX * sx, 1), round(CY * sy, 1))


if __name__ == '__main__':
    main()
