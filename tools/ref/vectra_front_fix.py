"""Frente do Vetor GSi limpa para qualquer cor (depois de vectra_sprites.py): a arte é de um carro
preto e os reflexos dela (riscos no capô, manchas na base do para-brisa, vincos tracejados, o
vidro lateral visto pelas colunas) somem no preto mas viram rabiscos em outra cor.
- base do para-brisa (limpadores): plástico preto, fora da pintura
- vidro lateral entre as colunas: vidro, fora da pintura
- lataria: superfície lisa em poucos tons (mediana + faixas), mantendo as linhas horizontais
  longas (borda do capô, para-choque) e os vincos do capô contínuos

Uso: python3 tools/ref/vectra_front_fix.py src/assets/cars
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image


def main():
    d = sys.argv[1]
    fp, fm = os.path.join(d, 'br-vectra-front.png'), os.path.join(d, 'br-vectra-front-mask.png')
    a = np.array(Image.open(fp).convert('RGBA'))
    m = np.array(Image.open(fm).convert('L')) > 0
    H, W = m.shape
    lum = a[..., :3].astype(float).mean(axis=2)
    # 1) base do para-brisa com os limpadores: plástico preto
    cowl = np.zeros_like(m)
    cowl[27:36, 18:W - 18] = True
    cowl &= m
    a[cowl, :3] = (24, 24, 27)
    for y, x0, x1 in ((31, 40, 76), (32, 86, 122)):  # palhetas dos limpadores
        a[y, x0:x1, :3] = (44, 44, 48)
    m &= ~cowl
    # 2) vidro lateral visto pelas colunas: os riscos claros dentro das colunas
    side = np.zeros_like(m)
    side[6:36, :42] = True
    side[6:36, W - 42:] = True
    # coluna = faixa de 3 px junto da borda de fora; o resto (os riscos) é o vidro lateral
    dist = cv2.distanceTransform((a[..., 3] > 0).astype(np.uint8), cv2.DIST_L1, 3)
    side[27:] = False
    pillar_glass = side & m & (dist > 3.5)
    a[pillar_glass, :3] = (96, 112, 130)
    m &= ~pillar_glass
    # o vidro lateral inteiro (entre a coluna e o para-brisa) liso, sem os riscos
    K4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)
    inner = cv2.erode((a[..., 3] > 0).astype(np.uint8), K4, iterations=2) > 0
    glass_side = (side | pillar_glass) & ~m & inner & ~cowl & (np.abs(a[..., 2].astype(int) - a[..., 0].astype(int)) < 60)
    gy = np.clip((np.arange(H)[:, None] - 6) / 30, 0, 1)
    gcol = (np.array([150, 166, 184]) * (1 - gy[..., None]) + np.array([84, 98, 116]) * gy[..., None])
    a[glass_side, :3] = gcol[np.broadcast_to(np.arange(H)[:, None], (H, W))[glass_side], 0].astype(np.uint8)
    # 3) lataria lisa: mediana da luminância (fora da máscara preenchido pelo vizinho) e 5 tons
    src = lum.copy()
    known = m.astype(np.uint8)
    _, lab = cv2.distanceTransformWithLabels(1 - known, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(known)
    idx = np.zeros(lab.max() + 1, int)
    idx[lab[ys, xs]] = ys * W + xs
    filled = src.ravel()[idx[lab]].reshape(H, W)
    sm = cv2.medianBlur(filled.astype(np.uint8), 5)
    sm = cv2.medianBlur(sm, 3).astype(float)
    lv = np.percentile(sm[m], [8, 30, 55, 78, 94])
    tone = lv[np.abs(sm[..., None] - lv[None, None, :]).argmin(axis=2)]
    new = np.where(m, tone, lum)
    # linhas horizontais longas da arte (borda do capô, frisos do para-choque) ficam
    dark = m & (lum < sm - 6)
    for y in range(H):
        row = np.nonzero(m[y])[0]
        if len(row) < 20:
            continue
        run = dark[y, row.min():row.max() + 1]
        if run.mean() > 0.45:
            new[y, row.min():row.max() + 1][run] = lum[y, row.min():row.max() + 1][run]
    # vincos do capô: linha contínua no pixel mais escuro perto de x=20 e x=141 (linhas 36-58)
    # (a arte tem o vinco em zigue-zague: ajusta uma reta pelos pontos mais escuros e traça)
    for cx in (20, W - 21):
        pts = []
        for y in range(36, 59):
            xs_ = np.arange(cx - 2, cx + 3)
            if m[y, xs_].any():
                pts.append((y, xs_[np.argmin(np.where(m[y, xs_], lum[y, xs_], 999))]))
        if len(pts) < 5:
            continue
        py, px = np.array(pts).T
        k, b = np.polyfit(py, px, 1)
        for y in range(36, 59):
            x = int(round(k * y + b))
            if m[y, x]:
                new[y, x] = lv[0] * 0.6
                if m[y, x + 1]:
                    new[y, x + 1] = lv[-1] if cx < W / 2 else new[y, x + 1]  # brilho do lado de dentro
    g = np.clip(new, 0, 255).astype(np.uint8)
    for k in range(3):
        a[m, k] = g[m]
    Image.fromarray(a, 'RGBA').save(fp)
    Image.fromarray((m * 255).astype(np.uint8)).convert('1').save(fm)
    print('frente do Vectra limpa; máscara', int(m.sum()))


if __name__ == '__main__':
    main()
