"""Redução das cabines com cara de 16 bits (como os sprites, monza_sprites.shrink): em vez de pegar UM pixel da
arte em cada ponto do jogo (chuvisco e bordas serrilhadas), cada ponto recebe a cor do MIOLO do bloco (mediana
numa janela do tamanho do bloco) e depois a imagem passa por paleta curta (k-médias em Lab).
  core(img, pxw)          -> a arte com a mediana do bloco em cada pixel (amostrar dela no lugar da arte)
  palette(rgba, n=96)     -> paleta curta só nos pixels opacos
"""
import cv2
import numpy as np


def core(img, pxw):
    k = max(3, int(round(pxw * 0.75)) | 1)
    return cv2.medianBlur(np.ascontiguousarray(img), k)


def palette(rgba, n=96):
    al = rgba[..., 3] > 0
    if al.sum() <= n:
        return rgba
    lab = cv2.cvtColor(np.ascontiguousarray(rgba[..., :3]), cv2.COLOR_RGB2LAB).astype(np.float32)
    cv2.setRNGSeed(7)
    _, lbl, cen = cv2.kmeans(lab[al], n, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.3), 2, cv2.KMEANS_PP_CENTERS)
    q = lab.copy()
    q[al] = cen[lbl.ravel()]
    out = rgba.copy()
    out[..., :3][al] = cv2.cvtColor(np.clip(q, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)[al]
    return out
