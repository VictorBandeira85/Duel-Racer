"""Volante do Gaúcho GTI (depois de import_cockpit.py br-golgti): a arte tem textura de couro
que, reduzida a 256 px, vira chuvisco. Redesenha em pixel art limpo, na mesma geometria medida
na arte (tools/ref/wheels/br-golgti.json): aro com volume (mais claro em cima), os quatro raios
com o miolo e os quatro botões redondos da buzina do volante VW da época, contorno escuro.
O PNG começa TOP linhas acima do topo da arte, para o aro aparecer inteiro sobre o para-brisa
(no jogo: wheelTop).

Uso: python3 tools/ref/gol_cockpit.py src/assets/cockpit
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
TOP = 28                   # linhas acima do topo da arte
ROWS = 230                 # linhas abaixo do topo da arte
XC0, Y0, S = 242, 247, 0.46  # recorte usado em import_cockpit.py
PXW = 1 / S
PXH = PXW / (8 / 7)
SS = 4                     # amostras por pixel (borda suave decidida por maioria)

RAMP = [(10, 10, 12), (22, 22, 25), (32, 32, 36), (42, 42, 47), (54, 54, 60), (68, 68, 75), (84, 84, 92), (104, 104, 112)]


def main():
    out = sys.argv[1]
    geo = json.load(open(os.path.join(HERE, 'wheels', 'br-golgti.json')))
    cx, cy = geo['center']
    W, H = 256, TOP + ROWS
    # coordenadas da arte de cada subamostra
    xs = XC0 + (np.arange(W * SS) + 0.5) / SS * PXW
    ys = Y0 + (np.arange(H * SS) + 0.5) / SS * PXH - TOP * PXH
    X, Y = np.meshgrid(xs, ys)
    rho = np.sqrt(((X - cx) / 242) ** 2 + ((Y - cy) / 236) ** 2)
    rin = np.sqrt(((X - cx) / 211) ** 2 + ((Y - cy) / 206) ** 2)
    rim = (rho <= 1) & (rin > 1)
    inner = rin <= 1
    # raios e miolo: dentro do aro, fora dos vãos
    off = (int(-XC0 + 0), int(-(Y0 - TOP * PXH)))
    hole = np.zeros(X.shape, np.uint8)
    for q in geo['holes']:
        p = ((np.array(q, float) - [XC0, Y0 - TOP * PXH]) * [SS / PXW, SS / PXH]).round().astype(np.int32)
        cv2.fillPoly(hole, [p], 1)
    hub = inner & (hole == 0)
    # botões da buzina
    btn = np.zeros(X.shape, bool)
    ring = np.zeros(X.shape, bool)
    for bx in (416, 624):
        for by in (437, 512):
            d = np.sqrt(((X - bx) / 26) ** 2 + ((Y - by) / 26) ** 2)
            btn |= d <= 1
            ring |= (d <= 1.0) & (d > 0.82)
    # volta para pixels (maioria das subamostras)
    def down(m):
        return m.reshape(H, SS, W, SS).mean(axis=(1, 3)) >= 0.5
    def downf(v):
        return v.reshape(H, SS, W, SS).mean(axis=(1, 3))
    rimP, hubP, btnP, ringP = down(rim), down(hub & ~rim), down(btn & hub), down(ring & hub)
    rhoP = downf(rho)
    ang = np.arctan2(downf(Y) - cy, downf(X) - cx)
    img = np.zeros((H, W, 4), np.uint8)
    lvl = np.zeros((H, W), int)
    # aro: perfil de cilindro (claro no meio da espessura), mais claro em cima
    u = np.clip((rhoP - 0.872) / 0.128, 0, 1)
    shade = np.sin(np.pi * u) ** 0.7 * 3.4 + 1.8 - np.sin(ang) * 1.8
    lvl[rimP] = np.clip(np.round(shade[rimP]), 1, 7).astype(int)
    # miolo e raios: liso, com a quina de cima clara e a de baixo escura
    lvl[hubP] = 4
    hub_top = hubP & ~np.vstack([np.zeros((2, W), bool), hubP[:-2]])  # 2 linhas: a de cima vira contorno
    lvl[hub_top] = 6
    below = np.vstack([hubP[1:], np.zeros((1, W), bool)])
    below2 = np.vstack([hubP[2:], np.zeros((2, W), bool)])
    lvl[hubP & ~below2 & ~rimP] = 2
    # botões: um tom abaixo do miolo, aro escuro e brilho no alto à esquerda
    lvl[btnP] = 3
    lvl[ringP] = 0
    for bx in (416, 624):
        for by in (437, 512):
            px, py = (bx - XC0) / PXW, (by - Y0) / PXH + TOP
            for dx, dy in ((-3, -4), (-2, -5), (-4, -3), (-1, -5)):
                x, y = int(px + dx), int(py + dy)
                if btnP[y, x] and not ringP[y, x]:
                    lvl[y, x] = 6
    # traço que liga os botões de cima e de baixo
    for bx in (416, 624):
        x = int((bx - XC0) / PXW)
        for y in range(int((437 + 26 - Y0) / PXH + TOP), int((512 - 26 - Y0) / PXH + TOP) + 1):
            lvl[y, x] = 0
    # emendas do couro do aro (perto de onde os raios encostam)
    for a in (np.radians(-148), np.radians(-32), np.radians(132), np.radians(48)):
        for t in np.linspace(0.86, 1.0, 12):
            x = (cx + np.cos(a) * 242 * t - XC0) / PXW
            y = (cy + np.sin(a) * 236 * t - Y0) / PXH + TOP
            if 0 <= int(y) < H and 0 <= int(x) < W and rimP[int(y), int(x)]:
                lvl[int(y), int(x)] = 1
    solid = rimP | hubP
    for k in range(len(RAMP)):
        img[solid & (lvl == k), :3] = RAMP[k]
    img[solid, 3] = 255
    # contorno: pixel da peça vizinho de fora (4-vizinhança) fica quase preto
    K4 = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)
    edge = solid & (cv2.erode(solid.astype(np.uint8), K4) == 0)
    img[edge, :3] = RAMP[0]
    Image.fromarray(img, 'RGBA').save(os.path.join(out, 'br-golgti-wheel.png'))
    print('volante', W, H, 'pivô', (cx - XC0) / PXW, (cy - Y0) / PXH)


if __name__ == '__main__':
    main()
