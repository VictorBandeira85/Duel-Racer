"""Peças e motor V8 da tela de carregamento (arte do Victor) -> src/assets/loadart/*.png recortados
(sem fundo), em pixel art (cor do miolo de cada bloco, sem borrar), para drawParts/drawEngine (src/loadart.ts).
Fundo: transparência da arte, ou o fundo liso (roxo, creme) inundado a partir das bordas.
V8: o motor da folha da F40 (2.9 biturbo), sem as linhas de legenda e sem o nome nas tampas.
Uso: python3 tools/ref/loadart_art.py <pasta dos uploads>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/loadart')
# nome: (arquivo, altura final em px, recorte opcional x0, y0, x1, y1)
PARTS = {
    'suspensao': ('151f76bd-image.png', 52, None),
    'freio': ('570fcb54-image.png', 46, None),
    'escape': ('2e747a44-image.png', 30, None),
    'pistao': ('727c72f0-image.png', 50, None),
    'turbo': ('70fa419e-image.png', 40, None),
    'comando': ('9bbfcc13-image.png', 22, None),
    'v8': ('851337fc-image.png', 104, (330, 330, 1010, 800)),
}


def flood_bg(a, tol=38):
    """fundo liso: pixels ligados à borda com cor perto da cor da borda"""
    h, w = a.shape[:2]
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).astype(int)
    ref = np.median(border, axis=0)
    near = (np.abs(a.astype(int) - ref).max(-1) < tol)
    # fundos xadrez (roxo em dois tons): aceita também o segundo tom mais comum da borda
    alt = border[np.abs(border - ref).max(-1) >= tol]
    if len(alt) > len(border) * 0.2:
        ref2 = np.median(alt, axis=0)
        near |= np.abs(a.astype(int) - ref2).max(-1) < tol
    n, lab = cv2.connectedComponents(near.astype(np.uint8), connectivity=4)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return np.isin(lab, list(edge))


def clean_v8(a):
    """tira as linhas vermelhas de legenda (finas) e os pontos, e o nome branco das tampas vermelhas"""
    rgb = a.astype(int)
    red = (rgb[..., 0] > 150) & (rgb[..., 1] < 90) & (rgb[..., 2] < 90)
    loose = (rgb[..., 0] > 150) & (rgb[..., 0] - rgb[..., 1] > 60) & (rgb[..., 0] - rgb[..., 2] > 60)
    big = cv2.morphologyEx(loose.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    big = cv2.morphologyEx(big, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)) > 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(big.astype(np.uint8))
    covers = np.zeros_like(red)
    for i in range(1, n):
        if st[i, 4] > 1500:
            covers |= lab == i
    covers = cv2.dilate(covers.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    thin = red & ~covers
    # pontos da legenda: miolo branco junto do vermelho fino
    white = rgb.min(-1) > 200
    dots = cv2.dilate(thin.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    hole = (thin | (white & dots & ~covers)).astype(np.uint8)
    hole = cv2.dilate(hole, np.ones((3, 3), np.uint8))
    a = cv2.inpaint(a, hole, 5, cv2.INPAINT_TELEA)
    # letreiro: as letras claras dentro das tampas vermelhas (e o contorno escuro delas) viram o vermelho da
    # própria tampa, pela mediana do vermelho na mesma coluna (mantém o sombreado de cima para baixo)
    rgb = a.astype(int)
    red = (rgb[..., 0] > 120) & (rgb[..., 1] < 90) & (rgb[..., 2] < 90)
    cv = cv2.morphologyEx(covers.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8)) > 0
    inner = cv2.erode(cv.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    lt = inner & ((rgb.min(-1) > 150) | (rgb.max(-1) < 110))
    lt = (cv2.dilate(lt.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & inner & ~(red & (rgb[..., 0] > 160))
    out = a.copy()
    ys, xs = np.nonzero(lt)
    for y, x in zip(ys, xs):
        for rr in (6, 12, 24):
            col = red[max(0, y - rr):y + rr + 1, x] & ~lt[max(0, y - rr):y + rr + 1, x]
            if col.sum() >= 3:
                out[y, x] = np.median(a[max(0, y - rr):y + rr + 1, x][col], axis=0)
                break
    return out


def shrink(rgb, alpha, H):
    h, w = alpha.shape
    k = h / H
    W = max(1, round(w / k))
    o = np.zeros((H, W, 4), np.uint8)
    r = max(1, int(k * 0.2))
    for j in range(H):
        cy = int((j + 0.5) * k)
        for i in range(W):
            cx = int((i + 0.5) * k)
            sl = (slice(max(0, cy - r), cy + r + 1), slice(max(0, cx - r), cx + r + 1))
            m = alpha[sl]
            if m.mean() < 0.5:
                continue
            o[j, i] = [*np.median(rgb[sl][m], axis=0).astype(np.uint8), 255]
    # contorno escuro de 1 px onde a peça encosta no vazio (como o resto da pixel art)
    op = o[..., 3] > 0
    ring = (cv2.dilate(op.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~op
    o[ring] = [20, 18, 24, 255]
    return o


def main():
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    for name, (f, H, box) in PARTS.items():
        im = Image.open(os.path.join(src, f)).convert('RGBA')
        if box:
            im = im.crop(box)
        a = np.array(im)
        rgb = np.ascontiguousarray(a[..., :3])
        if name == 'v8':
            rgb = clean_v8(rgb)
        if a[..., 3].min() < 20:
            alpha = a[..., 3] > 128
        else:
            alpha = ~flood_bg(rgb)
        # só as manchas grandes (texto, legenda e restos saem)
        n, lab, st, _ = cv2.connectedComponentsWithStats(alpha.astype(np.uint8), connectivity=8)
        big = st[1:, 4].max()
        keep = [i for i in range(1, n) if st[i, 4] > big * 0.05]
        alpha = np.isin(lab, keep)
        ys, xs = np.nonzero(alpha)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        o = shrink(rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1], H)
        Image.fromarray(o).save(os.path.join(OUT, f'{name}.png'), optimize=True)
        print(name, o.shape[1], 'x', o.shape[0])


if __name__ == '__main__':
    main()
