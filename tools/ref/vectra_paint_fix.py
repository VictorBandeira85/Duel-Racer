"""Pintura do Vetor GSi coerente em qualquer cor (rodar logo depois de vectra_sprites.py).

A arte é de um carro preto: lataria, borrachas, molduras dos vidros, colunas, frisos e recessos
são todos pretos, e a máscara de pintura (feita pelo escuro) pegava tudo junto. Em outra cor o
para-brisa ganhava moldura vermelha, os faróis pixels vermelhos e as colunas riscos. Aqui:
- vidro (e o que se vê por ele) e uma moldura de borracha preta em volta ficam fora da pintura
- colunas entre janelas (lateral) são pretas
- faróis, lanternas, piscas, cromados: fora da pintura, com uma margem de 1 px
- frente: base do para-brisa (limpadores) em plástico preto; vidro lateral visto pelas colunas
- lataria em superfícies lisas (mediana, poucos tons), linhas horizontais longas mantidas;
  vincos, frestas e recessos (bem mais escuros que a lataria em volta) ficam pretos

Uso: python3 tools/ref/vectra_paint_fix.py src/assets/cars
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

K4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)
K8 = np.ones((3, 3), np.uint8)
TRIM = (20, 20, 23)


def glass_zone(a):
    rgb = a[..., :3].astype(int)
    op = a[..., 3] > 0
    H = a.shape[0]
    # só o vidro pintado por vectra_sprites (degradê azul-acinzentado: g-r ~16, b-g ~14-18);
    # os reflexos azulados da arte no capô e no teto não entram
    gr, bg = rgb[..., 1] - rgb[..., 0], rgb[..., 2] - rgb[..., 1]
    g = op & (np.abs(gr - 16) <= 4) & (np.abs(bg - 15) <= 5) & (rgb.mean(axis=2) > 70)
    g[int(H * 0.62):] = False
    n, lab, st, _ = cv2.connectedComponentsWithStats(g.astype(np.uint8), 8)
    z = np.zeros(g.shape, np.uint8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 10:
            continue
        pts = np.column_stack(np.nonzero(lab == i)[::-1]).astype(np.int32)
        cv2.fillPoly(z, [cv2.convexHull(pts)], 1)
    return z > 0


def smooth_body(a, m):
    H, W = m.shape
    lum = a[..., :3].astype(float).mean(axis=2)
    known = m.astype(np.uint8)
    _, lab = cv2.distanceTransformWithLabels(1 - known, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(known)
    idx = np.zeros(lab.max() + 1, int)
    idx[lab[ys, xs]] = ys * W + xs
    filled = lum.ravel()[idx[lab]].reshape(H, W)
    sm = cv2.medianBlur(cv2.medianBlur(filled.astype(np.uint8), 5), 3).astype(float)
    lv = np.percentile(sm[m], [8, 30, 55, 78, 94])
    tone = lv[np.abs(sm[..., None] - lv[None, None, :]).argmin(axis=2)]
    new = np.where(m, tone, lum)
    # vincos, frestas e recessos: bem mais escuros que a lataria em volta -> pretos, fora da pintura
    seam = m & (lum < sm * 0.62) & (lum < np.percentile(lum[m], 25))
    # só traços de verdade (linhas de 5+ px); pontinhos soltos voltam a ser lataria
    n, lab, st, _ = cv2.connectedComponentsWithStats(seam.astype(np.uint8), 8)
    ok = np.zeros(n, bool)
    ok[1:] = (np.maximum(st[1:, cv2.CC_STAT_WIDTH], st[1:, cv2.CC_STAT_HEIGHT]) >= 5)
    seam = ok[lab] & seam
    # linhas horizontais longas (borda do capô, frisos): continuam como estão (na cor)
    dark = m & (lum < sm - 6) & ~seam
    for y in range(H):
        row = np.nonzero(m[y])[0]
        if len(row) < 20:
            continue
        sl = slice(row.min(), row.max() + 1)
        if dark[y, sl].mean() > 0.45:
            new[y, sl][dark[y, sl]] = lum[y, sl][dark[y, sl]]
    g = np.clip(new, 0, 255).astype(np.uint8)
    for k in range(3):
        a[m, k] = g[m]
    a[seam, :3] = (14, 14, 16)
    return m & ~seam, lv


def fix(a, m, view):
    H, W = m.shape
    op = a[..., 3] > 0
    rgb = a[..., :3].astype(int)
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    z = glass_zone(a)
    # moldura de borracha em volta do vidro
    ring = (cv2.dilate(z.astype(np.uint8), K8, iterations=2) > 0) & ~z & op
    if view == 'side':  # colunas entre as janelas: o vão entre dois vidros na mesma linha
        for y in range(H):
            xs = np.nonzero(z[y])[0]
            if len(xs) < 2:
                continue
            gaps = np.nonzero(np.diff(xs) > 1)[0]
            for gi in gaps:
                x0, x1 = xs[gi] + 1, xs[gi + 1]
                if x1 - x0 <= 7:
                    ring[y, x0:x1] = True
    a[ring & m, :3] = TRIM
    m = m & ~ring & ~z
    # faróis, lanternas, piscas, cromados e emblemas: fora da pintura (com 1 px de margem)
    lamp = op & ~z & ((sat > 70) | (lum > 135))
    n, lab, st, _ = cv2.connectedComponentsWithStats(lamp.astype(np.uint8), 8)
    keep = np.zeros_like(lamp)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 3:
            keep |= lab == i
    m &= ~(cv2.dilate(keep.astype(np.uint8), K8) > 0)
    if view == 'front':
        cowl = np.zeros_like(m)
        cowl[27:36, 18:W - 18] = True
        cowl &= op & ~z
        a[cowl, :3] = (24, 24, 27)
        for y, x0, x1 in ((31, 40, 76), (32, 86, 122)):  # palhetas
            a[y, x0:x1, :3] = (44, 44, 48)
        m &= ~cowl
        # colunas do para-brisa: faixa de 3 px junto da borda; dentro dela, vidro lateral liso
        dist = cv2.distanceTransform(op.astype(np.uint8), cv2.DIST_L1, 3)
        side = np.zeros_like(m)
        side[4:27, :44] = True
        side[4:27, W - 44:] = True
        sg = side & op & ~z & (dist > 3.5) & ~ring
        gy = np.clip((np.arange(H)[:, None] - 4) / 24, 0, 1) * np.ones((1, W))
        col = np.array([150, 166, 184]) * (1 - gy[..., None]) + np.array([84, 98, 116]) * gy[..., None]
        a[sg, :3] = col[sg].astype(np.uint8)
        m &= ~sg
    if view == 'rear':
        m[int(H * 0.8):] = False  # parte de baixo do para-choque: plástico preto
    m, lv = smooth_body(a, m)
    if view == 'front':  # vincos do capô: retos e contínuos
        for cx in (20, W - 21):
            pts = []
            for y in range(36, 59):
                xs_ = np.arange(cx - 2, cx + 3)
                if m[y, xs_].any():
                    pts.append((y, xs_[np.argmin(np.where(m[y, xs_], lum[y, xs_], 999))]))
            if len(pts) >= 5:
                py, px = np.array(pts).T
                k, b = np.polyfit(py, px, 1)
                for y in range(36, 59):
                    x = int(round(k * y + b))
                    if m[y, x]:
                        a[y, x, :3] = int(lv[0] * 0.6)
    # pedacinhos soltos de pintura (1-2 px no meio do preto) saem
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 4)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 6:
            m[lab == i] = False
    return m


def main():
    d = sys.argv[1]
    for view in ('front', 'side', 'rear'):
        fp, fm = os.path.join(d, f'br-vectra-{view}.png'), os.path.join(d, f'br-vectra-{view}-mask.png')
        a = np.array(Image.open(fp).convert('RGBA'))
        m = np.array(Image.open(fm).convert('L')) > 0
        m = fix(a, m, view)
        Image.fromarray(a, 'RGBA').save(fp)
        Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(fm)
        print(view, 'máscara', int(m.sum()))


if __name__ == '__main__':
    main()
