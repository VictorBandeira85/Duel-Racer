"""Converte a arte de um interior (vista do motorista) na cabine do jogo.

Gera dois PNGs do mesmo tamanho (256 x linhas, pixels nativos com pixel 8:7):
  <carro>-dash.png  painel sem o volante e sem os ponteiros (reconstruídos por inpainting);
                    o branco do para-brisa (ligado à borda de cima) fica transparente
  <carro>-wheel.png só o volante, para girar em torno do centro do aro
e imprime as posições (em pixels nativos) do pivô do volante e dos mostradores.

Uso: python3 tools/ref/import_cockpit.py <imagem> <pasta> <carro>   (configurações abaixo)
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROWS = 124  # linhas nativas (a cabine começa na linha 100 da tela e vai até a 224)

CARS = {
    'f40': {
        'scale': 0.25, 'x0': 338, 'y0': 50,
        'gauges': {'tach': (774, 200, 70), 'speed': (934, 200, 70)},
    },
    '959': {
        'scale': 0.28, 'x0': 241, 'y0': 20,
        'erase': [(852, 276, 912, 298)],          # hodômetro (não é velocímetro digital)
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

    # volante: contornos medidos na arte (tools/ref/wheels/<carro>.json, gerados por
    # wheel_edges.py = bordas do aro, e wheel_spokes.py = polígono dos raios e do cubo)
    geo = json.load(open(os.path.join(os.path.dirname(__file__), 'wheels', f'{car}.json')))
    shift = lambda pts: (np.array(pts, np.float32) - [x0, y0]).round().astype(np.int32)
    m_out, m_in, m_sp = (np.zeros((h, w), np.uint8) for _ in range(3))
    cv2.fillPoly(m_out, [shift(geo['outer'])], 1)
    cv2.fillPoly(m_in, [shift(geo['inner'])], 1)
    cv2.fillPoly(m_sp, [shift(geo['spokes'])], 1)
    wheel = (m_out > 0) & ((m_in == 0) | (m_sp > 0))
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # ponteiros vermelhos/laranja dentro dos mostradores principais
    hot = ((hsv[..., 0] <= 18) | (hsv[..., 0] >= 170)) & (hsv[..., 1] > 120) & (hsv[..., 2] > 120)
    gmask = np.zeros((h, w), np.uint8)
    for gx, gy, gr in cfg['gauges'].values():
        cx, cy = to_crop(gx, gy)
        cv2.circle(gmask, (int(cx), int(cy)), int(gr * 0.8), 1, -1)
    needles = cv2.dilate((hot & (gmask > 0)).astype(np.uint8), np.ones((5, 5), np.uint8))

    # fundo do painel: apaga volante e ponteiros
    hole = cv2.dilate(wheel.astype(np.uint8), np.ones((7, 7), np.uint8)) | needles
    for (a, b, c, d) in cfg.get('erase', []):
        (a, b), (c, d) = to_crop(a, b), to_crop(c, d)
        hole[max(0, b):max(0, d), max(0, a):max(0, c)] = 1
    # para-brisa: branco ligado à borda de cima fica transparente
    near_white = (img.min(axis=2) > 225).astype(np.uint8)
    ff = near_white.copy()
    msk = np.zeros((h + 2, w + 2), np.uint8)
    for x in range(0, w, 8):
        if ff[0, x] == 1:
            cv2.floodFill(ff, msk, (x, 0), 2)
    sky = ff == 2
    # atrás do aro: a parte cujo vizinho visível mais próximo é o para-brisa também fica
    # transparente; o resto é reconstruído só a partir do painel (sem o branco escorrer)
    known = (hole == 0) & ~sky
    _, lab = cv2.distanceTransformWithLabels((hole == 0).astype(np.uint8) ^ 1, cv2.DIST_L2, 5,
                                             labelType=cv2.DIST_LABEL_PIXEL)
    seeds = np.zeros(lab.max() + 1, bool)
    seeds[lab[hole == 0]] = sky[hole == 0]
    sky0 = sky
    sky = sky | ((hole > 0) & seeds[lab])
    # ponteiros e lataria vermelhos perto do aro não entram na reconstrução (viram manchas)
    near = cv2.dilate(hole, np.ones((41, 41), np.uint8)) > 0
    fill = cv2.inpaint(img, ((~known) | (hot & near)).astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA)
    dash = np.where(known[..., None], img, fill)

    nw, nh = 256, ROWS
    d_rgb = sample(cv2.cvtColor(dash, cv2.COLOR_BGR2RGB), nw, nh)
    d_a = sample((~sky).astype(np.uint8) * 255, nw, nh)
    Image.fromarray(np.dstack([d_rgb, d_a]), 'RGBA').save(f'{outdir}/{car}-dash.png')
    w_rgb = sample(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), nw, nh)
    w_a = sample((wheel & ~sky0).astype(np.uint8) * 255, nw, nh)
    Image.fromarray(np.dstack([w_rgb, w_a]), 'RGBA').save(f'{outdir}/{car}-wheel.png')

    nat = lambda x, y: [round((x - x0) / px_w, 1), round((y - y0) / px_h, 1)]
    meta = {'pivot': nat(*geo['center']), 'rows': ROWS}
    for k, (gx, gy, gr) in cfg['gauges'].items():
        meta[k] = nat(gx, gy) + [round(gr / px_w, 1)]
    print(json.dumps(meta))


if __name__ == '__main__':
    main()
