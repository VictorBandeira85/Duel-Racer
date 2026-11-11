"""Cabine do Ímola S/R (Monza S/R 1987) a partir das artes do Victor (mesmo enquadramento nas duas):
- painel da arte sem volante; o volante vem da arte com volante (aro pela geometria, miolo e os quatro
  raios por contorno)
- vidros por geometria medida na arte: para-brisa (da borda de dentro da coluna até a linha do alto do
  painel: o capô e as palhetas saem, o jogo desenha os dele), janela da porta (da borda de fora da
  coluna até a soleira) e o vidro do retrovisor (o jogo põe a vista de trás: glass em COCKPIT_ART)
- a arte corta o retrovisor na borda esquerda: a moldura direita refletida vira a esquerda (só o
  retrovisor); à esquerda da arte a porta é construída continuando cada linha na inclinação da
  soleira (nunca espelhada nem esticada) e a janela fica transparente
- a arte corta no alto: a coluna continua subindo e entra o forro do teto
- máscaras da lataria vermelha vista de dentro (retrovisor e friso da coluna) para a cor do carro
- o quadro é refeito por tools/ref/monza_gauges.py
Escala 0,27 (pixel 8:7), pivô do volante em (128, 112).
Uso: python3 tools/ref/monza_cockpit.py <pasta com cab.png e cab-nowheel.png> <src/assets/cockpit>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

S = 0.27
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV = (716.0, 561.0)            # centro do volante na arte sem volante (a com volante fica 1 px ao lado)
PIV_W = (715.0, 562.0)
PIV_N = (128.0, 112.0)
ROWS, EXT, PAD = 124, 76, 102
WTOP, WROWS = 8, 240
R_OUT, R_IN = 363, 319
HUB = [(552, 491), (900, 491), (915, 503), (919, 525), (864, 660), (850, 673), (602, 673), (588, 660), (533, 525), (537, 503)]
SPOKES = [
    [(380, 545), (540, 545), (560, 598), (380, 598)],
    [(1052, 545), (912, 545), (892, 598), (1052, 598)],
    [(572, 660), (662, 672), (662, 696), (529, 834), (474, 788)],
    [(880, 660), (790, 672), (790, 696), (923, 834), (978, 788)],
]
# borda de fora da coluna (lado da janela) e de dentro (lado do para-brisa): x em função de y
P_OUT = [(0, 118), (30, 130), (60, 143), (90, 154), (120, 165), (150, 178), (180, 188), (210, 200), (260, 200), (300, 195), (330, 192), (400, 190)]
P_IN = [(0, 309), (30, 303), (60, 306), (90, 313), (120, 318), (150, 325), (180, 330), (210, 337), (240, 344), (262, 352)]
LP, TP = 150, 60                # folga construída à esquerda e no alto (px da arte)
SILL = 0.40                     # quanto as linhas da porta descem a cada px indo para a borda esquerda
M_A, M_R, M_X0 = 112, 153, -50  # retrovisor: faixa refletida (da curva dos cantos até o filete da moldura, sem a lateral grossa da carcaça) e a borda nova


def interp(tab, y):
    ys, xs = zip(*tab)
    return np.interp(y, ys, xs)


def red_of(rgb):
    r, g, b = rgb[..., 0].astype(int), rgb[..., 1].astype(int), rgb[..., 2].astype(int)
    return (r > 120) & (g < r * 0.45) & (b < r * 0.5)


def red_mask(rgb, al):
    hsv = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    redh = (hue < 18) | (hue > 338)
    core = al & redh & (hsv[..., 1] > 110) & (hsv[..., 2] > 50)
    near = cv2.dilate(core.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    return core | (al & near & redh & (hsv[..., 1] > 40) & (hsv[..., 2] > 28))


def opaque(nw):
    """o que é carro (True) e o que é vidro (False), na arte sem volante"""
    H, W = nw.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    lum = nw.astype(int).mean(axis=2)
    red = red_of(nw)
    # linha do alto do painel: logo abaixo do capô vermelho (onde uma palheta o cobre, vale o vizinho)
    top = np.full(W, -1.0)
    for x in range(375, W):
        ys = np.nonzero(red[190:300, x])[0]
        if len(ys):
            top[x] = 190 + ys.max() + 1
    good = np.nonzero(top > 0)[0]
    top[375:] = np.interp(np.arange(375, W), good, top[good])
    t2 = top.copy()
    for x in range(375, W):  # máximo da vizinhança (as palhetas baixam a medida) e suavização
        t2[x] = top[max(375, x - 30):x + 31].max()
    k = np.ones(41) / 41
    t2[375:] = np.convolve(np.pad(t2[375:], 20, mode='edge'), k, mode='valid')
    t2[345:376] = np.linspace(262, t2[376], 31)
    al = np.ones((H, W), bool)
    xin = interp(P_IN, yy)
    al &= ~((xx > xin) & (yy < t2[np.clip(xx, 0, W - 1)]) & (xx >= 345))
    al &= ~((xx > xin) & (xx < 345) & (yy < 262))
    # restos coloridos da paisagem grudados na borda da coluna (até 10 px para dentro dela)
    rgb = nw.astype(int)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    al &= ~((xx > xin - 10) & (xx <= xin) & (yy < 262) & (sat > 55) & ~red & (lum > 60))
    # janela da porta: até a borda de fora da coluna e a soleira (primeiro preto descendo de y=396)
    sill = np.full(W, 396.0)
    for x in range(0, 200):
        dk = np.nonzero(lum[396:520, x] < 40)[0]
        sill[x] = 396 + (dk[0] if len(dk) else 0)
    xout = interp(P_OUT, yy)
    win = (xx < xout) & (yy < sill[np.clip(xx, 0, W - 1)])
    # retrovisor: a carcaça vermelha e o que ela cerca ficam; o vidro (dentro, longe da moldura) sai
    box = np.zeros((H, W), bool)
    box[196:396, 0:200] = True
    rm = red & box
    cl = cv2.morphologyEx(rm.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    pad = np.pad(cl, ((0, 0), (1, 0)), constant_values=1)  # a borda da arte fecha o contorno
    n, lab = cv2.connectedComponents((pad == 0).astype(np.uint8), connectivity=4)
    inside = (lab != lab[0, -1])[:, 1:] & box
    body = inside | (cl > 0)
    n, lab, st, _ = cv2.connectedComponentsWithStats(body.astype(np.uint8), 8)
    body = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 200])  # sem restos soltos da paisagem
    inside &= body
    cl = (cl > 0) & body
    cl = cl.astype(np.uint8)
    body = cv2.dilate(body.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0  # contorno preto de fora
    body &= box & (lum < 60) | inside | (cl > 0)
    far = inside & ~(cv2.dilate(cl, np.ones((15, 15), np.uint8)) > 0)
    n, lab = cv2.connectedComponents((inside & ~(cl > 0) & (lum > 45) | far).astype(np.uint8), connectivity=4)
    glass = lab == lab[300, 70]
    glass = cv2.morphologyEx(glass.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
    al &= ~(win & ~body)
    al &= ~(box & (yy < 214) & (nw[..., 0] > 180) & (nw[..., 1] > 80) & (nw[..., 2] < 100))  # tufo alaranjado da paisagem em cima da moldura
    for _ in range(2):  # pontinhos soltos da paisagem grudados no alto da moldura
        cnt = cv2.filter2D(al.astype(np.uint8), -1, np.ones((3, 3), np.float32), borderType=cv2.BORDER_REPLICATE)
        al &= ~((cnt < 5) & box & (yy < 222))
    al &= ~glass
    return al, body, glass


def extend(nw, al, body):
    """folga à esquerda (porta construída + moldura do retrovisor) e no alto (coluna subindo)"""
    H, W = nw.shape[:2]
    E = np.zeros((H + TP, W + LP, 3), np.uint8)
    A = np.zeros((H + TP, W + LP), bool)
    E[TP:, LP:], A[TP:, LP:] = nw, al
    ys = np.arange(H)
    base = nw[:, 0:3].astype(float).mean(axis=1)
    edge_ok = al[:, 0] & ~body[:, 0]
    for X in range(1, LP + 1):  # porta: cada linha segue a inclinação da soleira
        yb = np.round(ys - SILL * X).astype(int)
        ok = (yb >= 0)
        ybc = np.clip(yb, 0, H - 1)
        E[TP:, LP - X] = base[ybc].astype(np.uint8)
        A[TP:, LP - X] = ok & edge_ok[ybc]
    # retrovisor: o lado de lá (esquerdo) é refeito fino, como se vê de dentro: a curva dos cantos e o
    # filete da moldura direita refletidos (sem a lateral grossa da carcaça, que só aparece do lado
    # de cá); entre eles e a borda da arte, a moldura de cima, o vidro e a de baixo continuam. O
    # retrovisor está em perspectiva (o alto desce para a esquerda): cada coluna nova é encolhida na
    # vertical, presa embaixo, seguindo essa inclinação
    rows = slice(TP + 198, TP + 396)
    bot = 392
    first = lambda x: 198 + int(np.argmax(al[198:260, x]))
    slope = (first(4) - first(M_A)) / (M_A - 4.0)   # quanto o alto desce por px indo para a esquerda
    yd = np.arange(198, 396)

    def put(tx, sx):
        t_src, t_dst = first(sx), first(4) + slope * (4 - tx)
        ysrc = np.round(bot - (bot - yd) * (bot - t_src) / (bot - t_dst)).astype(int)
        ok = ysrc >= 198
        ysrc = np.clip(ysrc, 198, 395)
        E[rows, LP + tx] = nw[ysrc, sx]
        A[rows, LP + tx] = al[ysrc, sx] & ok

    w = M_R - M_A
    for x in range(M_A, M_R + 1):
        put(M_X0 + (M_R - x), x)
    n = 4 - (M_X0 + w + 1)
    for i, tx in enumerate(range(M_X0 + w + 1, 4)):  # a moldura engrossa aos poucos até a curva do canto
        put(tx, int(round(M_A - 1 - (M_A - 5) * i / max(1, n - 1))))
    # cantos de fora arredondados e contorno escuro em volta do lado novo
    x0, x1 = LP + M_X0, LP + 4
    reg = A[TP + 190:TP + 400, x0 - 6:x1].copy()
    pad = np.pad(reg, 1, constant_values=False)
    nlab, lab = cv2.connectedComponents((~pad).astype(np.uint8), connectivity=4)
    solid = (lab != lab[0, 0])[1:-1, 1:-1] | reg  # com o vidro tampado
    ys_, xs_ = np.nonzero(solid[:, 6:8])
    ytop, ybot, R = ys_.min(), ys_.max(), 11
    yy, xx = np.mgrid[0:solid.shape[0], 0:solid.shape[1]]
    for cy in (ytop + R, ybot - R):
        out_c = (xx < 6 + R) & ((yy < cy) if cy == ytop + R else (yy > cy)) & (np.hypot(xx - (6 + R), yy - cy) > R)
        solid &= ~out_c
        reg &= ~out_c
    line = (cv2.dilate(solid.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0) & ~solid
    line[:, -3:] = False
    A[TP + 190:TP + 400, x0 - 6:x1] = reg | line
    blk = E[TP + 190:TP + 400, x0 - 6:x1]
    blk[line] = (14, 12, 14)
    E[TP + 190:TP + 400, x0 - 6:x1] = blk
    # alto: a coluna continua subindo (0,3 px para a esquerda por px)
    for Y in range(1, TP + 1):
        sh = int(round(0.3 * Y))
        E[TP - Y, :E.shape[1] - sh] = E[TP, sh:]
        A[TP - Y, :A.shape[1] - sh] = A[TP, sh:]
    return E, A


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD, piv=PIV):
    xs = piv[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys, ox=0, oy=0):
    xi = np.clip((xs + ox).astype(int), 0, img.shape[1] - 1)
    yi = np.clip((ys + oy).astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def main():
    d, out = sys.argv[1], sys.argv[2]
    nw = np.array(Image.open(os.path.join(d, 'cab-nowheel.png')).convert('RGB'))
    ww = np.array(Image.open(os.path.join(d, 'cab.png')).convert('RGB'))
    al, body, glass = opaque(nw)
    E, A = extend(nw, al, body)
    if os.environ.get('DBG'):
        v = E.copy()
        v[~A] = (0, 255, 0)
        Image.fromarray(v).save(os.path.join(os.environ['DBG'], 'cab-alpha.png'))
    y0d = PIV[1] - PIV_N[1] * PXH
    xs, ys = grid(y0d, ROWS)
    d_rgb, d_al = sample(E, xs, ys, LP, TP), sample(A, xs, ys, LP, TP)
    xs, yt = grid(y0d - EXT * PXH, EXT)
    t_rgb, t_al = sample(E, xs, yt, LP, TP), sample(A, xs, yt, LP, TP)
    # forro do teto no alto (a arte não mostra): cinza do painel, mais escuro em cima, e a borracha
    roof = np.nonzero(yt < -8)[0]
    y1 = roof.max()
    for k, r in enumerate(range(0, y1 + 1)):
        t = k / max(1, y1)
        t_rgb[r, :] = (np.array([30, 30, 34]) * (1 - t) + np.array([62, 62, 70]) * t).astype(np.uint8)
        t_al[r, :] = True
    for c in range(0, t_al.shape[1], 3):  # textura do forro
        t_rgb[1:y1 - 1:4, c] = (46, 46, 52)
    t_rgb[y1 + 1:y1 + 3, :] = (14, 14, 16)
    t_al[y1 + 1:y1 + 3, :] = True
    # máscara de pintura: só o retrovisor e o friso da coluna (o tecido da porta tem vermelho e não é lataria)
    lim = int(PAD + PIV_N[0] + (345 - PIV[0]) * S)
    dm = red_mask(d_rgb, d_al)
    dm[:, lim:] = False
    dm[int((402 - y0d) / PXH):] = False
    tm = red_mask(t_rgb, t_al)
    tm[:, lim:] = False
    for name, rgb, a_, m in (('dash', d_rgb, d_al, dm), ('top', t_rgb, t_al, tm)):
        Image.fromarray(np.dstack([rgb, a_.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'br-monza-{name}.png'), optimize=True)
        Image.fromarray((m * 255).astype(np.uint8), 'L').save(os.path.join(out, f'br-monza-{name}-mask.png'), optimize=True)
    # volante (arte com volante)
    Hh, Wh = ww.shape[:2]
    y4, x4 = np.mgrid[0:Hh, 0:Wh]
    rr = np.hypot(x4 - PIV_W[0], y4 - PIV_W[1])
    poly = np.zeros((Hh, Wh), np.uint8)
    cv2.fillPoly(poly, [np.array(HUB, np.int32)], 1)
    for sp in SPOKES:
        cv2.fillPoly(poly, [np.array(sp, np.int32)], 1)
    wheel = ((rr <= R_OUT) & (rr >= R_IN)) | (poly.astype(bool) & (rr <= R_OUT))
    xs, ys = grid(y0d - WTOP * PXH + (PIV_W[1] - PIV[1]), WROWS, 0, 256, PIV_W)
    w_rgb, w_al = sample(ww, xs, ys), sample(wheel, xs, ys) & (ys < Hh)[:, None]
    Image.fromarray(np.dstack([w_rgb, w_al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'br-monza-wheel.png'), optimize=True)
    nat = lambda p: (round(PIV_N[0] + (p[0] - PIV[0]) * S, 1), round((p[1] - y0d) / PXH, 1))
    print('y0d', round(y0d, 1), 'quadro', nat((483, 320)), nat((1006, 482)), 'vidro do retrovisor (empilhado, com PAD)',
          (round(PAD + nat((70, 300))[0]), round(EXT + nat((70, 300))[1])))


if __name__ == '__main__':
    main()
