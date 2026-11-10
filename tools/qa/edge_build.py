"""Constrói a continuação das portas/laterais da cabine até a borda da tela (telas mais largas que a
arte). NUNCA espelhar a porta nem esticar a última coluna: as linhas da peça (soleira, apoio de braço,
frisos, borracha) seguem a própria inclinação até a borda, com a cor-base tirada da faixa junto da
arte (suavizada) e um pontilhado leve (sem repetir maçanetas, saídas de ar ou
retrovisores).

Inclinação: quanto a linha DESCE (y+) a cada coluna andando para a borda da tela; numa porta vista
de dentro as linhas descem em direção à borda (positivo). A medida automática erra: passe à mão.
Uso: python3 tools/qa/edge_build.py <cabine> <L|R> <c0> [inclinação]
  c0 = primeira coluna de arte de verdade (contada a partir da borda daquele lado) no topo+painel
  empilhados (art_lint.py mostra onde começa a borda esticada)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

COCK = os.path.join(os.path.dirname(__file__), '..', '..', 'src/assets/cockpit')


def slope_of(st, c0, span=14):
    """inclinação (y por coluna, indo para dentro da arte) que melhor alinha duas colunas da arte"""
    a = st[:, c0 + 2, :3].astype(float)
    b = st[:, c0 + 2 + span, :3].astype(float)
    ok = (st[:, c0 + 2, 3] > 0) & (st[:, c0 + 2 + span, 3] > 0)
    best, bs = 1e18, 0.0
    H = st.shape[0]
    for s in np.arange(-0.8, 0.81, 0.04):
        sh = int(round(s * span))
        y = np.arange(H)
        y2 = np.clip(y + sh, 0, H - 1)
        m = ok & ok[y2]
        if m.sum() < 20:
            continue
        err = np.abs(a[m] - b[y2][m]).mean()
        if err < best:
            best, bs = err, s
    return bs


def build(name, side, c0, slope=None, band=6):
    tp, dp = os.path.join(COCK, f'{name}-top.png'), os.path.join(COCK, f'{name}-dash.png')
    t, d = np.array(Image.open(tp).convert('RGBA')), np.array(Image.open(dp).convert('RGBA'))
    st = np.concatenate([t, d], axis=0)
    if side == 'R':
        st = st[:, ::-1].copy()
    H, W = st.shape[:2]
    if slope is None:
        slope = slope_of(st, c0)
    rgb = st[..., :3].astype(np.float32)
    base = cv2.GaussianBlur(rgb, (0, 0), 1.6)
    detail = rgb - base
    out = st.copy()
    # só as linhas que estavam esticadas (4+ pixels iguais encostados na borda): o resto da faixa
    # (retrovisor, janela) fica como está
    def run(y):
        r = st[y]
        if r[0, 3] == 0:
            return 0
        e = 1
        while e < c0 + 4 and np.array_equal(r[e], r[0]):
            e += 1
        return e
    stretched = np.array([run(y) >= 4 for y in range(H)])
    for X in range(0, c0):
        dist = c0 - X
        ys = np.arange(H)
        yb = np.clip(np.round(ys - slope * dist).astype(int), 0, H - 1)  # mesma linha, na borda da arte
        # cor-base: média das 3 primeiras colunas da arte nessa linha; grão: da faixa, repetido
        # cor da peça na linha: as 2 primeiras colunas da arte (sem grão repetido: ele fazia
        # "dentes" nas bordas); um pontilhado leve alterna 1 px para não ficar chapado
        bcol = rgb[yb, c0:c0 + 2].mean(axis=1)
        dth = ((X + ys) % 2 == 0)[:, None] * (detail[yb, c0 + 1] * 0.35)
        col = np.clip(bcol + dth, 0, 255).astype(np.uint8)
        out[stretched, X, :3] = col[stretched]
        out[stretched, X, 3] = st[yb, c0, 3][stretched]
    if side == 'R':
        out = out[:, ::-1]
    Image.fromarray(out[:t.shape[0]], 'RGBA').save(tp, optimize=True)
    Image.fromarray(out[t.shape[0]:], 'RGBA').save(dp, optimize=True)
    return slope


if __name__ == '__main__':
    n, sd, c = sys.argv[1], sys.argv[2], int(sys.argv[3])
    s = float(sys.argv[4]) if len(sys.argv) > 4 else None
    print(n, sd, 'inclinação', round(build(n, sd, c, s), 2))
