"""Motos do trânsito com a arte do Victor (folha com a vista de TRÁS à esquerda e de FRENTE à
direita, piloto incluído, fundo magenta) virando sprites do jogo:
src/assets/traffic/moto-<modelo>-<rear|front>.png (sem máscara: a arte já vem colorida).

Pixel art nativa: a moto é dividida numa grade e cada pixel do sprite recebe a cor do MIOLO do bloco
(mediana, sem misturar com os vizinhos nem com o magenta), depois a paleta é encurtada (k-médias em
Lab) para as cores ficarem chapadas. O magenta (e a franja rosada dele) vira transparente.

Escala: a mesma densidade dos carros do trânsito (160 px = 1,8 m, ~89 px/m). A altura real da moto com
o piloto (ALTURA, em m) dá o fator; a frente usa o mesmo fator da traseira (as duas vistas ficam do
mesmo tamanho no jogo). Imprime a largura de cada PNG (MOTO_PX em cars.ts) e as luzes/placa medidas
(TRAFFIC_GLOW/TRAFFIC_PLATE em cars.ts).

Uso: python3 tools/ref/motos.py <custom.png> <sport.png> <pop.png>
     python3 tools/ref/motos.py --cop <folha>   (moto da polícia, classe A: policial em cima, policial
     mulher embaixo -> moto-cop-* e moto-copf-*)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/traffic')
PX_M = 160 / 1.8
ALTURA = {'custom': 1.5, 'sport': 1.36, 'pop': 1.45, 'cop': 1.55, 'copf': 1.55}  # m, do chão ao alto do capacete


def magenta(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 140) & (b > 140) & (g < 120) & (r - g > 80) & (b - g > 80)


def bbox(m):
    ys, xs = np.nonzero(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def shrink(a, fg, box, f, colors=40):
    x0, y0, x1, y1 = box
    tw, th = int(round((x1 - x0) / f)), int(round((y1 - y0) / f))
    out = np.zeros((th, tw, 4), np.uint8)
    r = max(1, int(f * 0.3))
    for j in range(th):
        cy = int(y0 + (j + 0.5) * f)
        for i in range(tw):
            cx = int(x0 + (i + 0.5) * f)
            ya, yb, xa, xb = max(0, cy - r), cy + r + 1, max(0, cx - r), cx + r + 1
            cell = fg[ya:yb, xa:xb]
            if cell.size == 0 or cell.mean() < 0.5:
                continue
            out[j, i, :3] = np.median(a[ya:yb, xa:xb][cell], axis=0)
            out[j, i, 3] = 255
    al = out[..., 3] > 0
    lab = cv2.cvtColor(np.ascontiguousarray(out[..., :3]), cv2.COLOR_RGB2LAB).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.2)
    cv2.setRNGSeed(7)
    _, lbl, cen = cv2.kmeans(lab[al], colors, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    q = np.zeros_like(lab)
    q[al] = cen[lbl.ravel()]
    out[..., :3][al] = cv2.cvtColor(np.clip(q, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)[al]
    # franja rosada que sobrou do magenta: sai
    o = out.astype(int)
    pink = al & (o[..., 0] > 150) & (o[..., 2] > 120) & (o[..., 1] < 110)
    out[pink] = 0
    return out


def blobs(c, W, H, min_px=2):
    n, lab, st, cen = cv2.connectedComponentsWithStats(c.astype(np.uint8))
    return sorted([(st[i, 4], cen[i][0], cen[i][1], st[i]) for i in range(1, n) if st[i, 4] >= min_px], key=lambda b: -b[0])


def measure(o, view):
    H, W = o.shape[:2]
    r, g, b, a = [o[..., i].astype(int) for i in range(4)]
    op = a > 0
    hsv = cv2.cvtColor(np.ascontiguousarray(o[..., :3]), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue, sat, val = hsv[..., 0] * 360 / 256, hsv[..., 1], hsv[..., 2]
    info = {}
    amber = op & (hue > 25) & (hue < 50) & (sat > 150) & (val > 170)
    amber[:H // 3] = False
    am = blobs(amber, W, H)[:2]
    info['pisca'] = sorted([[round(x / W, 3), round(y / H, 3)] for _, x, y, _ in am])
    if view == 'rear':
        red = op & ((hue < 12) | (hue > 345)) & (sat > 150) & (val > 170)
        red[:int(H * 0.45)] = False
        red[:, :int(W * 0.3)] = False
        red[:, int(W * 0.7):] = False
        bl = blobs(red, W, H)
        _, x, y, st = bl[0]
        info['lanterna'] = [round(x / W, 3), round(y / H, 3), round(st[2] / W, 3)]
        wh = op & (np.minimum(np.minimum(r, g), b) > 175) & (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b) < 35)
        wh[:int(H * 0.5)] = False
        wh[:, :W // 4] = False
        wh[:, 3 * W // 4:] = False
        _, _, _, st = blobs(wh, W, H)[0]
        x, y, w, h = st[:4]
        info['placa'] = [int(x), int(y), int(x + w), int(y + h), W, H]
    else:
        lt = op & (np.minimum(r, g) > 200) & (b > 120)
        lt[:H // 4] = False
        lt[int(H * 0.75):] = False
        bl = blobs(lt, W, H)
        _, x, y, st = bl[0]
        info['farol'] = [round(x / W, 3), round(y / H, 3), round(st[2] / W, 3)]
        info['farois'] = [[round(xx / W, 3), round(yy / H, 3), int(n)] for n, xx, yy, _ in bl[:4]]
    return info


def main():
    jobs = []
    if sys.argv[1] == '--cop':
        a = np.array(Image.open(sys.argv[2]).convert('RGB'))
        H = a.shape[0]
        jobs = [('cop', a[:H // 2]), ('copf', a[H // 2:])]
    else:
        jobs = [(m, np.array(Image.open(p).convert('RGB'))) for m, p in zip(('custom', 'sport', 'pop'), sys.argv[1:4])]
    for model, a in jobs:
        a = np.ascontiguousarray(a)
        mag = magenta(a.astype(int))
        W = a.shape[1]
        halves = {'rear': slice(0, W // 2), 'front': slice(W // 2, W)}
        boxes = {}
        for view, sl in halves.items():
            m = np.zeros_like(mag)
            m[:, sl] = ~mag[:, sl]
            # pontinhos soltos (ruído de compressão) não entram na caixa
            m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
            boxes[view] = (m, bbox(m))
        f = (boxes['rear'][1][3] - boxes['rear'][1][1]) / (ALTURA[model] * PX_M)
        for view in ('rear', 'front'):
            m, box = boxes[view]
            o = shrink(a, m & ~mag, box, f)
            # linhas e colunas vazias nas bordas saem
            al = o[..., 3] > 0
            ys, xs = np.nonzero(al)
            o = o[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            name = f'moto-{model}-{view}'
            Image.fromarray(o).save(os.path.join(OUT, name + '.png'), optimize=True)
            print(name, o.shape[1], 'x', o.shape[0], 'fator', round(f, 2), measure(o, view))


if __name__ == '__main__':
    main()
