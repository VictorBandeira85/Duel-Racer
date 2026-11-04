"""Cabine do Kaze NX (Honda NSX, mão inglesa) a partir da arte do Victor com volante (cab2.png).
- vidro: o para-brisa (acima da faixa vermelha do capô, coluna a coluna), o retrovisor interno
  (o jogo desenha o dele) e a janela lateral (paisagem ligada ao alto, à direita da coluna)
- o espelho do retrovisor externo direito fica transparente: o jogo mostra nele a vista de trás
- volante recortado pela forma (aro, miolo, raios e o raio de baixo); o painel embaixo dele é
  reconstruído (preenchimento a partir das bordas), o H do miolo sai (entra o emblema da Kaze)
- quadro de instrumentos repintado (painel cinza escovado); os seis mostradores são do jogo
- o nome da marca no rádio sai
Escala 0,37 (pixel 8:7), pivô do volante no centro da tela.

Uso: python3 tools/ref/nx_cockpit2.py <cab2.png> <src/assets/cockpit> [cab2-nowheel.png]
(com a arte sem volante, o painel e o teto saem dela; sem ela, o painel é reconstruído)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

S = 0.37
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV = (1040.0, 495.0)
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 14, 240
RIM_OUT, RIM_IN = (270, 279), (229, 240)
# miolo + raios laterais + raio de baixo (coordenadas da arte)
HUB = [(810, 425), (910, 412), (1040, 405), (1170, 412), (1270, 425), (1272, 535), (1190, 590),
       (1125, 655), (1112, 770), (968, 770), (955, 655), (890, 590), (808, 535)]
MIRROR = (1522, 166, 1672, 312)  # caixa do espelho do retrovisor externo


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD):
    xs = PIV[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys):
    xi = np.clip(xs.astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def grade(rgb):
    """tira o tom roxo-azulado da arte: cinzas e pretos do painel, volante e porta viram grafite
    neutro (um nadinha quente, como couro e plástico preto de verdade); vermelhos, o bege dos
    bancos e o visor do rádio ficam como estão"""
    a = rgb.astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx_, mn_ = a.max(axis=2), a.min(axis=2)
    sat = (mx_ - mn_) / np.maximum(mx_, 1)
    bluish = (b >= r - 6) & (b > g + 4) & (sat < 0.55)
    lum = 0.3 * r + 0.55 * g + 0.15 * b
    k = np.where(bluish, 0.12, 1.0)[..., None]
    out = lum[..., None] + (a - lum[..., None]) * k
    out += np.where(bluish, 1, 0)[..., None] * np.array([3, 1.5, -2], np.float32)
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    src, out = sys.argv[1], sys.argv[2]
    nowheel = sys.argv[3] if len(sys.argv) > 3 else None
    wart0 = np.array(Image.open(src).convert('RGB'))
    art = np.array(Image.open(nowheel).convert('RGB')) if nowheel else wart0
    H, W = art.shape[:2]
    rgb = art.astype(int)
    r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    red = (r_ > 150) & (g_ < 90) & (b_ < 100)
    # vermelho da lataria incluindo a sombra escura (carcaça do retrovisor)
    redish = (r_ > 70) & (r_ > g_ * 1.8) & (r_ > b_ * 1.5)
    yy, xx = np.mgrid[0:H, 0:W]

    # --- vidro ---
    # para-brisa: acima da faixa vermelha do capô (procurada coluna a coluna; atrás do aro do
    # volante, onde ela some, a linha é interpolada)
    top = np.full(W, -1)
    for x in (range(0, 1330) if nowheel else list(range(0, 762)) + list(range(1316, 1330))):  # fora do aro (dentro dele há ponteiros vermelhos)
        k = np.nonzero(red[180:300, x])[0]
        if len(k):
            top[x] = 180 + k[0]
    ok = top >= 0
    top = np.interp(np.arange(W), np.nonzero(ok)[0], top[ok]).astype(int)
    top = np.array([int(np.median(top[max(0, x - 5):x + 6])) for x in range(W)])
    sky = (yy < top[None, :]) & (xx < 1330)
    # janela lateral: paisagem ligada ao alto, à direita (a coluna, o painel e a carcaça vermelha
    # do retrovisor são escuros/vermelhos e param o preenchimento)
    # coluna, painel e porta são cinza-arroxeados (vermelho ~ verde, azul por cima, até o brilho
    # lilás); paisagem é verde, azul-céu (verde > vermelho) ou branca. À direita do para-brisa,
    # acima da linha da porta, o que não é peça vira vidro (sem pontinhos soltos)
    solid = ((lum < 200) & (sat < 95) & (b_ >= g_ - 4) & (r_ >= g_ - 10)) | redish | ((lum < 30) & (b_ >= g_))
    # folhagem (verde) e mureta (branco-azulado) nunca são peça do carro
    # (a coluna lilás tem verde abaixo do vermelho; folhas e céu/mureta têm verde acima)
    scen = (g_ > r_ + 10) | ((b_ > r_ + 12) & (g_ >= r_) & (lum > 120))
    solid &= ~scen
    win = (~solid & (xx >= 1180) & (yy < 330) & (yy < top[None, :] + 40 + (xx - 1180) * 0)).astype(np.uint8)
    # folhas escuras soltas no meio da paisagem: ilhas pequenas de "peça" viram paisagem
    isl = ((1 - win) * ((xx >= 1180) & (yy < 330))).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(isl, connectivity=8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 400:
            win[lab == i] = 1
    win = cv2.morphologyEx(win, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(win, connectivity=4)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 40:
            sky |= lab == i
    # retrovisor interno (no alto do para-brisa): também vidro
    sky[:130, 400:760] = True
    # espelho do retrovisor externo: transparente dentro da carcaça (o jogo desenha a vista)
    x0, y0, x1, y1 = MIRROR
    box = np.zeros_like(sky)
    box[y0:y1, x0:x1] = True
    glass = box & ~red & (lum > 40)
    gl = glass.astype(np.uint8)
    n, lab = cv2.connectedComponents(gl, connectivity=4)
    if n > 1:
        big = 1 + np.argmax([np.sum(lab == i) for i in range(1, n)])
        glass = lab == big
    sky |= glass

    # --- volante ---
    e_out = ((xx - PIV[0]) / RIM_OUT[0]) ** 2 + ((yy - PIV[1]) / RIM_OUT[1]) ** 2 <= 1
    e_in = ((xx - PIV[0]) / RIM_IN[0]) ** 2 + ((yy - PIV[1]) / RIM_IN[1]) ** 2 <= 1
    hub = np.zeros((H, W), np.uint8)
    cv2.fillPoly(hub, [np.array(HUB, np.int32)], 1)
    wheel = (e_out & ~e_in) | (hub.astype(bool) & e_out)
    wart = wart0.copy()
    # o H do miolo: placa lisa da cor do miolo em volta
    hx, hy = 1043, 490
    hmask = ((xx - hx) / 44) ** 2 + ((yy - hy) / 40) ** 2 <= 1
    ring = (((xx - hx) / 60) ** 2 + ((yy - hy) / 54) ** 2 <= 1) & ~hmask
    wart[hmask] = np.percentile(wart0[ring], 40, axis=0).astype(np.uint8)

    # --- painel sem o volante: preenchido a partir das bordas ---
    dash = art.copy()
    m = cv2.dilate(wheel.astype(np.uint8), np.ones((5, 5), np.uint8)) * (0 if nowheel else 1)
    small = cv2.resize(dash, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    ms = cv2.resize(m, (W // 2, H // 2), interpolation=cv2.INTER_NEAREST)
    fill = cv2.inpaint(small, ms, 6, cv2.INPAINT_TELEA)
    fill = cv2.resize(fill, (W, H), interpolation=cv2.INTER_NEAREST)
    dash[m > 0] = fill[m > 0]
    # atrás do aro: a faixa vermelha do capô e a borda do painel continuam (copiadas de uma
    # coluna ao lado do aro, na mesma altura relativa à linha do capô)
    ref = 752
    for x in (range(762, 1316) if not nowheel else []):
        for k in range(0, 14):
            dash[top[x] + k, x] = dash[top[ref] + k, ref]
    # nome da marca no rádio
    dash[528:546, 540:665] = np.median(dash[548:556, 540:665].reshape(-1, 3), axis=0).astype(np.uint8)

    y0 = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0, ROWS)
    xr = np.clip(xs, 0, W - 1)
    d_rgb = sample(dash, xr, ys)
    d_al = ~sample(sky, xr, ys)
    # quadro de instrumentos repintado (cinza escovado, borda escura), como o do carro
    gy, gx = np.mgrid[0:ROWS, 0:256 + 2 * PAD]
    nx = gx - PAD + 0.5
    ny = gy + 0.5
    # contorno curvo como o do carro: o fundo abraça os mostradores (envoltória convexa dos seis,
    # com folga), sem cantos retos; as pontas fazem a curva em volta dos pequenos de fora
    dials = [(100, 50, 22), (157, 50, 22), (71, 40, 7), (62, 64, 8), (186, 40, 7), (195, 64, 8)] if nowheel else []
    def hull_mask(pad):
        pts = []
        for dx_, dy_, rr in dials:
            for t in np.linspace(0, 2 * np.pi, 48, endpoint=False):
                pts.append((PAD + dx_ + 0.5 + np.cos(t) * (rr + pad), dy_ + 0.5 + np.sin(t) * (rr + pad) * 8 / 7))
        m_ = np.zeros((ROWS * 4, (256 + 2 * PAD) * 4), np.float32)
        hull = cv2.convexHull(np.array(pts, np.float32) * 4).astype(np.int32)
        cv2.fillPoly(m_, [hull], 1)
        return cv2.resize(m_, (256 + 2 * PAD, ROWS), interpolation=cv2.INTER_AREA) >= 0.5
    if dials:
        face = hull_mask(3.5)
        rim = hull_mask(5).astype(bool) & ~face
    else:
        def inside(a, b, c, d, rr):
            qx = np.clip(nx, a + rr, b - rr)
            qy = np.clip(ny, c + rr, d - rr)
            return np.hypot(nx - qx, (ny - qy) * 0.875) <= rr
        cx0, cx1, cy0, cy1 = 52, 204, 14, 78
        face = inside(cx0, cx1, cy0, cy1, 9)
        rim = inside(cx0 - 2, cx1 + 2, cy0 - 2, cy1 + 2, 11) & ~face
    cy0, cy1 = 18, 84
    # alumínio escovado (riscos horizontais finos), mais escuro no alto, na sombra da cobertura
    rng_ = np.random.default_rng(7)
    rowv = rng_.integers(-6, 7, size=ROWS)[:, None]
    streak = (rowv + ((gx * 5 + gy * 11) % 7) // 3 - 1).astype(int)
    base = np.stack([136 + streak, 138 + streak, 144 + streak], axis=-1)
    shade = (-46 * np.clip(1 - (ny - cy0) / 16, 0, 1) - 14 * np.clip((ny - (cy1 - 10)) / 10, 0, 1))[..., None]
    d_rgb[face] = np.clip(base + shade, 0, 255).astype(np.uint8)[face]
    d_rgb[rim] = (14, 14, 17)
    d_al[face | rim] = True
    d_rgb = grade(d_rgb)
    Image.fromarray(np.dstack([d_rgb, d_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'nsx-dash.png'))
    # teto: coluna, retrovisor externo e a borda de cima
    xs, ys = grid(y0 - EXT * PXH, EXT)
    xr = np.clip(xs, 0, W - 1)
    t_rgb = sample(dash, xr, ys)
    t_al = ~sample(sky, xr, ys)
    t_al[ys[:, None].repeat(len(xs), 1) < 0] = False
    t_rgb = grade(t_rgb)
    Image.fromarray(np.dstack([t_rgb, t_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'nsx-top.png'))
    # volante
    xs, ys = grid(y0 - WTOP * PXH, WROWS, 0, 256)
    w_rgb = sample(wart, xs, ys)
    w_al = sample(wheel, xs, ys)
    w_rgb = grade(w_rgb)
    Image.fromarray(np.dstack([w_rgb, w_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'nsx-wheel.png'))
    hubn = (PIV_N[0] + (hx - PIV[0]) * S, PIV_N[1] + (hy - PIV[1]) / PXH + WTOP)
    mir = np.nonzero(glass)
    mn = (PAD + PIV_N[0] + (np.median(mir[1]) - PIV[0]) * S, EXT + PIV_N[1] + (np.median(mir[0]) - PIV[1]) / PXH)
    print('miolo (volante)', [round(v, 1) for v in hubn], 'espelho (painel+teto)', [round(v, 1) for v in mn])


if __name__ == '__main__':
    main()
