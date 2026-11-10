"""Desenha um retrovisor externo completo na cabine (quando a arte não tem ou só mostra a ponta):
carcaça arredondada na cor da carroceria (luz em cima, sombra embaixo), contorno escuro, moldura e o
vidro transparente (o jogo põe a vista de trás nele: glass.at em COCKPIT_ART), e o braço até a porta.
Coordenadas no topo+painel empilhados (topo = 76 linhas). Imprime a semente do vidro.
Uso: python3 tools/qa/add_mirror.py <cabine> <x0> <y0> <x1> <y1> <braço_x> <braço_y> <cor #rrggbb>
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

COCK = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/cockpit')


def rrect(xx, yy, x0, y0, x1, y1, r):
    cx = np.clip(xx, x0 + r, x1 - r)
    cy = np.clip(yy, y0 + r, y1 - r)
    return ((xx - cx) ** 2 + ((yy - cy) * 8 / 7) ** 2 <= r * r) & (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)


def main():
    name = sys.argv[1]
    x0, y0, x1, y1, ax, ay = map(int, sys.argv[2:8])
    col = np.array([int(sys.argv[8][i:i + 2], 16) for i in (1, 3, 5)], float)
    tp, dp = os.path.join(COCK, f'{name}-top.png'), os.path.join(COCK, f'{name}-dash.png')
    t, d = np.array(Image.open(tp).convert('RGBA')), np.array(Image.open(dp).convert('RGBA'))
    st = np.concatenate([t, d], axis=0)
    H, W = st.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    light, mid, dark = np.clip(col * 1.35 + 30, 0, 255), col, col * 0.45
    r = max(4, (y1 - y0) // 3)
    body = rrect(xx, yy, x0, y0, x1, y1, r)
    glass = rrect(xx, yy, x0 + 5, y0 + 4, x1 - 5, y1 - 5, max(2, r - 3))
    ring = rrect(xx, yy, x0 + 4, y0 + 3, x1 - 4, y1 - 4, max(2, r - 2)) & ~glass
    # braço: do pé da carcaça até a porta
    arm = np.zeros_like(body)
    bx = (x0 + x1) * 0.62
    for y in range(y1 - 2, ay + 1):
        f = (y - (y1 - 2)) / max(1, ay - (y1 - 2))
        cx = bx + (ax - bx) * f
        arm[y, int(cx - 4):int(cx + 4)] = True
    tt = np.clip((yy - y1) / max(1, ay - y1), 0, 1)[..., None]
    st[..., :3][arm] = (mid * (1 - tt) + dark * tt)[arm].astype(np.uint8)
    st[..., 3][arm] = 255
    t2 = np.clip((yy - y0) / max(1, y1 - y0), 0, 1)[..., None]
    shade = np.where(t2 < 0.45, light * (1 - t2 / 0.45) + mid * (t2 / 0.45), mid * (1 - (t2 - 0.45) / 0.55) + dark * ((t2 - 0.45) / 0.55))
    st[..., :3][body] = shade[body].astype(np.uint8)
    edge = body & ~cv2.erode(body.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    st[..., :3][edge] = (dark * 0.5).astype(np.uint8)
    st[..., :3][ring] = (18, 16, 20)
    st[..., 3][body] = 255
    st[..., 3][glass] = 0
    Image.fromarray(st[:t.shape[0]], 'RGBA').save(tp, optimize=True)
    Image.fromarray(st[t.shape[0]:], 'RGBA').save(dp, optimize=True)
    print(name, 'semente do vidro (glass.at):', [(x0 + x1) // 2, (y0 + y1) // 2])


if __name__ == '__main__':
    main()
