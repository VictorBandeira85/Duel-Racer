"""Converte a arte de um interior (vista do motorista) na cabine do jogo.

Gera dois PNGs do mesmo tamanho (256 x linhas, pixels nativos com pixel 8:7):
  <carro>-dash.png  painel sem o volante e sem os ponteiros (reconstruídos por inpainting);
                    o branco do para-brisa (ligado à borda de cima) fica transparente
  <carro>-wheel.png só o volante, para girar em torno do centro do aro
e imprime as posições (em pixels nativos) do pivô do volante e dos mostradores.

Uso: python3 tools/ref/import_cockpit.py <imagem> <pasta> <carro>   (configurações abaixo)
"""
import json
import sys

import cv2
import numpy as np
from PIL import Image

ROWS = 124  # linhas nativas (a cabine começa na linha 100 da tela e vai até a 224)

CARS = {
    'f40': {
        'scale': 0.25, 'x0': 338, 'y0': 50,
        'rim': (850, 335, 300, 255, 46),           # centro x, y, raio x, raio y, espessura
        'parts': [(560, 290, 1150, 395), (820, 380, 885, 590), (790, 285, 910, 400)],
        'gauges': {'tach': (774, 200, 70), 'speed': (934, 200, 70)},
    },
    '959': {
        'scale': 0.28, 'x0': 241, 'y0': 20,
        'rim': (698, 331, 268, 268, 40),
        'parts': [(492, 322, 912, 386), (668, 400, 732, 610), (622, 305, 778, 446)],
        'gauges': {'tach': (696, 211, 84), 'speed': (876, 228, 72)},
    },
}


def sample(img, w, h):
    """Arte em pixel art: amostra o centro de cada bloco (sem misturar cores)."""
    xs = ((np.arange(w) + 0.5) * img.shape[1] / w).astype(int)
    ys = ((np.arange(h) + 0.5) * img.shape[0] / h).astype(int)
    return img[ys][:, xs]


def main():
    src, outdir, car = sys.argv[1], sys.argv[2], sys.argv[3]
    cfg = CARS[car]
    full = cv2.imread(src)
    s = cfg['scale']
    px_w, px_h = 1 / s, (1 / s) / (8 / 7)  # px da imagem por pixel nativo
    x0, y0 = cfg['x0'], cfg['y0']
    x1, y1 = int(x0 + 256 * px_w), int(y0 + ROWS * px_h)
    pad_x0, pad_x1 = max(0, -x0), max(0, x1 - full.shape[1])
    canvas = cv2.copyMakeBorder(full, 0, max(0, y1 - full.shape[0]), pad_x0, pad_x1, cv2.BORDER_REPLICATE)
    img = canvas[y0:y1, x0 + pad_x0:x1 + pad_x0].copy()
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]

    def to_crop(x, y):
        return x - x0, y - y0

    # volante: anel elíptico + raios/cubo (dentro deles, só o que não é fundo claro)
    rx_, ry_ = to_crop(cfg['rim'][0], cfg['rim'][1])
    ax, ay, th = cfg['rim'][2], cfg['rim'][3], cfg['rim'][4]
    e_out = ((xx - rx_) / ax) ** 2 + ((yy - ry_) / ay) ** 2 <= 1
    e_in = ((xx - rx_) / (ax - th)) ** 2 + ((yy - ry_) / (ay - th)) ** 2 <= 1
    wheel = e_out & ~e_in
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    yellow = (hsv[..., 0] >= 18) & (hsv[..., 0] <= 35) & (hsv[..., 1] > 120) & (hsv[..., 2] > 120)
    # no aro, texto e ponteiros dos mostradores que aparecem por dentro ficam de fora
    wheel &= ~((img.min(axis=2) > 110) | ((hsv[..., 1] > 110) & (hsv[..., 2] > 90) & ~yellow))
    parts = np.zeros((h, w), bool)
    for (a, b, c, d) in cfg['parts']:
        (a, b), (c, d) = to_crop(a, b), to_crop(c, d)
        parts[max(0, b):max(0, d), max(0, a):max(0, c)] = True
    # nos raios/cubo, só o metal cinza (e o amarelo), mais o contorno preto em volta;
    # as caixas pretas dos mostradores atrás dos raios ficam no painel
    metal = (parts & (((hsv[..., 2] > 42) & (hsv[..., 1] < 90)) | yellow)).astype(np.uint8)
    metal = cv2.morphologyEx(metal, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    metal = cv2.morphologyEx(metal, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    wheel |= parts & (cv2.dilate(metal, np.ones((7, 7), np.uint8)) > 0)

    # ponteiros vermelhos/laranja dentro dos mostradores principais
    hot = ((hsv[..., 0] <= 18) | (hsv[..., 0] >= 170)) & (hsv[..., 1] > 120) & (hsv[..., 2] > 120)
    gmask = np.zeros((h, w), np.uint8)
    for gx, gy, gr in cfg['gauges'].values():
        cx, cy = to_crop(gx, gy)
        cv2.circle(gmask, (int(cx), int(cy)), int(gr * 0.8), 1, -1)
    needles = cv2.dilate((hot & (gmask > 0)).astype(np.uint8), np.ones((5, 5), np.uint8))

    # fundo do painel: apaga volante e ponteiros
    hole = cv2.dilate(wheel.astype(np.uint8), np.ones((7, 7), np.uint8)) | needles
    dash = cv2.inpaint(img, hole * 255, 7, cv2.INPAINT_TELEA)
    # para-brisa: branco ligado à borda de cima fica transparente
    near_white = (img.min(axis=2) > 225).astype(np.uint8)
    ff = near_white.copy()
    msk = np.zeros((h + 2, w + 2), np.uint8)
    for x in range(0, w, 8):
        if ff[0, x] == 1:
            cv2.floodFill(ff, msk, (x, 0), 2)
    sky = ff == 2

    nw, nh = 256, ROWS
    d_rgb = sample(cv2.cvtColor(dash, cv2.COLOR_BGR2RGB), nw, nh)
    d_a = sample((~sky).astype(np.uint8) * 255, nw, nh)
    Image.fromarray(np.dstack([d_rgb, d_a]), 'RGBA').save(f'{outdir}/{car}-dash.png')
    w_rgb = sample(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), nw, nh)
    w_a = sample((wheel & ~sky).astype(np.uint8) * 255, nw, nh)
    Image.fromarray(np.dstack([w_rgb, w_a]), 'RGBA').save(f'{outdir}/{car}-wheel.png')

    nat = lambda x, y: [round((x - x0) / px_w, 1), round((y - y0) / px_h, 1)]
    meta = {'pivot': nat(cfg['rim'][0], cfg['rim'][1]), 'rows': ROWS}
    for k, (gx, gy, gr) in cfg['gauges'].items():
        meta[k] = nat(gx, gy) + [round(gr / px_w, 1)]
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
