"""Cabine do Serpe V10 (Dodge Viper RT/10) a partir das duas artes do Victor (com e sem volante).
- painel e teto da arte sem volante; volante recortado da arte com volante (aro, raios e miolo)
- vidro: o fundo claro ligado ao alto (para-brisa), o retrovisor interno (o jogo desenha o dele)
  e o espelho do retrovisor externo esquerdo (o jogo mostra nele a vista de trás)
- letreiro "DODGE VIPER RT/10 1994" do painel sai; a cobra do miolo vira o emblema da Serpe
  (brand_badges.py); os mostradores são desenhados pelo jogo por cima dos da arte (cockpit.ts)
Escala 0,30 (pixel 8:7), pivô do volante no centro da tela.

Uso: python3 tools/ref/viper_cockpit.py <pasta com cab-wheel.png e cab-nowheel.png> <src/assets/cockpit>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

S = 0.30
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV = (640.0, 495.0)
PIV_N = (128.0, 105.0)
WC = (650.0, 495.0)  # centro de verdade do aro na arte (10 px à direita do centro da tela): o jogo gira em volta dele
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 14, 240
RIM_OUT, RIM_IN = (336, 342), (268, 274)
# raios laterais, miolo e raio de baixo (coordenadas da arte)
HUB = [(352, 459), (470, 453), (560, 436), (720, 436), (810, 453), (930, 459), (930, 560), (820, 560),
       (705, 600), (700, 790), (606, 790), (603, 600), (460, 560), (352, 560)]
MIRROR = (0, 160, 70, 320)
MIR_GAP = 30     # vidro que falta entre a borda da arte e a metade de fora (px da arte)
TEXT = (1440, 370, 1660, 470)  # letreiro da marca no painel
# mostradores grandes: centro, raio do fundo e o retângulo do texto que fica (MPH, RPM x1000)
BIG = [(462, 395, 89, (436, 436, 488, 456)), (747, 395, 88, (728, 428, 800, 462))]


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD):
    xs = PIV[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys):
    xi = np.clip(xs.astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def outer_half(xs, ys, dash, glass, shell, my_top, my_bot):
    """Metade de fora do retrovisor esquerdo, à esquerda da arte (xs < 0): primeiro MIR_GAP px de
    vidro (a coluna da borda da arte esticada), depois a borda da carcaça espelhada; embaixo, o
    canto de cima espelhado na vertical (a haste que desce para a porta só existe do lado de dentro)"""
    H, W = shell.shape
    yc = (my_top + my_bot - 1) / 2
    sx = np.where(xs >= -MIR_GAP, 0, -MIR_GAP - xs)
    left = (xs < 0) & (sx < 72)
    sy = np.where(ys > yc, 2 * yc - ys, ys)
    rows = (ys >= my_top) & (ys < my_bot)
    sxi = np.clip(sx.astype(int), 0, W - 1)
    syi = np.clip(sy.astype(int), 0, H - 1)
    sh = shell[syi][:, sxi] & rows[:, None] & left[None, :]
    rgbm = dash[syi][:, sxi]
    alm = ~glass[syi][:, sxi]
    # franja clara do recorte da arte (cinza solto por fora da carcaça) não entra
    ri = rgbm.astype(int)
    fringe = (ri.max(axis=2) - ri.min(axis=2) < 40) & (ri.mean(axis=2) > 110) & alm
    sh &= ~fringe
    return sh, rgbm, alm


def main():
    d, out = sys.argv[1], sys.argv[2]
    ww = np.array(Image.open(os.path.join(d, 'cab-wheel.png')).convert('RGB'))
    nw = np.array(Image.open(os.path.join(d, 'cab-nowheel.png')).convert('RGB'))
    H, W = nw.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    rgb = nw.astype(int)
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    # vidro: claro e sem cor, ligado ao alto da arte
    light = ((lum > 200) & (sat < 30)).astype(np.uint8)
    n, lab = cv2.connectedComponents(light, connectivity=4)
    seeds = set(np.unique(lab[0])) - {0}
    sky = np.isin(lab, list(seeds))
    sky = cv2.morphologyEx(sky.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool) & (yy < 300)
    sky[:115, 920:1200] = True  # retrovisor interno e haste
    # espelho do retrovisor externo esquerdo: azul dentro da carcaça vermelha
    x0, y0, x1, y1 = MIRROR
    blue = (rgb[..., 2] > rgb[..., 0] + 40) & (lum > 80)
    glass = np.zeros_like(sky)
    glass[y0:y1, x0:x1] = blue[y0:y1, x0:x1]
    glass = cv2.morphologyEx(glass.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)).astype(bool)
    sky |= glass
    # retrovisor externo esquerdo: fica como na arte, cortado na borda (outer_half não é usado)
    hr = (rgb[..., 0] > 90) & (rgb[..., 0] > rgb[..., 1] * 1.5) & (rgb[..., 0] > rgb[..., 2] * 1.5)
    col = np.nonzero(hr[140:340, 12] | glass[140:340, 12])[0] + 140
    # centro na vertical pelo vidro na borda da arte (assim o canto de baixo espelhado encosta certo)
    gr = np.nonzero(glass[140:340, 1])[0] + 140
    yc0 = (gr.min() + gr.max()) / 2
    half = max(yc0 - col.min(), 0) + 2
    my_top, my_bot = int(round(yc0 - half)), int(round(yc0 + half)) + 1
    shell = np.zeros_like(sky)
    shell[my_top:my_bot, 0:72] = True
    shell &= ~((rgb.mean(axis=2) > 200) & (sat < 30))  # o fundo claro da arte fica fora
    # mostradores: o jogo desenha marcações, números e ponteiros; da arte ficam o fundo creme,
    # o aro e os textos "MPH" e "RPM x1000". Os números da arte (com repetições) e os ponteiros
    # pintados saem: o miolo de cada mostrador grande é refeito a partir das bordas
    nw = nw.copy()
    for (cx, cy, rr, keep) in BIG:
        dd = np.hypot(xx - cx, yy - cy)
        ring = (dd < rr) & (dd > rr * 0.8)
        face = np.median(nw[ring & (rgb.min(axis=2) > 170)], axis=0)
        m = dd < rr
        kx0, ky0, kx1, ky1 = keep
        m &= ~((xx >= kx0) & (xx <= kx1) & (yy >= ky0) & (yy <= ky1))
        # fundo creme liso, um pouco mais escuro na borda de baixo (sombra do aro)
        shade = np.clip((yy - cy) / rr, 0, 1) * 10
        fill = np.clip(face[None, None, :] - shade[..., None], 0, 255).astype(np.uint8)
        nw[m] = fill[m]
    # ponteiros vermelhos dos quatro pequenos (o jogo desenha os dele): viram o creme em volta
    r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    redn = (r_ > 120) & (r_ > g_ * 1.7) & (r_ > b_ * 1.7) & (yy > 250) & (yy < 330) & (xx > 990) & (xx < 1410)
    redn = cv2.dilate(redn.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    redn &= (yy > 250) & (yy < 330)
    nw = cv2.inpaint(nw, redn.astype(np.uint8), 4, cv2.INPAINT_TELEA)
    # letreiro da marca: vira o painel em volta (cor de cada linha tirada à esquerda)
    tx0, ty0, tx1, ty1 = TEXT
    dash = nw.copy()
    for y in range(ty0, ty1):
        dash[y, tx0:tx1] = np.median(dash[y, tx0 - 30:tx0 - 6], axis=0).astype(np.uint8)

    y0d = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0d, ROWS)
    # à esquerda da arte (telas largas): roadster sem porta alta, então o alto fica aberto e a
    # porta continua repetindo uma coluna dela (longe do retrovisor)
    xr = np.where(xs < 0, -xs, np.clip(xs, 0, W - 1))  # reflete a porta para a esquerda
    d_rgb = sample(dash, xr, ys)
    d_al = ~sample(sky, xr, ys)
    d_al[:, xs < 0] &= (ys[:, None] > 330).repeat((xs < 0).sum(), 1)
    Image.fromarray(np.dstack([d_rgb, d_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'viper-dash.png'))
    xs, ys = grid(y0d - EXT * PXH, EXT)
    xr = np.where(xs < 0, -xs, np.clip(xs, 0, W - 1))
    t_rgb = sample(dash, xr, ys)
    t_al = ~sample(sky, xr, ys)
    t_al[:, xs < 0] = False
    Image.fromarray(np.dstack([t_rgb, t_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'viper-top.png'))

    # volante
    e_out = ((xx - WC[0]) / RIM_OUT[0]) ** 2 + ((yy - WC[1]) / RIM_OUT[1]) ** 2 <= 1
    e_in = ((xx - WC[0]) / RIM_IN[0]) ** 2 + ((yy - WC[1]) / RIM_IN[1]) ** 2 <= 1
    hub = np.zeros((H, W), np.uint8)
    cv2.fillPoly(hub, [np.array(HUB, np.int32)], 1)
    # dentro do polígono, só o que é do volante (escuro/cinza, sem o laranja dos bancos atrás)
    wr = ww.astype(int)
    orange = (wr[..., 0] > wr[..., 2] + 60) & (wr[..., 0] > 120)
    orange &= np.hypot(xx - 650, yy - 512) > 60  # a cobra vermelha do miolo é volante (vira o emblema)
    # aro pela borda de verdade, ângulo a ângulo: em cada raio, o trecho contínuo escuro do couro
    # (o painel atrás é mais claro e azulado, os bancos laranja, o vidro claro)
    lumw = cv2.medianBlur(wr.mean(axis=2).astype(np.uint8), 5).astype(float)
    dark = (lumw < 47)
    th = np.radians(np.arange(0, 360, 0.25))
    ss = np.linspace(0.70, 1.08, 380)
    s_in = np.zeros(len(th)); s_out = np.zeros(len(th))
    for i, t in enumerate(th):
        px_ = np.clip((WC[0] + np.cos(t) * RIM_OUT[0] * ss).astype(int), 0, W - 1)
        py_ = np.clip((WC[1] + np.sin(t) * RIM_OUT[1] * ss).astype(int), 0, H - 1)
        d = dark[py_, px_]
        k0 = int(np.argmin(np.abs(ss - 0.9)))
        if not d[k0]:
            near_ = np.nonzero(d)[0]
            k0 = near_[np.argmin(np.abs(near_ - k0))] if len(near_) else k0
        a_ = k0
        while a_ > 0 and d[a_ - 1]:
            a_ -= 1
        b_ = k0
        while b_ < len(ss) - 1 and d[b_ + 1]:
            b_ += 1
        s_in[i], s_out[i] = ss[a_], ss[b_]
    # limites: o aro tem a grossura conhecida (não deixa o painel escuro grudado esticar o trecho)
    s_in = np.clip(s_in, 0.79, 0.84)
    s_out = np.clip(s_out, 0.97, 1.02)
    def median_wrap(v, k):
        pad = np.concatenate([v[-k:], v, v[:k]])
        win = np.lib.stride_tricks.sliding_window_view(pad, 2 * k + 1)
        return np.median(win, axis=1)
    s_in = median_wrap(s_in, 15); s_out = median_wrap(s_out, 15)
    # o aro é uma elipse: ajusta uma elipse (inclinada) a cada borda, sem os desvios locais
    # (sombras, alavancas e o painel escuro encostados no aro); fica um tiquinho para dentro
    def fit(sv, k):
        pts = np.stack([WC[0] + np.cos(th) * RIM_OUT[0] * sv, WC[1] + np.sin(th) * RIM_OUT[1] * sv], 1).astype(np.float32)
        (ex, ey), (ea, eb), eang = cv2.fitEllipse(pts)
        m = np.zeros((H, W), np.uint8)
        cv2.ellipse(m, ((ex, ey), (ea * k, eb * k), eang), 1, -1)
        return m.astype(bool)
    outer = fit(s_out, 0.992)
    inner = fit(s_in, 1.012)
    rim = outer & ~inner
    sr = np.where(outer, 0.0, 2.0)
    idx = np.zeros((H, W), int)
    s_out = np.ones(len(th))
    orange |= (wr[..., 0] > wr[..., 2] + 25) & (wr[..., 0] > wr[..., 1] + 8) & (np.hypot(xx - 650, yy - 512) > 60)
    wheel = (rim & ~orange) | (hub.astype(bool) & (sr <= s_out[idx]) & ~orange)
    e_out = outer
    e_in = inner
    # o fundo creme dos mostradores que aparece acima dos raios não é volante
    wl = wr.mean(axis=2)
    creamy = (wl > 165) & ((wr.max(axis=2) - wr.min(axis=2)) < 45) & (yy < 450) & hub.astype(bool) & ((xx < 560) | (xx > 730))
    creamy = cv2.dilate(creamy.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    wheel &= ~(creamy & ~(e_out & ~e_in))
    wheel = cv2.morphologyEx(wheel.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    # pontas soltas acima dos raios (alavanca do pisca e o painel atrás): abre com um bloco maior
    # só na faixa do alto dos raios e fica com a peça maior
    band = (yy > 420) & (yy < 470) & ~(e_out & ~e_in) & ((xx < 550) | (xx > 730))
    opened = cv2.morphologyEx(wheel.astype(np.uint8), cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)).astype(bool)
    wheel = np.where(band, opened, wheel)
    n, lab, st, _ = cv2.connectedComponentsWithStats(wheel.astype(np.uint8), 8)
    if n > 1:
        wheel = lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    # tiras finas grudadas por pontes estreitas (fundo escuro do assoalho por fora do aro): corta as
    # pontes (erosão), fica com a peça grande e reconstrói só dentro dela
    core = cv2.erode(wheel.astype(np.uint8), np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(core, 4)
    if n > 1:
        rec = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
        for _ in range(6):
            rec = cv2.dilate(rec, np.ones((3, 3), np.uint8)) & wheel.astype(np.uint8)
        wheel = rec.astype(bool)
    wart = ww.copy()
    # cobra do miolo: disco escuro liso (o emblema da Serpe entra por brand_badges.py)
    hx, hy = 650, 512
    disc = ((xx - hx) / 46) ** 2 + ((yy - hy) / 46) ** 2 <= 1
    ring = (((xx - hx) / 54) ** 2 + ((yy - hy) / 54) ** 2 <= 1) & ~disc
    # vermelho da cobra que passa da capa do miolo também sai
    redx = (wr[..., 0] > 110) & (wr[..., 0] > wr[..., 1] * 1.6) & (np.hypot(xx - hx, yy - hy) < 60)
    disc = disc | (cv2.dilate(redx.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    wart[disc] = np.percentile(ww[ring], 35, axis=0).astype(np.uint8)
    xs, ys = grid(y0d - WTOP * PXH, WROWS, 0, 256)
    w_rgb = sample(wart, xs, ys)
    w_al = sample(wheel, xs, ys)
    Image.fromarray(np.dstack([w_rgb, w_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'viper-wheel.png'))
    hubn = (PIV_N[0] + (hx - PIV[0]) * S, (hy - (y0d - WTOP * PXH)) / PXH)
    mg = np.nonzero(glass)
    mn = (PAD + PIV_N[0] + (np.median(mg[1]) - PIV[0]) * S, EXT + (np.median(mg[0]) - y0d) / PXH)
    gauges = {'speed': (460, 397), 'tach': (748, 393), 'aux': [(1035, 293), (1145, 293), (1255, 293), (1365, 293)]}
    nat = lambda p: (round(PIV_N[0] + (p[0] - PIV[0]) * S, 1), round((p[1] - y0d) / PXH, 1))
    print('miolo', [round(v, 1) for v in hubn], 'espelho', [round(float(v), 1) for v in mn],
          'velocímetro', nat(gauges['speed']), 'conta-giros', nat(gauges['tach']), 'aux', [nat(p) for p in gauges['aux']])


if __name__ == '__main__':
    main()
