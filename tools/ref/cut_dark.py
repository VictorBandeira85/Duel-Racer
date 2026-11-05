"""Recorta o carro do fundo escuro com brilho vermelho, na grade nativa (depois do regrid)."""
import sys, cv2, numpy as np
from PIL import Image


def cut(a):
    rgb = a[..., :3].astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    H, W = r.shape
    red = (r - np.maximum(g, b) >= 4) & (np.maximum(g, b) < 0.45 * r) & (r < 128) & (r >= 10)
    yy = np.mgrid[0:H, 0:W][0]
    red |= (rgb.max(axis=2) <= 9) & ((r > np.maximum(g, b)) | (yy < H * 0.5)) & (rgb.max(axis=2) > 3)
    black = rgb.max(axis=2) <= 3
    content = ~(red | black)
    far = cv2.distanceTransform((~content).astype(np.uint8), cv2.DIST_L2, 3) >= 2.5
    red |= black & far  # preto do fundo longe do carro (o contorno preto, colado no carro, fica)
    n, lab = cv2.connectedComponents(red.astype(np.uint8), connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    car = ~bg
    n, lab, st, _ = cv2.connectedComponentsWithStats(car.astype(np.uint8), 4)
    car = lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    inv = (~car).astype(np.uint8)
    n, lab = cv2.connectedComponents(inv, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    car = ~np.isin(lab, list(border))
    # o contorno preto da arte em volta do carro volta (1 px escuro colado no carro)
    ring = cv2.dilate(car.astype(np.uint8), np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)).astype(bool) & ~car
    car |= ring & (rgb.max(axis=2) <= 14)
    out = a.copy()
    if out.shape[2] == 3:
        out = np.dstack([out, np.full((H, W), 255, np.uint8)])
    out[~car, 3] = 0
    ys, xs = np.nonzero(car)
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


if __name__ == '__main__':
    a = np.array(Image.open(sys.argv[1]).convert('RGB'))
    o = cut(a)
    Image.fromarray(o, 'RGBA').save(sys.argv[2])
    print(o.shape)
