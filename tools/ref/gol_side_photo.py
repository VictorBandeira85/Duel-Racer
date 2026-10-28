"""Lateral do Gaúcho GTI reconstruída a partir da foto de perfil do Gol GTI (fundo branco de
estúdio): recorte do carro, redução para a largura do sprite com paleta curta (sem pontilhado),
lataria vinho trocada pelo vermelho do jogo (com a máscara de pintura), vidros escuros viram o
vidro azulado das outras vistas (o interior aparece por trás), saia/para-choques prateados
viram o cinza escuro da frente e da traseira, os emblemas da marca nas rodas viram calota lisa
e a silhueta ganha contorno escuro.

Uso: python3 tools/ref/gol_side_photo.py <foto> <src/assets/cars> [largura]
ATENÇÃO: sprite derivado de foto de terceiros, só para o projeto privado.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

CROP = (15, 160, 1285, 612)                # x0, y0, x1, y1 na foto
WHEELS = [(270, 518), (1065, 518)]         # centros das rodas na foto
RIM = 64                                   # raio do aro (foto)
LOGO = 20                                  # raio do emblema no miolo
WINDOWS = [
    [(470, 300), (560, 226), (597, 203), (597, 302)],                       # quebra-vento
    [(597, 200), (762, 200), (762, 300), (597, 302)],                       # porta
    [(837, 198), (1030, 210), (1125, 275), (1120, 296), (840, 299)],        # traseiro
]
RED = np.array([206, 22, 20], float)       # vermelho da arte (meio-tom)
# rampas da arte desenhada (lateral original): vermelhos da lataria e azuis do vidro
REDS = [(86, 8, 8), (128, 12, 12), (164, 16, 14), (192, 20, 18), (214, 30, 24), (236, 64, 50), (250, 120, 100)]
GLASS = [(40, 46, 56), (70, 82, 98), (98, 114, 134), (126, 144, 164), (156, 174, 194), (184, 200, 216)]


# contorno do carro medido na foto (o branco do estúdio confunde vidros e saia prateada com o fundo)
OUTLINE = [(25, 420), (33, 365), (45, 352), (115, 330), (215, 316), (345, 301), (400, 293), (435, 285),
           (575, 182), (615, 170), (1015, 185), (1055, 196), (1165, 250), (1253, 257), (1253, 276),
           (1232, 292), (1236, 330), (1263, 358), (1263, 412), (1272, 430), (1273, 452), (1265, 488),
           (1175, 497), (1150, 505), (960, 510), (945, 522), (395, 522), (380, 510), (165, 503),
           (35, 497), (25, 480)]
TIRE = 92


def segment(img):
    h, w = img.shape[:2]
    fg = np.zeros((h, w), np.uint8)
    cv2.fillPoly(fg, [np.array(OUTLINE, np.int32) - [CROP[0], CROP[1]]], 1)
    for cx, cy in WHEELS:
        cv2.circle(fg, (cx - CROP[0], cy - CROP[1]), TIRE, 1, -1)
    fg[608 - CROP[1]:] = 0
    return fg


def main():
    src, out = sys.argv[1], sys.argv[2]
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 209
    full = cv2.cvtColor(cv2.imread(src), cv2.COLOR_BGR2RGB)
    x0, y0, x1, y1 = CROP
    img = full[y0:y1, x0:x1].copy()
    h, w = img.shape[:2]
    fg = segment(cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    yy, xx = np.mgrid[0:h, 0:w]
    X, Y = xx + x0, yy + y0
    f = img.astype(float)
    lum = f.mean(axis=2)
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV_FULL).astype(float)
    hue, sat = hsv[..., 0] * 360 / 256, hsv[..., 1]
    wheel = np.zeros((h, w), bool)
    for cx, cy in WHEELS:
        wheel |= (X - cx) ** 2 + (Y - cy) ** 2 <= TIRE ** 2
    win = np.zeros((h, w), np.uint8)
    for p in WINDOWS:
        cv2.fillPoly(win, [np.array(p, np.int32) - [x0, y0]], 1)
    win = win > 0
    # lataria vinho: matiz vermelho-arroxeado com alguma saturação, fora de vidro e rodas
    body = fg.astype(bool) & ~win & ~wheel & ((hue >= 300) | (hue <= 20)) & (sat > 40) & (lum > 18)
    # reflexos brancos do estúdio na lataria (sem cor): também são lataria, só mais claros
    paint_zone = fg.astype(bool) & ~win & ~wheel & (Y < 433) & (X > 40) & (X < 1240)
    body |= paint_zone & (lum > 45) & (sat <= 40)
    # molduras pretas das janelas e coluna B ficam pretas; lanterna fica com a cor da foto
    frames = (X > 462) & (X < 1140) & (Y > 196) & (Y < 306)
    tail = (X > 1226) & (X < 1266) & (Y > 356) & (Y < 414)
    body &= ~frames & ~tail
    # lanterna e pisca (vermelho vivo / âmbar) ficam como estão
    vivid = (sat > 150) & (lum > 70) & ((hue <= 20) | (hue >= 345))
    body &= ~(vivid & (X > 1200))
    out_rgb = f.copy()
    # vinho -> vermelho: a luminância da foto (normalizada pelo meio-tom da lataria) modula o vermelho
    ref = np.median(lum[body])
    # reflexos fortes da foto ficam suaves (brilho de lataria, não mancha branca)
    k = lum / ref
    k = np.where(k > 1, 1 + np.log1p(np.maximum(k - 1, 0)) * 0.5, k)
    red = np.where(k[..., None] < 1, RED * k[..., None] ** 0.9, RED + (255 - RED) * np.clip(k[..., None] - 1, 0, 1) * 0.5)
    out_rgb[body] = red[body]
    sm = cv2.bilateralFilter(out_rgb.astype(np.float32), 9, 40, 9)
    out_rgb[body] = sm[body]
    # vidros: o escuro da foto vira o vidro claro das outras vistas; o interior (mais escuro) aparece
    top, bot = 198, 302
    t = np.clip((Y - top) / (bot - top), 0, 1)[..., None]
    gl = np.array([176, 196, 216]) * (1 - t) + np.array([92, 112, 138]) * t
    shade = np.clip(lum / np.percentile(lum[win], 80), 0.25, 1.15)[..., None]
    g2 = gl * (0.5 + 0.5 * shade)
    out_rgb[win] = g2[win]
    # saia e para-choques prateados -> cinza escuro (como a frente e a traseira da arte)
    silver = fg.astype(bool) & ~wheel & ~win & (sat < 45) & (lum > 95) & (Y > 425)
    out_rgb[silver] = (f[silver] * 0.33 + 6)
    # emblema da marca no miolo das rodas: calota lisa prateada
    for cx, cy in WHEELS:
        d = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2)
        cap = d <= LOGO
        out_rgb[cap] = np.array([196, 198, 204]) - np.clip((Y[cap] - cy) / LOGO, -1, 1)[:, None] * 34
        out_rgb[(d > LOGO) & (d <= LOGO + 3)] = (88, 90, 96)
    # lanterna: vermelho vivo da foto, um pouco mais saturado
    out_rgb[tail] = np.clip((f[tail] - f[tail].mean(axis=1, keepdims=True)) * 1.4 + f[tail].mean(axis=1, keepdims=True), 0, 255)
    # reduz para a largura do sprite
    H = round(h * width / w)
    small = cv2.resize(out_rgb.astype(np.float32), (width, H), interpolation=cv2.INTER_AREA)
    a = cv2.resize(fg.astype(np.float32), (width, H), interpolation=cv2.INTER_AREA) >= 0.5
    bm = cv2.resize(body.astype(np.float32), (width, H), interpolation=cv2.INTER_AREA) >= 0.5
    small = np.clip(small, 0, 255).astype(np.uint8)
    q = np.array(Image.fromarray(small).quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB'))
    rgba = np.dstack([q, (a * 255).astype(np.uint8)])
    # lataria e vidros na paleta da arte (rampas de vermelho e de vidro): nítido como pixel art
    wm = cv2.resize(win.astype(np.float32), (width, H), interpolation=cv2.INTER_AREA) >= 0.5
    sl = small.astype(float).mean(axis=2)
    # lataria: reflexos do estúdio viram faixas; mediana larga e escala apertada (lataria lisa)
    slb = cv2.medianBlur(np.clip(sl, 0, 255).astype(np.uint8), 5).astype(float)
    for m, ramp, src_l, (p0, p1) in ((bm, REDS[1:6], slb, (8, 96)), (wm & a, GLASS, sl, (3, 97))):
        sl_ = src_l
        lv = np.array(ramp, float).mean(axis=1)
        lo, hi = np.percentile(sl_[m], p0), np.percentile(sl_[m], p1)
        tgt = lv.min() + np.clip((sl_ - lo) / max(1, hi - lo), 0, 1) * (lv.max() - lv.min())
        idx = np.abs(tgt[..., None] - lv[None, None, :]).argmin(axis=2)
        rgba[m, :3] = np.array(ramp, np.uint8)[idx[m]]
    # vincos e frisos escuros da foto (portas, para-lamas) continuam escuros por cima
    seam = bm & (sl < np.percentile(sl[bm], 4))
    rgba[seam, :3] = REDS[0]
    # farol e pisca na ponta da frente (a foto quase não mostra a lente)
    fx = lambda X: int(round((X - CROP[0]) * width / w))
    fy = lambda Y: int(round((Y - CROP[1]) * H / h))
    rgba[fy(368):fy(408), fx(26):fx(36), :3] = (236, 232, 214)
    rgba[fy(368):fy(372), fx(26):fx(36), :3] = (255, 255, 250)
    rgba[fy(368):fy(408), fx(36):fx(46), :3] = (240, 150, 30)
    rgba[fy(368):fy(408), fx(46), :3] = (20, 18, 16)
    # contorno escuro na borda da silhueta
    K4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)
    edge = a & (cv2.erode(a.astype(np.uint8), K4) == 0)
    rgba[edge, :3] = (rgba[edge, :3] * 0.3 + np.array([14, 14, 16]) * 0.7).astype(np.uint8)
    bm &= cv2.erode(a.astype(np.uint8), K4) > 0
    Image.fromarray(rgba, 'RGBA').save(os.path.join(out, 'br-golgti-side.png'))
    Image.fromarray((bm * 255).astype(np.uint8)).convert('1').save(os.path.join(out, 'br-golgti-side-mask.png'))
    print('lateral', width, H, 'máscara', int(bm.sum()))


if __name__ == '__main__':
    main()
