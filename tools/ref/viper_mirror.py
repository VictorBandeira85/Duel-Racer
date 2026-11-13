"""Serpe V10: retrovisor esquerdo refeito como o do Viper RT/10 de verdade (fotos do Victor).
O antigo (quadrado vermelho de cantos redondos com braço grosso) sai inteiro; no lugar:
- carcaça na cor da carroceria em "gota deitada": borda de cima longa e quase reta, descendo um pouco
  para dentro; lado de fora (esquerda da tela) bem redondo e mais alto; lado de dentro afinando numa
  ponta arredondada mais baixa (lado direito inclinado, como um trapézio)
- aro largo da carcaça em volta do vidro (mais grosso embaixo), contorno escuro e os tons do capô
- vidro com o mesmo formato, transparente (o jogo põe a vista de trás: glass.at em cockpit.ts)
- pé curto e grosso saindo de baixo do lado de dentro, inclinado para a porta, com a base de borracha
  preta encostada na borda da porta
- a borda da porta que o braço antigo tapava é refeita continuando a própria linha (inclinação -1)
- máscaras de pintura (viper-top-mask / viper-dash-mask): carcaça e pé do retrovisor + capô vermelho
Coordenadas no topo+painel empilhados (topo = 76 linhas).
Uso: python3 tools/ref/viper_mirror.py   (parte dos PNG atuais; o retrovisor antigo tem de estar lá)
"""
import os

import cv2
import numpy as np
from PIL import Image, ImageDraw

COCK = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/cockpit')
TP, DP = os.path.join(COCK, 'viper-top.png'), os.path.join(COCK, 'viper-dash.png')

# tons do capô vermelho da própria arte
K = (6, 2, 3)          # contorno
D1 = (92, 2, 2)        # sombra funda
D2 = (158, 1, 0)       # sombra
M = (222, 2, 0)        # meio
B = (250, 2, 0)        # luz
L = (255, 112, 100)    # reflexo
H = (255, 236, 240)    # brilho
RUB, RUB2 = (18, 16, 20), (52, 50, 58)   # borracha da base (e o fio de luz dela)


def door_top(x):
    """primeira linha clara da porta na coluna x (medida: 178 - x entre x=39 e 56)"""
    return 178 - x


def smooth(pts, n=3):
    """curva de Chaikin fechada"""
    p = np.array(pts, float)
    for _ in range(n):
        q = np.roll(p, -1, axis=0)
        p = np.stack([0.75 * p + 0.25 * q, 0.25 * p + 0.75 * q], axis=1).reshape(-1, 2)
    return p


def raster(poly, H_, W_, ss=8):
    im = Image.new('L', (W_ * ss, H_ * ss), 0)
    ImageDraw.Draw(im).polygon([(x * ss, y * ss) for x, y in poly], fill=255)
    return np.array(im.resize((W_, H_), Image.BOX)) >= 128


def main():
    t, d = np.array(Image.open(TP).convert('RGBA')), np.array(Image.open(DP).convert('RGBA'))
    st = np.concatenate([t, d], axis=0)
    Hh, W = st.shape[:2]
    rgb = st[..., :3].astype(int)
    red = (rgb[..., 0] > rgb[..., 1] * 1.6) & (rgb[..., 0] > 40) & (st[..., 3] > 0)

    # 1) apaga o retrovisor antigo: tudo à esquerda da coluna e acima da borda da porta
    for x in range(0, 57):
        y1 = min(Hh, door_top(x) - 3) if x >= 36 else 135
        st[60:y1, x] = 0
    for y in range(60, 135):
        for x in range(0, 58):
            if red[y, x] and st[y, x, 3]:
                st[y, x] = 0 if y < door_top(x) - 3 else st[y, x]
    # 2) a borda da porta que o braço tapava: cada pixel vermelho que sobrou recebe o da mesma linha
    #    da porta (descendo pela inclinação -1 até achar a porta da arte)
    rgb = st[..., :3].astype(int)
    red = (rgb[..., 0] > rgb[..., 1] * 1.6) & (rgb[..., 0] > 40) & (st[..., 3] > 0)
    for x in range(36, 58):
        for y in range(door_top(x) - 4, door_top(x) + 8):
            if red[y, x]:
                for s in range(1, 20):
                    yy, xx = y + s, x - s
                    if st[yy, xx, 3] and not red[yy, xx]:
                        st[y, x] = st[yy, xx]
                        break
    # contorno da porta inteiro até a coluna (3 px escuros acima da primeira linha clara)
    for x in range(36, 57):
        for k in (1, 2, 3):
            y = door_top(x) - k
            if not st[y, x, 3]:
                st[y, x] = (*K, 255)

    # 3) carcaça: gota deitada (u: 0 fora .. 1 dentro, v: 0 cima .. 1 baixo)
    X0, Y0, WW, HH, SH = 8.0, 76.0, 50.0, 30.0, 3.0  # o mais perto da coluna possível (no celular a borda esquerda corta)
    uv = [(0.16, 0.03), (0.45, 0.0), (0.74, 0.03), (0.86, 0.07), (0.95, 0.16), (0.98, 0.27),
          (0.94, 0.52), (0.88, 0.76), (0.82, 0.90), (0.72, 0.98), (0.45, 1.0), (0.20, 0.98),
          (0.08, 0.90), (0.02, 0.72), (0.0, 0.50), (0.02, 0.28), (0.07, 0.12)]
    poly = [(X0 + u * WW, Y0 + v * HH + SH * u) for u, v in smooth(uv)]
    house = raster(poly, Hh, W)
    # vidro: o mesmo formato por dentro do aro (5 px em cima e dos lados, 7 embaixo)
    er = cv2.erode(house.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))).astype(bool)
    glass = er & np.roll(er, -2, axis=0)
    rim = house & ~glass

    # 4) pé: curto e grosso, de baixo do lado de dentro até a porta, e a base de borracha
    stalk = raster([(43.5, 104.0), (52.0, 103.0), (56.5, 121.0), (47.0, 125.0)], Hh, W)
    stalk &= ~house
    # base: borracha de 4 px acompanhando a borda inclinada da porta, só embaixo do pé
    base = np.zeros_like(house)
    for x in range(45, 57):
        base[door_top(x) - 7:door_top(x) - 3, x] = True
        stalk[door_top(x) - 7:, x] = False
    base &= ~house

    out = st.copy()
    yy, xx = np.mgrid[0:Hh, 0:W]
    inside = lambda m, y, x: 0 <= y < Hh and 0 <= x < W and m[y, x]
    # pé: luz à esquerda, sombra à direita, contorno
    for y, x in zip(*np.nonzero(stalk)):
        row = np.nonzero(stalk[y])[0]
        a, b_ = row.min(), row.max()
        f = (x - a) / max(1, b_ - a)
        edge = not (inside(stalk | house | base, y, x - 1) and inside(stalk | house | base, y, x + 1))
        c = K if edge else (L if f < 0.25 else M if f < 0.5 else D2 if f < 0.8 else D1)
        if not edge and y > 114:
            c = D2 if f < 0.5 else D1      # sombra embaixo, junto da base
        out[y, x] = (*c, 255)
    # base de borracha por cima do pé, encostada na porta
    for y, x in zip(*np.nonzero(base)):
        top = not inside(base, y - 1, x)
        side = not (inside(base, y, x - 1) or inside(base, y, x + 1)) or x in (45, 56)
        out[y, x] = (*(K if side else RUB2 if top else RUB), 255)
    # carcaça
    cols = np.nonzero(house.any(axis=0))[0]
    cy_, cx_ = np.nonzero(glass)
    gcx, gcy = cx_.mean(), cy_.mean()
    for y, x in zip(*np.nonzero(rim)):
        u = (x - cols.min()) / max(1, cols.max() - cols.min())
        n4 = ((-1, 0), (1, 0), (0, -1), (0, 1))
        if not all(inside(house, y + dy, x + dx) for dy, dx in n4):
            c = K
        elif any(inside(glass, y + dy, x + dx) for dy, dx in n4):
            c = D1 if y < gcy else K       # lábio do aro: sombra sobre o vidro
        else:
            # pelo ângulo em volta do vidro: em cima pega a luz, dos lados meio-tom, embaixo sombra
            ang = np.degrees(np.arctan2((y - gcy) * 1.7, x - gcx))   # -90 = em cima
            outer = not all(inside(house, y + 2 * dy, x + 2 * dx) for dy, dx in n4)  # fileira junto do contorno
            if ang < -35 and ang > -150:
                c = B
                if outer and 0.12 < u < 0.66:
                    c = H                  # brilho comprido na borda de cima
                elif outer:
                    c = L
            elif ang <= -150 or ang >= 150:
                c = L if outer else B      # lado de fora, redondo, virado para a luz
            elif ang >= -35 and ang < 30:
                c = B if outer else M      # ponta de dentro
            elif ang >= 30 and ang < 110:
                c = M if outer else D2     # embaixo (aro mais grosso)
            else:
                c = B if outer else M      # canto de baixo do lado de fora
        out[y, x] = (*c, 255)
    out[glass] = 0

    t2, d2 = out[:t.shape[0]], out[t.shape[0]:]
    Image.fromarray(t2, 'RGBA').save(TP, optimize=True)
    Image.fromarray(d2, 'RGBA').save(DP, optimize=True)

    # 5) máscaras de pintura: capô vermelho (a mancha vermelha grande do alto do painel) + retrovisor
    o = out[..., :3].astype(int)
    hsv = cv2.cvtColor(out[..., :3].copy(), cv2.COLOR_RGB2HSV_FULL).astype(int)
    hue = hsv[..., 0] * 360 / 256
    reddish = (out[..., 3] > 0) & ((hue < 14) | (hue > 340)) & (hsv[..., 1] > 90) & (o[..., 0] > 60)
    pinkish = (out[..., 3] > 0) & ((hue < 14) | (hue > 330)) & (o[..., 0] > 200) & (o[..., 1] > 90) & (o[..., 2] > 80)
    cand = reddish | pinkish
    n, lab, stt, _ = cv2.connectedComponentsWithStats(cand.astype(np.uint8), connectivity=8)
    mask = np.zeros((Hh, W), bool)
    for i in range(1, n):
        x, y, w, h, a = stt[i]
        if a > 400 and y < 100:          # capô
            mask |= lab == i
    mask |= (rim | stalk) & cand
    # brilhos dentro do capô (cercados pela pintura) e o contorno do capô ficam de fora; reflexos
    # claros encostados entram
    near = cv2.dilate(mask.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    mask |= near & pinkish
    # sem pixel solto: manchas de 1-2 px saem e furos de 1-2 px fecham
    for val in (True, False):
        src_ = mask if val else (~mask & (out[..., 3] > 0))
        n, lab, stt, _ = cv2.connectedComponentsWithStats(src_.astype(np.uint8), connectivity=8)
        for i in range(1, n):
            if stt[i, 4] <= 2:
                mask[lab == i] = not val
    m8 = (mask * 255).astype(np.uint8)
    Image.fromarray(m8[:t.shape[0]], 'L').save(os.path.join(COCK, 'viper-top-mask.png'), optimize=True)
    Image.fromarray(m8[t.shape[0]:], 'L').save(os.path.join(COCK, 'viper-dash-mask.png'), optimize=True)
    gy, gx = np.nonzero(glass)
    print('vidro', len(gy), 'px; semente (glass.at):', [int(np.median(gx)), int(np.median(gy))])


if __name__ == '__main__':
    main()
