"""Cabine do Kaze NX (Honda NSX) a partir das duas artes do Victor (com e sem volante).
A arte veio com volante à direita e quase nada desenhado à direita dele: é espelhada (volante à
esquerda, como nas outras cabines) e os textos voltam a ficar legíveis (rádio, botões e SRS do
volante, desvirados no lugar). O para-brisa (paisagem acima da borda do painel) vira vidro.
O quadro de instrumentos é repintado como o do carro (painel cinza escovado); os seis mostradores
são desenhados pelo jogo (cockpit.ts): água e pressão do óleo à esquerda, conta-giros, velocímetro,
combustível e bateria à direita. Escala 0,307 (pixel 8:7).

Uso: python3 tools/ref/nsx_cockpit.py <pasta com cab-nowheel.png e cab-wheel.png> <src/assets/cockpit>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

S = 0.307
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
W0 = 1459
PIV = (W0 - 1 - 1031.0, 600.0)  # centro do aro (já espelhado)
PIV_N = (128.0, 140.0)
ROWS, EXT, PAD = 124, 76, 102
WROWS = 170
RIM_OUT, RIM_IN = (345, 376), (311, 340)


def mx(x):  # coordenada x da arte original -> espelhada
    return W0 - 1 - x


def grid(y0, rows, x0n=-PAD, cols=256 + 2 * PAD):
    xs = PIV[0] + (np.arange(cols) + x0n + 0.5 - PIV_N[0]) * PXW
    ys = y0 + (np.arange(rows) + 0.5) * PXH
    return xs, ys


def sample(img, xs, ys):
    xi = np.clip(xs.astype(int), 0, img.shape[1] - 1)
    yi = np.clip(ys.astype(int), 0, img.shape[0] - 1)
    return img[yi][:, xi]


def unflip(img, x0, y0, x1, y1):
    """desvira (no lugar) um retângulo dado em coordenadas da arte original"""
    a, b = mx(x1), mx(x0)
    img[y0:y1, a:b + 1] = img[y0:y1, a:b + 1][:, ::-1].copy()


def main():
    d, out = sys.argv[1], sys.argv[2]
    nw = np.array(Image.open(os.path.join(d, 'cab-nowheel.png')).convert('RGB'))[:, :W0][:, ::-1].copy()
    ww = np.array(Image.open(os.path.join(d, 'cab-wheel.png')).convert('RGB'))[:, :W0][:, ::-1].copy()
    H, W = nw.shape[:2]
    # textos que ficaram ao contrário: rádio (o nome da marca some) e, no volante, SRS e botões
    for img in (nw, ww):
        unflip(img, 360, 495, 640, 700)
    ww_unflip = [(985, 670, 1062, 705), (1125, 610, 1250, 715)]
    for r in ww_unflip:
        unflip(ww, *r)
    # "HONDA" do rádio: faixa escura lisa
    for img in (nw, ww):
        x0, x1 = mx(560), mx(470)
        img[530:556, x0:x1] = np.median(img[530:556, x0 - 6:x0 - 2].reshape(-1, 3), axis=0).astype(np.uint8)
    # borda de cima do painel: contorno escuro perto da linha medida na arte (quase reta à
    # esquerda, descendo no canto da porta), procurado coluna a coluna numa faixa estreita
    lum = nw.astype(int).mean(axis=2)
    ox_ = [0, 700, 1050, 1250, W0 - 1]
    oy_ = [197, 199, 203, 225, 262]
    guess = np.interp(mx(np.arange(W)), ox_, oy_)
    top = np.zeros(W, int)
    for x in range(W):
        g = int(guess[x])
        col = lum[g - 12:g + 12, x]
        k = np.nonzero(col < 50)[0]
        top[x] = g - 12 + k[0] if len(k) else g
    top = np.array([int(np.median(top[max(0, x - 4):x + 5])) for x in range(W)])
    yy, xx = np.mgrid[0:H, 0:W]
    sky = yy < top[None, :] + 2
    # perto da borda, o que for paisagem (verde, azul claro, branco da mureta) também é vidro
    rgbi = nw.astype(int)
    scen = ((rgbi[..., 1] > rgbi[..., 0] + 25) | (rgbi[..., 2] > 150) | (rgbi.min(axis=2) > 170)) & (yy < top[None, :] + 14)
    sky |= scen
    y0 = PIV[1] - PIV_N[1] * PXH
    # painel
    xs, ys = grid(y0, ROWS)
    rgb = sample(nw, xs, ys)
    al = ~sample(sky, xs, ys)
    # fora da arte (telas largas): repete a coluna da borda (o painel continua liso)
    xr = np.clip(xs, 0, W - 1)
    rgb = sample(nw, xr, ys)
    al = ~sample(sky, xr, ys)
    # quadro de instrumentos repintado: painel cinza escovado com borda escura (como o do carro)
    gy, gx = np.mgrid[0:ROWS, 0:256 + 2 * PAD]
    nx = gx - PAD + 0.5
    ny = gy + 0.5
    cx0, cx1, cy0, cy1, rr = 55, 203, 36, 104, 9
    def inside(x0, x1, y0_, y1_, r):
        qx = np.clip(nx, x0 + r, x1 - r)
        qy = np.clip(ny, y0_ + r, y1_ - r)
        return np.hypot(nx - qx, (ny - qy) * 0.875) <= r
    face = inside(cx0, cx1, cy0, cy1, rr)
    rim = inside(cx0 - 2, cx1 + 2, cy0 - 2, cy1 + 2, rr + 2) & ~face
    streak = (np.sin(ny * 2.1) * 3 + ((gx * 7 + gy * 13) % 5) - 2).astype(int)
    base = np.stack([88 + streak, 90 + streak, 96 + streak], axis=-1)
    shade = np.clip((ny - cy0) / (cy1 - cy0), 0, 1)[..., None] * -22
    rgb[face] = np.clip(base + shade, 0, 255).astype(np.uint8)[face]
    rgb[rim] = (14, 14, 17)
    al[face | rim] = True
    # janelinhas do hodômetro da arte (sob o quadro, com dígitos espelhados): viram painel
    for x0, x1 in ((64, 86), (198, 222)):
        for y in range(101, 113):
            rgb[y, PAD + x0:PAD + x1] = rgb[y, PAD + x0 - 3]
    Image.fromarray(np.dstack([rgb, al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'nsx-dash.png'))
    # teto: só a borda do painel que sobe acima da primeira linha; o resto é vidro
    ty0 = y0 - EXT * PXH
    xs, ys = grid(ty0, EXT)
    trgb = sample(nw, xs, ys)
    tal = ~sample(sky, xs, ys)
    xr = np.clip(xs, 0, W - 1)
    trgb = sample(nw, xr, ys)
    tal = ~sample(sky, xr, ys)
    Image.fromarray(np.dstack([trgb, tal.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'nsx-top.png'))
    # volante: aro (anel entre as duas elipses) + raios e miolo (o que mudou entre as artes)
    e_out = ((xx - PIV[0]) / RIM_OUT[0]) ** 2 + ((yy - PIV[1]) / RIM_OUT[1]) ** 2 <= 1
    e_in = ((xx - PIV[0]) / RIM_IN[0]) ** 2 + ((yy - PIV[1]) / RIM_IN[1]) ** 2 <= 1
    diff = np.abs(ww.astype(int) - nw.astype(int)).sum(axis=2) > 60
    diff = cv2.morphologyEx(diff.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)) > 0
    diff = cv2.morphologyEx(diff.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    # dentro do aro: miolo (centro) a partir da linha 455; dos lados só abaixo de 492 (acima ficam
    # as janelinhas do hodômetro da arte, que não são do volante)
    inner = e_in & diff & (yy > 455) & ((np.abs(xx - PIV[0]) < 150) | (yy > 492))
    # só a peça grande ligada ao aro (sem respingos)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inner.astype(np.uint8), 8)
    keep = np.zeros_like(inner)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 3000:
            keep |= lab == i
    wheel = (e_out & ~e_in) | keep
    wheel = cv2.morphologyEx(wheel.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
    # o H do miolo: placa lisa (o emblema da marca fictícia entra com brand_badges.py)
    hx0, hx1 = mx(1080), mx(972)
    ring_ = (((xx - (hx0 + hx1) / 2) / 80) ** 2 + ((yy - 548) / 58) ** 2 <= 1) & ~(((xx - (hx0 + hx1) / 2) / 66) ** 2 + ((yy - 548) / 46) ** 2 <= 1)
    patchc = np.percentile(ww[ring_], 30, axis=0).astype(np.uint8)
    hub = ((xx - (hx0 + hx1) / 2) / 62) ** 2 + ((yy - 548) / 42) ** 2 <= 1
    ww[hub] = patchc
    xs, ys = grid(y0, WROWS, 0, 256)
    wrgb = sample(ww, xs, ys)
    wal = sample(wheel, xs, ys)
    Image.fromarray(np.dstack([wrgb, wal.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, 'nsx-wheel.png'))
    hubn = (128 + ((hx0 + hx1) / 2 - PIV[0]) * S, PIV_N[1] + (548 - PIV[1]) / PXH)
    print('painel, teto e volante; pivô', PIV_N, 'miolo', [round(v, 1) for v in hubn])


if __name__ == '__main__':
    main()
