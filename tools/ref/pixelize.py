"""Converte arte com sombreado suave (fundo branco) em sprite no estilo pixel art dos outros carros.

Diferente de import_art.py (que espera arte que já é pixel art), aqui a imagem é reduzida
com média, as cores são agrupadas numa paleta curta (faixas chapadas, sem degradê), a borda
clara do recorte some (o contorno é aparado antes de reduzir) e o carro ganha contorno escuro
de 1 pixel, como os sprites desenhados à mão.

Uso: python3 tools/ref/pixelize.py <imagem> <saida.png> <largura> [cores=16] [--fechar=y0:y1[:x0:x1]]
"""
import sys

import cv2
import numpy as np
from PIL import Image


def foreground(img, fechar):
    h, w = img.shape[:2]
    near_white = (img.min(axis=2) > 222).astype(np.uint8)
    work = near_white.copy()
    msk = np.zeros((h + 2, w + 2), np.uint8)
    for x in range(0, w, 6):
        for y in (0, h - 1):
            if work[y, x] == 1:
                cv2.floodFill(work, msk, (x, y), 2)
    for y in range(0, h, 6):
        for x in (0, w - 1):
            if work[y, x] == 1:
                cv2.floodFill(work, msk, (x, y), 2)
    fg = (work != 2).astype(np.uint8)
    if fechar:
        v = [float(t) for t in fechar.split(':')]
        a, b = int(v[0] * h), int(v[1] * h)
        c0, c1 = (int(v[2] * w), int(v[3] * w)) if len(v) > 2 else (0, w)
        for y in range(a, b):
            xs = np.where(fg[y, c0:c1])[0] + c0
            if len(xs) > 1:
                fg[y, xs.min():xs.max() + 1] = 1
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg, 8)
    keep = np.zeros_like(fg)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 0.002 * h * w:
            keep[lab == i] = 1
    return keep


def main():
    src, out, width = sys.argv[1], sys.argv[2], int(sys.argv[3])
    rest = [a for a in sys.argv[4:] if not a.startswith('--')]
    k = int(rest[0]) if rest else 16
    fechar = next((a.split('=')[1] for a in sys.argv[4:] if a.startswith('--fechar=')), None)
    img = cv2.imread(src)
    fg = foreground(img, fechar)
    ys, xs = np.where(fg)
    img, fg = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1], fg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    H, W = img.shape[:2]
    hh = round(H * width / W)
    # a franja clara (mistura com o fundo branco) fica na borda: apara 2 px antes de reduzir
    core = cv2.erode(fg, np.ones((5, 5), np.uint8))
    # cor média só do miolo (sem puxar o branco do fundo para dentro)
    wsum = cv2.resize(core.astype(np.float32), (width, hh), interpolation=cv2.INTER_AREA)
    csum = cv2.resize(img.astype(np.float32) * core[..., None], (width, hh), interpolation=cv2.INTER_AREA)
    rgb = csum / np.maximum(wsum[..., None], 1e-3)
    alpha = cv2.resize(fg.astype(np.float32), (width, hh), interpolation=cv2.INTER_AREA) >= 0.55
    alpha &= wsum > 0.05
    # paleta curta em Lab: faixas chapadas como na pixel art
    lab = cv2.cvtColor(np.clip(rgb, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    pts = lab[alpha]
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.5)
    _, labels, centers = cv2.kmeans(pts, k, None, crit, 4, cv2.KMEANS_PP_CENTERS)
    q = np.zeros_like(lab)
    q[alpha] = centers[labels.ravel()]
    bgr = cv2.cvtColor(np.clip(q, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)
    # um pouco mais de contraste e saturação (a redução apaga)
    hsv = cv2.cvtColor(bgr.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.12, 0, 255)
    bgr = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    # contorno escuro de 1 px na silhueta (por dentro: o tamanho não muda)
    a8 = alpha.astype(np.uint8)
    edge = alpha & (cv2.erode(a8, np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)) == 0)
    bgr[edge] = bgr[edge] * 0.22 + np.array([20, 16, 16]) * 0.78
    out_rgb = cv2.cvtColor(bgr.astype(np.uint8), cv2.COLOR_BGR2RGB)
    Image.fromarray(np.dstack([out_rgb, (alpha * 255).astype(np.uint8)]), 'RGBA').save(out)
    print(out, (width, hh))


if __name__ == '__main__':
    main()
