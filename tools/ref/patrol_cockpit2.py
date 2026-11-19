"""Cabine da Patrulha 9C (Caprice 9C1) a partir da arte nova do Victor (uma só, com volante):
- painel, colunas, porta e retrovisor externo da arte SEM volante (cock-nw.png, ao lado da outra); o volante
  (aro em elipse, almofada e dois raios) vem da arte com volante e é a peça que gira
- vidros: dentro dos polígonos do para-brisa e da janela, o cenário (céu, mato, asfalto claro) vira vidro; o
  retrovisor interno sai inteiro (o jogo desenha o dele) e a arte, que acaba no alto sem forro, ganha o forro
  desenhado
- quadro: o velocímetro digital (algarismos turquesa), o hodômetro e os ponteiros pintados dos quatro relógios
  pequenos saem da arte; o jogo desenha os algarismos e os ponteiros (patrolCluster em cockpit.ts)
- marcas: "CHEVROLET" da almofada e "CAPRICE CLASSIC" do rádio viram superfície lisa
Escala 0,29 (o retrovisor externo inteiro cabe na folga da esquerda), pixel 8:7.
Uso: python3 tools/ref/patrol_cockpit2.py <cock.png> <src/assets/cockpit>   (DBG=<pasta>)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

S = 0.29
PXW, PXH = 1 / S, (1 / S) / (8 / 7)
PIV_X, WHEEL_C = 820.0, (820.0, 508.0)
PIV_N = (128.0, 104.0)
ROWS, EXT, PAD = 124, 76, 102
Y0D = 508.0 - 104 * PXH
WROWS = 210
RIM_OUT = (820.0, 508.0, 284.0, 294.0)
RIM_IN = (820.0, 512.0, 236.0, 249.0)
PAD_R = (692, 440, 990, 648)
SPOKES = [[(556, 468), (700, 452), (700, 565), (556, 548)], [(985, 452), (1086, 468), (1086, 562), (985, 565)]]
WIND = [(250, 0), (1675, 0), (1675, 300), (1010, 258), (640, 258), (470, 300), (430, 300)]
WIN = [(0, 0), (190, 0), (300, 150), (420, 300), (330, 302), (330, 410), (0, 420)]
IMIR = (1150, 18, 1556, 152)
LINER = 30
LCD = (797, 338, 912, 412)
LCD_BG = (8, 22, 26)
GAUGES = [(745, 365), (745, 417), (957, 365), (957, 417)]
PILLAR = [(184, 0), (388, 0), (440, 140), (500, 290), (520, 302), (330, 302), (300, 250), (240, 120)]   # coluna inteira (os brilhos dela não são vidro)
TXT = [(860, 580, 990, 604), (1335, 482, 1500, 500)]   # CHEVROLET da almofada, CAPRICE CLASSIC do rádio


def poly(shape, pts):
    return cv2.fillPoly(np.zeros(shape, np.uint8), [np.array(pts, np.int32)], 1) > 0


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = os.environ.get('DBG')
    a = np.array(Image.open(src).convert('RGB'))
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    ai = a.astype(int)
    lum = ai.mean(axis=2)
    hsv = cv2.cvtColor(a, cv2.COLOR_RGB2HSV).astype(int)
    scene = ((hsv[..., 1] > 60) & (hsv[..., 2] > 70)) | (lum > 72)
    # volante
    ell = lambda e: ((xx - e[0]) / e[2]) ** 2 + ((yy - e[1]) / e[3]) ** 2 <= 1  # noqa: E731
    sp = np.zeros((H, W), np.uint8)
    for p in SPOKES:
        cv2.fillPoly(sp, [np.array(p, np.int32)], 1)
    x0, y0, x1, y1 = PAD_R
    padm = np.zeros((H, W), np.uint8)
    cv2.rectangle(padm, (x0, y0), (x1, y1), 1, -1)
    wheel = ell(RIM_OUT) & (~ell(RIM_IN) | (sp > 0) | (padm > 0))
    ww = a.copy()
    for tx0, ty0, tx1, ty1 in TXT[:1]:
        for y in range(ty0, ty1):
            ww[y, tx0:tx1] = np.median(ww[y, tx0 - 30:tx0 - 2], axis=0).astype(np.uint8)
    # painel sem o volante: a arte SEM volante do Victor (alinhada com a outra); sem ela, refeito pelo entorno
    nwp = os.path.join(os.path.dirname(src), 'cock-nw.png')
    if os.path.exists(nwp):
        nw = np.array(Image.open(nwp).convert('RGB'))
    else:
        nw = cv2.inpaint(a, cv2.dilate(wheel.astype(np.uint8), np.ones((5, 5), np.uint8)), 7, cv2.INPAINT_TELEA)
    for tx0, ty0, tx1, ty1 in TXT[1:]:
        for y in range(ty0, ty1):
            nw[y, tx0:tx1] = np.median(nw[y, tx0 - 20:tx0 - 2], axis=0).astype(np.uint8)
    # quadro: algarismos turquesa saem do visor; ponteiros laranja saem dos relógios
    x0, y0, x1, y1 = LCD
    reg = nw[y0:y1, x0:x1].astype(int)
    teal = (reg[..., 2] > 90) & (reg[..., 1] > 80) & (reg[..., 0] < 90)
    teal = cv2.dilate(teal.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    reg[teal] = LCD_BG
    nw[y0:y1, x0:x1] = reg.astype(np.uint8)
    for gx, gy in GAUGES:
        r0 = nw[gy - 34:gy + 8, gx - 36:gx + 40].astype(int)
        org = (r0[..., 0] > 150) & (r0[..., 1] > 70) & (r0[..., 1] < 215) & (r0[..., 2] < 110) & (r0[..., 0] - r0[..., 1] > 30)
        org = cv2.dilate(org.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        r0[org] = (14, 14, 16)
        nw[gy - 34:gy + 8, gx - 36:gx + 40] = r0.astype(np.uint8)
    # vidros
    gl = (poly((H, W), WIND) | poly((H, W), WIN)) & scene
    gl = cv2.morphologyEx(gl.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    gl &= poly((H, W), WIND) | poly((H, W), WIN)
    x0, y0, x1, y1 = IMIR
    gl[y0:y1, x0:x1] = True
    # coluna: em cada linha, do primeiro contorno preto pela esquerda ao último pela direita, dentro do polígono
    pm = poly((H, W), PILLAR)
    L, R = np.full(300, np.nan), np.full(300, np.nan)
    for y in range(0, 300):
        xs = np.nonzero(pm[y] & (lum[y] < 40))[0]
        if len(xs) > 1:
            L[y], R[y] = xs.min(), xs.max()
    med = lambda v, y: np.nanmedian(v[max(0, y - 12):y + 13])  # noqa: E731  (sombras escuras das árvores: fora pela mediana)
    for y in range(0, 300):
        l, r = med(L, y), med(R, y)
        if not np.isnan(l):
            gl[y, int(l):int(r) + 1] = False
    leaf = (hsv[..., 0] > 25) & (hsv[..., 0] < 95) & (hsv[..., 1] > 90) & (hsv[..., 2] > 40)
    leaf = cv2.dilate(leaf.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    gl[:300, 150:540] |= leaf[:300, 150:540]   # folhas grudadas na beira da coluna
    gl[:LINER + 8, 1330:1390] = True
    # limpadores deitados na beira do painel (escuros acima da linha do painel): vidro
    gl[(yy < 252) & (xx > 1000) & poly((H, W), WIND)] = True
    gl[(yy < 254) & (xx > 640) & (xx <= 1000) & poly((H, W), WIND)] = True
    # ilhas pequenas no vidro somem
    n, lab, st, _ = cv2.connectedComponentsWithStats(((poly((H, W), WIND) | poly((H, W), WIN)) & ~gl).astype(np.uint8), connectivity=8)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 300:
            gl[lab == i] = True
    # forro no alto (a arte acaba no céu): faixa cinza-escura com a borda de baixo
    A = ~gl
    pil_l = 200 + (yy < 1) * 0
    liner = yy < LINER
    nw[liner] = (44, 44, 50)
    nw[liner & (yy >= LINER - 3)] = (16, 16, 20)
    A |= liner
    if dbg:
        v = nw.copy()
        v[~A] = (0, 255, 0)
        Image.fromarray(v).save(os.path.join(dbg, 'alpha.png'))
    # amostragem na grade do jogo (o topo começa acima da arte: linhas fora viram forro)
    cols = 256 + 2 * PAD
    xs = PIV_X + (np.arange(cols) - PAD + 0.5 - PIV_N[0]) * PXW

    def samp(img, ys):
        xi = np.clip(np.floor(xs).astype(int), 0, W - 1)
        yi = np.clip(ys.astype(int), 0, H - 1)
        return img[yi][:, xi]
    yd = Y0D + (np.arange(ROWS) + 0.5) * PXH
    yt = Y0D - EXT * PXH + (np.arange(EXT) + 0.5) * PXH
    for name, ys in (('dash', yd), ('top', yt)):
        rgb, al = samp(nw, ys), samp(A, ys)
        above = ys < 0
        rgb[above] = (44, 44, 50)
        al[above] = True
        Image.fromarray(np.dstack([rgb, al.astype(np.uint8) * 255]), 'RGBA').save(os.path.join(out, f'patrol-{name}.png'), optimize=True)
    # volante
    xw = WHEEL_C[0] + (np.arange(256) + 0.5 - PIV_N[0]) * PXW
    yw = WHEEL_C[1] + (np.arange(WROWS) + 0.5 - (PIV_N[1] + 4)) * PXH
    xi = np.clip(np.floor(xw).astype(int), 0, W - 1)
    yi = np.clip(yw.astype(int), 0, H - 1)
    wimg = np.dstack([ww[yi][:, xi], (wheel[yi][:, xi] & (yw < H)[:, None]).astype(np.uint8) * 255])
    Image.fromarray(wimg, 'RGBA').save(os.path.join(out, 'patrol-wheel.png'), optimize=True)
    nat = lambda x, y: (round(PIV_N[0] + (x - PIV_X) * S, 2), round((y - Y0D) / PXH, 2))  # noqa: E731
    print('Y0D', round(Y0D, 1), 'topo', round(Y0D - EXT * PXH, 1))
    print('visor', nat(LCD[0], LCD[1]), nat(LCD[2], LCD[3]))
    print('relógios', [nat(*g) for g in GAUGES])
    print('retrovisor (empilhado)', round(PAD + nat(150, 330)[0]), round(EXT + nat(150, 330)[1]))


if __name__ == '__main__':
    main()
